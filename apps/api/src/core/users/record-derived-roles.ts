import { BadRequestException } from '@nestjs/common';
import { RoleCode } from '@kambriq/common';

/**
 * Defines roles that are strictly derived from system records and cannot be managed manually.
 * Ensures data consistency by preventing direct admin modifications (grant, revoke, replace).
 * Keys represent role codes, values provide actionable instructions for modification.
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
