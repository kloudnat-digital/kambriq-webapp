import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { effectiveRoles, RoleCode, ROLE_HIERARCHY, SUPER_ADMIN_ROLE } from '@kambriq/common';

/**
 * There is one super admin and it is `ADMIN_GLOBAL`. This file is the guard that
 * keeps that true.
 *
 * The question that produced it was whether to add a `SUPER_ADMIN` role. The
 * answer was no, because the two things a super admin has to be were already
 * true of `ADMIN_GLOBAL` and remain true here:
 *
 *   1. it implies every role that guards a route - `ROLE_HIERARCHY` gives it the
 *      other seven, and no `@Roles()` decorator names anything outside that set;
 *   2. it is the only role on the three endpoints that change another user's
 *      roles - grant, revoke and replace - so it can already appoint and
 *      unappoint administrators, including other holders of itself.
 *
 * A second all-powerful role beside it is not redundancy. It is a permission
 * model with two answers to "who can do this", and the second one drifts: the
 * next `@Roles()` gets one of them and not the other, and nothing fails until
 * somebody is refused a route they own. The reasoning is in
 * `docs/adr/ADR-008-admin-global-is-the-super-admin.md`.
 *
 * **The decision is only worth writing down if something enforces it.** Both
 * halves are quiet failures. A new `RoleCode` used in an `@Roles()` and never
 * added to `ROLE_HIERARCHY` leaves a route the super admin cannot reach, and
 * every existing test still passes. A deleted `@Roles(RoleCode.ADMIN_GLOBAL)` on
 * a role-mutation route downgrades it to "any authenticated user" without
 * changing a single response shape - the same class as the class-level `@Roles`
 * pinned in `route-guards.spec.ts`.
 */
const API_SRC = join(__dirname, '..', '..');

const walk = (dir: string): string[] => {
  const out: string[] = [];
  for (const e of readdirSync(dir)) {
    const full = join(dir, e);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (e.endsWith('.controller.ts')) out.push(full);
  }
  return out;
};

const CONTROLLERS = walk(API_SRC)
  .filter((f) => !f.includes('__test__'))
  .map((f) => ({ path: relative(API_SRC, f), src: readFileSync(f, 'utf8') }));

/** Strips comments, so prose quoting a decorator is not read as one. */
const stripComments = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

/**
 * Every role named in any `@Roles(...)` in the API, as a flat set.
 *
 * Read off the decorators rather than off `RoleCode`, because the question is
 * not "does the super admin have every role that exists" - `STAFF_VERIFY`,
 * `STAFF_VALUATION` and `PARTNER_GEO` exist in the enum, gate nothing, and have
 * no row in the database. The question is "is there a route it cannot reach",
 * and only a decorator can create one.
 */
const ROLES_GUARDING_ROUTES = new Set<string>(
  CONTROLLERS.flatMap(({ src }) =>
    [...stripComments(src).matchAll(/@Roles\(([^)]*)\)/g)].flatMap((m) =>
      [...m[1].matchAll(/RoleCode\.([A-Z_]+)/g)].map((r) => r[1]),
    ),
  ),
);

/** The three routes that change another user's roles, and the file they live in. */
const ROLE_MUTATION_ROUTES: ReadonlyArray<readonly [string, string]> = [
  ['grant', "@Post(':id/roles')"],
  ['revoke', "@Delete(':id/roles/:roleCode')"],
  ['replace', "@Patch(':id')"],
];

const USERS_CONTROLLER = 'core/users/users.controller.ts';

/**
 * Every role that has an entry in the hierarchy except the super admin itself.
 *
 * Typed as `RoleCode[]` on purpose. Written as `Object.entries(ROLE_HIERARCHY)`
 * the value came back `unknown`, and `tsc` accepted `.includes(...)` on it right
 * up until a mutation added a role to one of the lists - at which point the
 * suite stopped compiling rather than failing. A guard that cannot be mutated
 * has not been shown to guard anything.
 */
const HOLDERS: RoleCode[] = (Object.keys(ROLE_HIERARCHY) as RoleCode[]).filter(
  (holder) => holder !== SUPER_ADMIN_ROLE,
);

/** The decorator line immediately preceding a route decorator, if it is `@Roles`. */
const rolesGuarding = (src: string, route: string): string | null => {
  const at = src.indexOf(route);
  if (at === -1) throw new Error(`Route decorator not found: ${route}`);
  const after = src.slice(at, src.indexOf('async ', at));
  return /@Roles\(([^)]*)\)/.exec(after)?.[1] ?? null;
};

describe('ADMIN_GLOBAL is the super admin, and nothing else is', () => {
  it('is reading the source tree at all', () => {
    // A scanner that finds nothing makes every assertion below vacuous - the
    // measurement failing silently rather than the thing measured.
    expect(CONTROLLERS.length).toBeGreaterThanOrEqual(13);
    expect(CONTROLLERS.map((c) => c.path)).toContain(USERS_CONTROLLER);
    expect(ROLES_GUARDING_ROUTES.size).toBeGreaterThanOrEqual(6);
    expect([...ROLES_GUARDING_ROUTES]).toContain(RoleCode.CLIENT);
  });

  it('names the super admin through the constant, not by re-deriving it', () => {
    expect(SUPER_ADMIN_ROLE).toBe(RoleCode.ADMIN_GLOBAL);
  });

  it.each([...ROLES_GUARDING_ROUTES])(
    'the super admin implies %s, so no route is out of its reach',
    (role) => {
      expect([...effectiveRoles([SUPER_ADMIN_ROLE])]).toContain(role);
    },
  );

  /**
   * I7 - VERIFY is operated by STAFF_VERIFY, and the super admin inherits it,
   * like every other administration (decided 15 September).
   *
   * Stated on its own rather than left to the `@Roles` sweep above: no route is
   * guarded by STAFF_VERIFY yet, so the sweep cannot see it, and the decision
   * would otherwise hold only from the day the first VERIFY route is written.
   * The hierarchy is one level deep, so STAFF_VERIFY must be listed on
   * ADMIN_GLOBAL itself - putting it under another role would not reach it.
   */
  it('the super admin implies STAFF_VERIFY before any route needs it', () => {
    expect(ROLE_HIERARCHY[SUPER_ADMIN_ROLE]).toContain(RoleCode.STAFF_VERIFY);
    expect([...effectiveRoles([SUPER_ADMIN_ROLE])]).toContain(RoleCode.STAFF_VERIFY);
  });

  it('no other role implies the super admin, so there is exactly one top', () => {
    const impliers = HOLDERS.filter((holder) =>
      (ROLE_HIERARCHY[holder] ?? []).includes(SUPER_ADMIN_ROLE),
    );

    expect(impliers).toEqual([]);
  });

  it('no other role reaches every route the super admin does, so there is no second god role', () => {
    // Deliberately excludes SUPER_ADMIN_ROLE itself from the required set.
    // Including it makes this assertion unfailable on its own: any rival would
    // have to imply ADMIN_GLOBAL, which trips the test above first, and a test
    // that can only fail alongside another has not been shown to guard
    // anything. What is left is the case that actually worries us - a role that
    // is a god role in everything but name.
    const rivals = HOLDERS.filter((holder) => {
      const reach = effectiveRoles([holder]);
      return [...ROLES_GUARDING_ROUTES]
        .filter((r) => r !== SUPER_ADMIN_ROLE)
        .every((r) => reach.has(r));
    });

    expect(rivals).toEqual([]);
  });

  it.each(ROLE_MUTATION_ROUTES)(
    'the %s route is guarded by the super admin and by nothing weaker',
    (_name, route) => {
      const controller = CONTROLLERS.find((c) => c.path === USERS_CONTROLLER);
      if (!controller) throw new Error(`Controller not found: ${USERS_CONTROLLER}`);

      const decorator = rolesGuarding(stripComments(controller.src), route);

      // Present, and exactly the super admin: `@Roles(ADMIN_GLOBAL, ADMIN_KBS)`
      // would satisfy a `toContain` and would hand role administration to a
      // product admin.
      expect(decorator).not.toBeNull();
      expect([...(decorator ?? '').matchAll(/RoleCode\.([A-Z_]+)/g)].map((m) => m[1])).toEqual([
        SUPER_ADMIN_ROLE,
      ]);
    },
  );
});
