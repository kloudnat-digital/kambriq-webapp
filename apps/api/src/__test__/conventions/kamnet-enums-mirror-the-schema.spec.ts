import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  KamnetAgentTier,
  KamnetApplicationStatus,
  KamnetCommissionStatus,
  KamnetLeadSource,
  KamnetLeadStatus,
  KamnetReservationStatus,
} from '@kambriq/common';

/**
 * The six KAMNET enums are written down twice, and both copies must agree.
 *
 * - `enum X { ... }` in `prisma/kamnet/schema.prisma` - what the column holds;
 * - `const X` in `libs/common/src/constants/kamnet/enums.ts` - what the API
 *   accepts and, crucially, what the **web** imports.
 *
 * They cannot be one list. The generated Prisma client is gitignored and is
 * produced by `postinstall`, which `docker/Dockerfile.web` skips
 * (`--ignore-scripts`, no `prisma generate`, no `prisma/` copied). Re-exporting
 * the generated enums therefore broke the web image while every local gate
 * stayed green - `typecheck:web`, `lint:web`, 300 unit tests and CI's `Quality`
 * job all have the generated client on disk.
 *
 * So two copies, and this is what stops them drifting. The failure mode without
 * it is quiet in both directions: a member added to the schema and not here is
 * a value the API can never send, and one added here and not to the schema is a
 * value the database will refuse at write time, in production, on whichever row
 * first uses it.
 *
 * Same shape and same reasoning as `contact-subjects.spec.ts`, which pins
 * `ContactSubject` across its three copies for the identical reason.
 */
const ROOT = join(__dirname, '..', '..', '..', '..', '..');
const SCHEMA_PATH = join(ROOT, 'prisma', 'kamnet', 'schema.prisma');
const schema = readFileSync(SCHEMA_PATH, 'utf8');

/** The members of one `enum X { ... }` block in a Prisma schema. */
const prismaEnumMembers = (name: string): string[] => {
  const block = new RegExp(`enum ${name} \\{([^}]*)\\}`).exec(schema)?.[1];
  if (!block) throw new Error(`enum ${name} not found in prisma/kamnet/schema.prisma`);
  return block
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, '').trim())
    .filter((line) => line.length > 0 && !line.startsWith('///'))
    .sort();
};

const PAIRS: ReadonlyArray<readonly [string, Record<string, string>]> = [
  ['KamnetAgentTier', KamnetAgentTier],
  ['KamnetApplicationStatus', KamnetApplicationStatus],
  ['KamnetCommissionStatus', KamnetCommissionStatus],
  ['KamnetLeadSource', KamnetLeadSource],
  ['KamnetLeadStatus', KamnetLeadStatus],
  ['KamnetReservationStatus', KamnetReservationStatus],
];

describe('the KAMNET enums agree with the schema they mirror', () => {
  it('is reading the schema it thinks it is', () => {
    // A regex that matched nothing would make every assertion below vacuous -
    // the defect this repository calls "a gate that refuses everything proves
    // nothing about what it lets through", in its cheapest form.
    expect(schema).toContain('model KamnetAgent');
    expect(schema).toContain('model KamnetLead');
    for (const [name] of PAIRS) {
      expect(prismaEnumMembers(name).length).toBeGreaterThan(0);
    }
  });

  it.each(PAIRS.map(([name]) => name))('%s has the same members as the schema', (name) => {
    const pair = PAIRS.find(([n]) => n === name);
    if (!pair) throw new Error(`no TypeScript copy registered for ${name}`);
    const [, ts] = pair;

    expect(Object.keys(ts).sort()).toEqual(prismaEnumMembers(name));
  });

  it.each(PAIRS.map(([name]) => name))('%s maps every member to its own name', (name) => {
    // A Prisma enum's stored value IS its member name. A mirror whose value
    // differed from its key would typecheck, satisfy the test above, and write
    // a string the column refuses.
    const pair = PAIRS.find(([n]) => n === name);
    if (!pair) throw new Error(`no TypeScript copy registered for ${name}`);
    const [, ts] = pair;

    for (const [key, value] of Object.entries(ts)) {
      expect(value).toBe(key);
    }
  });

  it('every enum in the schema has a TypeScript copy registered here', () => {
    // The direction that rots silently: somebody adds an enum to the schema,
    // nothing here mentions it, and this file keeps passing while the web has
    // no way to name the new values.
    const inSchema = [...schema.matchAll(/enum (\w+) \{/g)].map((m) => m[1]).sort();
    const registered = PAIRS.map(([name]) => name).sort();

    expect(registered).toEqual(inSchema);
  });
});
