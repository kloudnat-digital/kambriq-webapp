import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * A literal route must be declared before the parameterised one it would fall into.
 *
 * `controller-route-shadowing.spec.ts` pins the order of CONTROLLERS in a
 * module, which is the inter-controller half of this hazard. It cannot see the
 * other half: inside one controller, Nest registers handlers in declaration
 * order and Express answers with the first pattern that matches. So
 * `@Get('candidates/pending')` declared AFTER `@Get('candidates/:id')` is dead
 * on arrival - `:id` matches the literal string "pending", the service looks up
 * a candidate with that id, and the queue answers 404 "candidate not found".
 *
 * That failure is particularly nasty because every part of it looks healthy:
 * the route exists, its guards and DTO are right, the controller's unit tests
 * pass, and `nx typecheck` is clean. Only a real request shows it, and what it
 * shows is a 404 that reads like a missing record rather than a routing defect.
 *
 * This is asserted against the source text rather than the routing table, for
 * the same reason the sibling guard reads the module file: the property belongs
 * to declaration order, and reordering two decorators is a one-line edit that
 * looks like tidying.
 */
const CONTROLLER = readFileSync(
  join(__dirname, '..', '..', 'kbs', 'controllers', 'kbs-admin.controller.ts'),
  'utf8',
);

/**
 * The position of a route decorator in the file.
 *
 * Matched at the start of a line, allowing indentation, so a decorator is never
 * confused with a mention of one in prose - the sweep that counted `@Public()`
 * inside a sentence explaining that a route was not public is the reason this
 * matters.
 */
const positionOf = (decorator: string): number => {
  const pattern = new RegExp(`^[ \\t]*@${decorator.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'm');
  const found = pattern.exec(CONTROLLER);
  return found?.index ?? -1;
};

describe('KbsAdminController - a literal route is declared before the parameterised one', () => {
  it('is reading the controller it thinks it is', () => {
    expect(CONTROLLER).toContain("@Controller('kbs/admin')");
  });

  /**
   * Both ends asserted, so the comparison below cannot pass because one of them
   * is absent. A test that silently compares -1 against -1 proves nothing.
   */
  it('declares both the queue route and the by-id route', () => {
    expect(positionOf("Get('candidates/pending')")).toBeGreaterThan(-1);
    expect(positionOf("Get('candidates/:id')")).toBeGreaterThan(-1);
  });

  it('puts candidates/pending before candidates/:id', () => {
    expect(positionOf("Get('candidates/pending')")).toBeLessThan(
      positionOf("Get('candidates/:id')"),
    );
  });
});
