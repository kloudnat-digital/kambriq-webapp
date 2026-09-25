import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseTitleNumber } from '@kambriq/common/lands/title-number';
import fr from '@/i18n/messages/fr.json';
import en from '@/i18n/messages/en.json';
import { CreateLandFormResolver, CREATE_LAND_DEFAULTS } from './lands';

/**
 * P24 - the land form refuses a title number that is not shaped like one, as a
 * courtesy: the API holds the same rule (`apps/api/.../title-number.spec.ts`)
 * and is the one that decides. Same parser, one module, so the two cannot
 * disagree about what a title looks like.
 */
const form = (titleNumber: string) =>
  CreateLandFormResolver.safeParse({
    ...CREATE_LAND_DEFAULTS,
    title: 'Parcelle',
    description: 'Une parcelle de test',
    sizeM2: 500,
    price: 1_000_000,
    labelId: 'label',
    titleNumber,
  });

describe('P24 - the land form', () => {
  it('accepts a well-formed title, however it was typed', () => {
    expect(form('TF 4129/M').success).toBe(true);
    expect(form(' tf4129 / sm').success).toBe(true);
  });

  it('accepts a department code nobody has listed', () => {
    expect(form('TF 77/XQZ').success).toBe(true);
  });

  it('accepts no title at all', () => {
    expect(form('').success).toBe(true);
  });

  it('refuses the format the verify page used to show, with a message that exists in both languages', () => {
    const r = form('TF-12345-ABCD');
    expect(r.success).toBe(false);
    const key = r.error?.issues.find((i) => i.path[0] === 'titleNumber')?.message;
    expect(key).toBe('titleNumberInvalid');
    for (const messages of [fr, en]) {
      expect(messages.landsAdmin.form.titleNumberInvalid).toContain('{example}');
    }
  });
});

describe('P24 - the title shown as an example', () => {
  it.each([
    ['fr', fr],
    ['en', en],
  ] as const)('%s: is in the translations and well formed', (_locale, messages) => {
    const example = messages.products.verify.heroCard.tfExample;
    expect(parseTitleNumber(example)?.canonical).toBe(example);
  });
});

/**
 * Four invented formats were found in the web source - `TF-12345-ABCD` on the
 * public verify page, `TF/MFOUNDI/2024/0421` as the form's placeholder and in two
 * back-office mocks. Every literal shaped like a title must now be one.
 */
describe('P24 - no invented title format left in the web source', () => {
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
    );
  const SRC = join(__dirname, '..', '..');

  it('every title-shaped string literal parses as a title', () => {
    const bad = walk(SRC)
      .filter((f) => /\.tsx?$/.test(f) && !/\.spec\.tsx?$/.test(f))
      .flatMap((f) =>
        [...readFileSync(f, 'utf8').matchAll(/['"`>](TF[\s/_-]?[\w/ -]*?\d[\w/ -]*)['"`<]/g)]
          .map((m) => m[1])
          .filter((t) => parseTitleNumber(t)?.canonical !== t)
          .map((t) => `${f.slice(SRC.length + 1)}: ${t}`),
      );
    expect(bad).toEqual([]);
  });
});
