import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../../guards/roles.guard';
import { RoleCode } from '../../types/roles.enum';

const createMockContext = (userRoles: string[] | null): ExecutionContext => {
  const request = {
    user: userRoles
      ? { id: 'u1', email: 'test@test.com', roles: userRoles, lang: 'fr' }
      : null,
  };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => jest.fn(),
    getClass: () => jest.fn(),
  } as unknown as ExecutionContext;
};

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  it('allows access when no @Roles() decorator is set', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const ctx = createMockContext(['CLIENT']);

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows access when user has a required role', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([RoleCode.ADMIN_KBS]);
    const ctx = createMockContext([RoleCode.ADMIN_KBS]);

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows ADMIN_GLOBAL to bypass any role requirement', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([RoleCode.ADMIN_KBS]);
    const ctx = createMockContext([RoleCode.ADMIN_GLOBAL]);

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('throws ForbiddenException when user lacks required role', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([RoleCode.ADMIN_KBS]);
    const ctx = createMockContext(['CLIENT']);

    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when user has no roles at all', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([RoleCode.ADMIN_KBS]);
    const ctx = createMockContext(null);

    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});
