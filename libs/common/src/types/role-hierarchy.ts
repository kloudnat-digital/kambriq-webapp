/**
 * The role hierarchy, on its own, importing nothing but the enum.
 *
 * It was inside `roles.guard.ts`, which imports `@nestjs/common` and
 * `@nestjs/core`. `prisma/bootstrap-admins.ts` runs from source under `tsx`
 * outside the Nest runtime and needs to know which role is the top one; pulling
 * the guard in would have dragged the whole DI container behind it for one
 * constant, and would have failed in the container rather than here.
 */
import { RoleCode } from './roles.enum';

/**
 * The top of the hierarchy, named once so nothing has to re-derive it.
 *
 * `ADMIN_GLOBAL` is the super admin. It is not a role that happens to be
 * powerful: it implies every role that guards a route, and it is the only role
 * on the three endpoints that grant, revoke and replace another user's roles -
 * so it can already appoint and unappoint administrators, including other
 * holders of itself. See `docs/adr/ADR-008-admin-global-is-the-super-admin.md`
 * for why a second all-powerful role was rejected rather than added, and
 * `apps/api/src/__test__/conventions/super-admin.spec.ts` for the guard that
 * fails the day either half of that stops being true.
 */
export const SUPER_ADMIN_ROLE = RoleCode.ADMIN_GLOBAL;

/**
 * Role hierarchy - each role implicitly includes all roles below it.
 *
 * ADMIN_GLOBAL > ADMIN_LANDS > AGENT > CLIENT
 *
 * Product-specific admin roles (ADMIN_KBS, ADMIN_KAMNET) are lateral -
 * they do not inherit from each other or from ADMIN_LANDS.
 *
 * Exported because the convention guard reads it: a role added to `RoleCode`
 * and then used in an `@Roles()` decorator without being added here would leave
 * a route the super admin cannot reach, which is the one way the decision in
 * ADR-008 can quietly stop holding.
 */
export const ROLE_HIERARCHY: Partial<Record<RoleCode, RoleCode[]>> = {
  [RoleCode.ADMIN_GLOBAL]: [
    RoleCode.ADMIN_LANDS,
    RoleCode.ADMIN_KBS,
    RoleCode.ADMIN_KAMNET,
    RoleCode.AGENT,
    RoleCode.CLIENT,
    RoleCode.KCA_CERTIFIED,
    RoleCode.CANDIDATE_KBS,
    // I7 (15 September): VERIFY is operated by STAFF_VERIFY, and the super admin
    // inherits it like every other administration. Listed here, on ADMIN_GLOBAL
    // itself: `effectiveRoles` expands one level, so it reaches nobody else.
    RoleCode.STAFF_VERIFY,
  ],
  [RoleCode.ADMIN_LANDS]: [RoleCode.AGENT, RoleCode.CLIENT],
  [RoleCode.ADMIN_KBS]: [RoleCode.CANDIDATE_KBS],
  [RoleCode.AGENT]: [RoleCode.CLIENT],
};

/** Returns the full set of effective roles for the given assigned roles. */
export function effectiveRoles(assigned: string[]): Set<string> {
  const result = new Set<string>(assigned);
  for (const role of assigned) {
    const implied = ROLE_HIERARCHY[role as RoleCode] ?? [];
    for (const r of implied) result.add(r);
  }
  return result;
}
