import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators';
import { RequestUser } from '../types/user-payload.type';
import { effectiveRoles } from '../types/role-hierarchy';

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
