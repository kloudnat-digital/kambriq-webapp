import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../../guards/roles.guard';
import { RoleCode } from '../../types/roles.enum';

const createMockContext = (userRoles: string[] | null): ExecutionContext => {
  const request = {
    user: userRoles ? { id: 'u1', email: 'test@test.com', roles: userRoles, lang: 'fr' } : null,
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
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([RoleCode.ADMIN_KBS]);
    const ctx = createMockContext([RoleCode.ADMIN_KBS]);

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows ADMIN_GLOBAL to bypass any role requirement', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([RoleCode.ADMIN_KBS]);
    const ctx = createMockContext([RoleCode.ADMIN_GLOBAL]);

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('throws ForbiddenException when user lacks required role', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([RoleCode.ADMIN_KBS]);
    const ctx = createMockContext(['CLIENT']);

    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when user has no roles at all', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([RoleCode.ADMIN_KBS]);
    const ctx = createMockContext(null);

    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});

/**
 * ADMIN_GLOBAL is the super admin. This is the test that keeps it true.
 *
 * H1 asked whether a SUPER_ADMIN tier was needed. Reading the code said no:
 * `@Roles(RoleCode.ADMIN_GLOBAL)` already gates grant, revoke and the
 * destructive replace, and `addRole`/`removeRole` accept any role code with no
 * restriction - so ADMIN_GLOBAL can already grant and revoke ADMIN_GLOBAL
 * itself. A second all-powerful role beside it would be two god roles, and the
 * second one always drifts out of step with the first.
 *
 * What reading *did* find was a hole in the hierarchy: three roles existed in
 * the enum and not in ADMIN_GLOBAL's implied list. Nothing gates on them today,
 * so nothing failed. The trap is the day somebody writes
 * `@Roles(RoleCode.STAFF_VERIFY)` and the global administrator is refused by it.
 *
 * This test is the guard on that. Add a role to the enum without adding it to
 * the hierarchy and it fails here, at the moment the role is created, rather
 * than months later at the moment it is first used.
 */
describe('ADMIN_GLOBAL implies every other role', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  const allRoles = Object.values(RoleCode).filter((r) => r !== RoleCode.ADMIN_GLOBAL);

  it('knows what the roles are', () => {
    // A sweep over an empty list would make the assertion below vacuous.
    expect(allRoles.length).toBeGreaterThanOrEqual(10);
    expect(allRoles).toContain(RoleCode.STAFF_VERIFY);
  });

  it.each(allRoles)('an ADMIN_GLOBAL passes a guard requiring %s', (role) => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([role]);
    const ctx = createMockContext([RoleCode.ADMIN_GLOBAL]);
    expect(guard.canActivate(ctx)).toBe(true);
  });
});
