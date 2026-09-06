import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators';
import { RequestUser } from '../types/user-payload.type';
import { RoleCode } from '../types/roles.enum';

/**
 * Role hierarchy - each role implicitly includes all roles below it.
 *
 * ADMIN_GLOBAL > ADMIN_LANDS > AGENT > CLIENT
 *
 * Product-specific admin roles (ADMIN_KBS, ADMIN_KAMNET) are lateral -
 * they do not inherit from each other or from ADMIN_LANDS.
 */
const ROLE_HIERARCHY: Partial<Record<RoleCode, RoleCode[]>> = {
  /**
   * ADMIN_GLOBAL is the super admin, and this list is what makes that true.
   *
   * It must contain **every** other role in `RoleCode`. It did not:
   * `STAFF_VERIFY`, `STAFF_VALUATION` and `PARTNER_GEO` were absent. Nothing
   * gates on them today, so the gap was invisible - but the day somebody writes
   * `@Roles(RoleCode.STAFF_VERIFY)`, the global administrator is refused by it
   * and the refusal looks like a bug in the guard rather than a hole in this
   * list. `roles.guard.spec.ts` now fails if a role is added to the enum and not
   * to this list.
   */
  [RoleCode.ADMIN_GLOBAL]: [
    RoleCode.ADMIN_LANDS,
    RoleCode.ADMIN_KBS,
    RoleCode.ADMIN_KAMNET,
    RoleCode.AGENT,
    RoleCode.CLIENT,
    RoleCode.KCA_CERTIFIED,
    RoleCode.CANDIDATE_KBS,
    RoleCode.STAFF_VERIFY,
    RoleCode.STAFF_VALUATION,
    RoleCode.PARTNER_GEO,
  ],
  [RoleCode.ADMIN_LANDS]: [RoleCode.AGENT, RoleCode.CLIENT],
  [RoleCode.ADMIN_KBS]: [RoleCode.CANDIDATE_KBS],
  [RoleCode.AGENT]: [RoleCode.CLIENT],
};

/** Returns the full set of effective roles for the given assigned roles. */
function effectiveRoles(assigned: string[]): Set<string> {
  const result = new Set<string>(assigned);
  for (const role of assigned) {
    const implied = ROLE_HIERARCHY[role as RoleCode] ?? [];
    for (const r of implied) result.add(r);
  }
  return result;
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as RequestUser;

    if (!user || !user.roles) {
      throw new ForbiddenException('Access denied: No roles assigned');
    }

    const effective = effectiveRoles(user.roles);
    const hasRole = requiredRoles.some((role) => effective.has(role));

    if (!hasRole) {
      throw new ForbiddenException('Access denied: Insufficient role');
    }

    return true;
  }
}
