import { BadRequestException } from '@nestjs/common';
import { RoleCode } from '@kambriq/common';

/**
 * I15 - roles that reflect a record, and are therefore not an admin setting.
 *
 * KCA_CERTIFIED is a projection of the KCA certificate: granted when it is
 * issued, withdrawn when it is revoked or expires (`KbsCertificatesService`).
 * Granting or removing it by hand makes the role and the register disagree -
 * somebody treated as certified whose number `/verify-certificate` answers
 * "non reconnu" for, or the reverse.
 *
 * Keyed by role code, valued by what to do instead. The admin role doors
 * (grant, revoke, replace) consult it; the service that owns the record calls
 * `UsersService.addRole` / `removeRole` directly and is unaffected.
 */
export const RECORD_DERIVED_ROLES: ReadonlyMap<string, string> = new Map([
  [RoleCode.KCA_CERTIFIED, 'issue or revoke the KCA certificate in the KBS administration instead'],
]);

export const assertNotRecordDerived = (roleCode: string): void => {
  const instead = RECORD_DERIVED_ROLES.get(roleCode);
  if (instead) {
    throw new BadRequestException(
      `${roleCode} follows a record and cannot be granted or removed by hand: ${instead}.`,
    );
  }
};
