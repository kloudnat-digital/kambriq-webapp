import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { RequestUser } from '../types/user-payload.type';
import { RoleCode } from '../types/roles.enum';

/** Extracts authenticated `RequestUser` from the execution context. */
export const CurrentUser = createParamDecorator(
  (data: keyof RequestUser | undefined, ctx: ExecutionContext): RequestUser | string | string[] => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as RequestUser;
    return data ? user?.[data] : user;
  },
);

/** Attaches required roles metadata to the route handler. */
export const ROLES_KEY = 'KROLES';
export const Roles = (...roles: RoleCode[]) => SetMetadata(ROLES_KEY, roles);

/** Marks route as public, bypassing JWT authentication guards. */
export const IS_PUBLIC_KEY = 'IS_PUBLIC';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
