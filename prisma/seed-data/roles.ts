/* eslint-disable @nx/enforce-module-boundaries -- the seed lives in prisma/, outside any nx project, like seed.ts */
import { RoleCode } from '../../libs/common/src/types/roles.enum';

/**
 * I19 - the role rows the seed writes: one per `RoleCode`, no fewer.
 *
 * The seed wrote 8 rows for an enum of 11. `addRole` refuses a code that has no
 * row, so STAFF_VERIFY, STAFF_VALUATION and PARTNER_GEO could be neither granted
 * nor held: the admin grant endpoint refused them, and the first route guarded
 * by one of them would have been reachable by nobody.
 *
 * The list lives here rather than inside `seed.ts` so a test can hold it against
 * the enum without running the seed (`seed-roles.spec.ts`).
 */
export interface SeedRole {
  id: string;
  code: RoleCode;
  name: string;
  description: string;
}

export const SEED_ROLES: SeedRole[] = [
  {
    id: '00000000-0000-4000-8000-a00000000001',
    code: RoleCode.ADMIN_GLOBAL,
    name: 'Global Administrator',
    description: 'Full platform access',
  },
  {
    id: '00000000-0000-4000-8000-a00000000002',
    code: RoleCode.CLIENT,
    name: 'Client',
    description: 'Portal access for land buyers',
  },
  {
    id: '00000000-0000-4000-8000-a00000000003',
    code: RoleCode.CANDIDATE_KBS,
    name: 'KBS Candidate',
    description: 'Enrolled in KBS training',
  },
  {
    id: '00000000-0000-4000-8000-a00000000004',
    code: RoleCode.KCA_CERTIFIED,
    name: 'KCA Certified',
    description: 'Holds a valid KCA certificate',
  },
  {
    id: '00000000-0000-4000-8000-a00000000005',
    code: RoleCode.AGENT,
    name: 'KAMNET Agent',
    description: 'Certified commercial agent',
  },
  {
    id: '00000000-0000-4000-8000-a00000000006',
    code: RoleCode.ADMIN_KBS,
    name: 'KBS Administrator',
    description: 'Manages courses, exams and certificates',
  },
  {
    id: '00000000-0000-4000-8000-a00000000007',
    code: RoleCode.ADMIN_KAMNET,
    name: 'KAMNET Administrator',
    description: 'Manages agents and commissions',
  },
  {
    id: '00000000-0000-4000-8000-a00000000008',
    code: RoleCode.ADMIN_LANDS,
    name: 'LANDS Administrator',
    description: 'Manages land inventory and reservations',
  },
  // The three below guard no route and gate no screen yet. The rows exist so the
  // roles can be granted, held and revoked like the others.
  {
    id: '00000000-0000-4000-8000-a00000000009',
    code: RoleCode.STAFF_VERIFY,
    name: 'VERIFY Staff',
    description: 'Operates the VERIFY module (land titles, identity documents)',
  },
  {
    id: '00000000-0000-4000-8000-a00000000010',
    code: RoleCode.STAFF_VALUATION,
    name: 'VALUATION Staff',
    description: 'Reserved for the VALUATION module',
  },
  {
    id: '00000000-0000-4000-8000-a00000000011',
    code: RoleCode.PARTNER_GEO,
    name: 'Geo Partner',
    description: 'Reserved for geospatial partners',
  },
];

/** The id of a seeded role row. Throws for a code the list above does not carry. */
export const seedRoleId = (code: RoleCode): string => {
  const row = SEED_ROLES.find((r) => r.code === code);
  if (!row) throw new Error(`The seed has no row for role ${code}`);
  return row.id;
};
