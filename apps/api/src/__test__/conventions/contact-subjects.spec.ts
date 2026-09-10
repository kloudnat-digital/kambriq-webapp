import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CONTACT_SUBJECTS, ContactSubject } from '@kambriq/common';

/**
 * The six contact subjects are written down three times, and all three must
 * agree.
 *
 * - `ContactSubject` in `libs/common/src/constants/core` - what the API accepts
 *   and the form offers;
 * - `enum ContactSubject` in `prisma/core/schema.prisma` - what the column will
 *   hold;
 * - a label per subject in each web i18n catalogue - what a person reads.
 *
 * They cannot be one list. The enum is hand-written rather than imported from
 * the generated Prisma client because **the web imports it**, and a generated
 * client cannot cross into a browser bundle. The labels cannot be derived from
 * the codes: `'KBS'.toLowerCase()` is not "Formation KBS".
 *
 * So three copies, and this is what stops them drifting. The failure mode
 * without it is quiet in both directions: a subject added to the enum and not
 * to the catalogue renders its own key to a prospect, and one added to the
 * schema and not the enum is a value the API can never send.
 */
const ROOT = join(__dirname, '..', '..', '..', '..', '..');

const prismaSchema = readFileSync(join(ROOT, 'prisma', 'core', 'schema.prisma'), 'utf8');

const messages = (lang: 'fr' | 'en') =>
  JSON.parse(
    readFileSync(join(ROOT, 'apps', 'web', 'src', 'i18n', 'messages', `${lang}.json`), 'utf8'),
  ) as { contact: { form: { subjects: Record<string, string> } } };

/** The members of one `enum X { ... }` block in a Prisma schema. */
const prismaEnumMembers = (name: string): string[] => {
  const block = new RegExp(`enum ${name} \\{([^}]*)\\}`).exec(prismaSchema)?.[1];
  if (!block) throw new Error(`enum ${name} not found in prisma/core/schema.prisma`);
  return block
    .split('\n')
    .map((l) => l.replace(/\/\/.*$/, '').trim())
    .filter((l) => l.length > 0 && !l.startsWith('///'));
};

describe('the contact subjects agree everywhere they are written down', () => {
  it('is reading the schema it thinks it is', () => {
    // A regex that matched nothing would make every assertion below vacuous.
    expect(prismaSchema).toContain('model ContactRequest');
    expect(prismaEnumMembers('ContactSubject').length).toBeGreaterThan(0);
  });

  it('the TypeScript enum and the Prisma enum have the same members', () => {
    expect(prismaEnumMembers('ContactSubject').sort()).toEqual(
      Object.values(ContactSubject).sort(),
    );
  });

  it('the ordered list offers every member, and nothing else', () => {
    // `CONTACT_SUBJECTS` is what the form maps over. A member missing from it
    // is a subject nobody can choose, with nothing to say so.
    expect([...CONTACT_SUBJECTS].sort()).toEqual(Object.values(ContactSubject).sort());
  });

  it.each(['fr', 'en'] as const)('%s has a label for every subject', (lang) => {
    const labels = messages(lang).contact.form.subjects;
    for (const subject of CONTACT_SUBJECTS) {
      const key = subject.toLowerCase();
      expect(typeof labels[key]).toBe('string');
      expect(labels[key].trim().length).toBeGreaterThan(0);
      // And the label is not the code with different capitals.
      expect(labels[key]).not.toBe(subject);
    }
  });

  it.each(['fr', 'en'] as const)('%s has no label for a subject that does not exist', (lang) => {
    // The other direction. A leftover label is a menu entry the API refuses.
    const known = new Set(CONTACT_SUBJECTS.map((s) => s.toLowerCase()));
    expect(Object.keys(messages(lang).contact.form.subjects).filter((k) => !known.has(k))).toEqual(
      [],
    );
  });

  it('the status enum agrees with the schema too', () => {
    expect(prismaEnumMembers('ContactRequestStatus').sort()).toEqual(
      ['CLOSED', 'IN_PROGRESS', 'NEW'].sort(),
    );
  });
});
