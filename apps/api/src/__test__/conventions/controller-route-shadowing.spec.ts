import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * A controller mounted under another's path must be registered before it.
 *
 * Nest registers routes in the order the module lists its controllers, and
 * Express answers with the first pattern that matches. `LandsAdminController`
 * sits at `lands/admin` and carries `@Get(':id')`, so while it was listed first
 * it answered `GET /lands/admin/payments` - with
 * "Parcelle de terrain introuvable", a 404 about a land, for a request about the
 * payment queue.
 *
 * Everything else about that route was right: the controller existed, its guards
 * and DTOs were correct, `nx typecheck` passed and 429 unit tests were green. The
 * screen was blank because a different controller was answering. **A unit test on
 * the controller cannot see this** - it tests the class, not the routing table -
 * and only opening the page found it.
 *
 * So the ordering is asserted here, from the module file, rather than left as a
 * property somebody has to know. Reordering that array is a one-line edit that
 * looks like alphabetising.
 */
const LANDS_MODULE = readFileSync(join(__dirname, '..', '..', 'lands', 'lands.module.ts'), 'utf8');

const CONTROLLER_BASE_PATHS: Readonly<Record<string, string>> = {
  PaymentsAdminController: 'lands/admin/payments',
  LandsAdminController: 'lands/admin',
  LandsAgentController: 'lands',
  LandsClientController: 'lands/client',
};

/** The controllers, in the order the module registers them. */
const registrationOrder = (src: string): string[] => {
  const block = /controllers:\s*\[([\s\S]*?)\]/.exec(src)?.[1];
  if (!block) throw new Error('no controllers array found in lands.module.ts');
  return block
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.endsWith('Controller'));
};

/** True when `a` is `b` plus at least one more path segment. */
const extendsPath = (a: string, b: string): boolean =>
  a !== b && a.startsWith(b === '' ? '' : `${b}/`);

describe('a controller mounted under another is registered first', () => {
  const order = registrationOrder(LANDS_MODULE);

  it('is reading the module it thinks it is', () => {
    expect(order.length).toBeGreaterThan(1);
    for (const name of order) {
      expect(Object.keys(CONTROLLER_BASE_PATHS)).toContain(name);
    }
  });

  it('every controller path in the map matches its @Controller decorator', () => {
    // Otherwise this file could assert an ordering for paths that no longer
    // exist and pass while the real routes shadow each other.
    for (const [name, expected] of Object.entries(CONTROLLER_BASE_PATHS)) {
      const file = join(
        __dirname,
        '..',
        '..',
        'lands',
        'controllers',
        `${name
          .replace(/Controller$/, '')
          .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
          .toLowerCase()}.controller.ts`,
      );
      const src = readFileSync(file, 'utf8');
      expect(/@Controller\(\s*'([^']*)'\s*\)/.exec(src)?.[1]).toBe(expected);
    }
  });

  it('no controller is shadowed by one registered before it', () => {
    const failures: string[] = [];

    for (let i = 0; i < order.length; i++) {
      for (let j = i + 1; j < order.length; j++) {
        const earlier = CONTROLLER_BASE_PATHS[order[i]];
        const later = CONTROLLER_BASE_PATHS[order[j]];
        if (extendsPath(later, earlier)) {
          failures.push(
            `${order[j]} ('${later}') is registered after ${order[i]} ('${earlier}'), which ` +
              `can answer its routes with a :id parameter instead.`,
          );
        }
      }
    }

    expect(failures).toEqual([]);
  });

  it('the specific pair that broke is pinned', () => {
    // Named, because the general rule above is only as good as the map it reads,
    // and this is the one that shipped a blank screen.
    expect(order.indexOf('PaymentsAdminController')).toBeLessThan(
      order.indexOf('LandsAdminController'),
    );
  });
});
