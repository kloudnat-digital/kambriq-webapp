import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import { RequestUser } from '../types/user-payload.type';

/**
 * @CurrentUser() - Extracts authenticated user from request
 * Usage: @CurrentUser() user: RequestUser
 */
export const CurrentUser = createParamDecorator(
  (
    data: keyof RequestUser | undefined,
    ctx: ExecutionContext,
  ): RequestUser | string | string[] => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as RequestUser;
    return data ? user?.[data] : user;
  },
);

/**
 * @Roles(...roles) - Sets required roles metadata
 * Usage: @Roles(RoleCode.ADMIN, RoleCode.ADMIN_KBS)
 */
export const ROLES_KEY = 'KROLES';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

/**
 * @Public() - Marks route as public (no JWT required)
 * Usage: @Public()
 */
export const IS_PUBLIC_KEY = 'IS_PUBLIC';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
