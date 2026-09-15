import { BadRequestException } from '@nestjs/common';
import { RoleCode } from '@kambriq/common';
import { UserController } from '../../../core/users/users.controller';

/**
 * I15 - the single-role doors refuse KCA_CERTIFIED.
 *
 * `POST /users/:id/roles` granted any role that has a row, so an ADMIN_GLOBAL
 * could make somebody "certified" with no certificate behind it - exactly the
 * person `/verify-certificate` would answer "non reconnu" for. The role follows
 * the certificate: issue or revoke the certificate instead.
 */
describe('UserController - roles that follow a record', () => {
  const admin = { id: 'admin-1' } as never;
  let usersService: { addRole: jest.Mock; removeRole: jest.Mock; findById: jest.Mock };
  let controller: UserController;

  beforeEach(() => {
    usersService = {
      addRole: jest.fn(),
      removeRole: jest.fn(),
      findById: jest.fn().mockResolvedValue({ id: 'u1' }),
    };
    controller = new UserController(usersService as never, {} as never);
  });

  it('refuses to grant KCA_CERTIFIED by hand', async () => {
    await expect(
      controller.grantRole('u1', { roleCode: RoleCode.KCA_CERTIFIED }, admin),
    ).rejects.toThrow(BadRequestException);
    expect(usersService.addRole).not.toHaveBeenCalled();
  });

  it('refuses to revoke KCA_CERTIFIED by hand', async () => {
    await expect(controller.revokeRole('u1', RoleCode.KCA_CERTIFIED, admin)).rejects.toThrow(
      BadRequestException,
    );
    expect(usersService.removeRole).not.toHaveBeenCalled();
  });

  it('still grants and revokes an ordinary role', async () => {
    await controller.grantRole('u1', { roleCode: RoleCode.ADMIN_KBS }, admin);
    await controller.revokeRole('u1', RoleCode.ADMIN_KBS, admin);

    expect(usersService.addRole).toHaveBeenCalledWith('u1', RoleCode.ADMIN_KBS, 'admin-1');
    expect(usersService.removeRole).toHaveBeenCalledWith('u1', RoleCode.ADMIN_KBS);
  });
});
