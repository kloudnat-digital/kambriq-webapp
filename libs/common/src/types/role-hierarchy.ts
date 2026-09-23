/**
 * Defines the application's role hierarchy independently to avoid unnecessary
 * dependencies on the NestJS runtime context.
 */
import { RoleCode } from './roles.enum';

/**
 * The highest privilege role in the hierarchy.
 * Represents a super administrator with implicit access to all protected routes
 * and role management endpoints.
 */
export const SUPER_ADMIN_ROLE = RoleCode.ADMIN_GLOBAL;

/**
 * Role hierarchy mapping.
 * Each role implicitly includes all roles in its assigned array.
 *
 * Hierarchy structure:
 * - ADMIN_GLOBAL > ADMIN_LANDS > AGENT > CLIENT
 * - Product-specific admin roles (ADMIN_KBS, ADMIN_KAMNET) are lateral and do not inherit from each other.
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
    // Inherited exclusively by ADMIN_GLOBAL.
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
