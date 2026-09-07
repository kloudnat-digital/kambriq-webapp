import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import {
  formatReferenceWithChannel,
  PaymentChannel,
  REFERENCE_CHANNEL_SEPARATOR,
} from '@kambriq/common';

/**
 * **The channel never enters the reference.**
 *
 * v03 section 5 refuses it with a reason: a reference must be stable. A client
 * announces mobile money, changes their mind and makes a transfer - which will
 * happen often. If the channel is inside the identifier you must either issue a
 * second reference, and two references for one payment is exactly the dispute
 * this format exists to prevent, or leave the first one lying.
 *
 * Where a person reads both, the code goes **after a separator that cannot pass
 * for one more segment**:
 *
 *     KBQ-2609-7F3K2-B · OMO      correct
 *     KBQ-2609-7F3K2-B-OMO        forbidden
 *
 * The reference is four hyphen-separated segments. A fifth, appended with the
 * same character, reads as part of it - and the check character is computed over
 * the first four, so a reference with a channel glued on fails validation while
 * looking entirely reasonable to whoever typed it.
 */
const ROOT = join(__dirname, '..', '..', '..', '..', '..');

const SEARCHED = [
  join(ROOT, 'apps', 'api', 'src'),
  join(ROOT, 'apps', 'web', 'src'),
  join(ROOT, 'libs', 'common', 'src'),
];

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((e) => {
    if (e === 'node_modules' || e === '.next' || e === 'prisma' || e === '__test__') return [];
    const f = join(dir, e);
    return statSync(f).isDirectory() ? walk(f) : ['.ts', '.tsx'].includes(extname(e)) ? [f] : [];
  });

const stripComments = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const FILES = SEARCHED.flatMap(walk).map((f) => ({
  path: relative(ROOT, f),
  src: stripComments(readFileSync(f, 'utf8')),
}));

const CODES = Object.values(PaymentChannel);

describe('the channel is never concatenated into a reference', () => {
  it('is reading the source it thinks it is', () => {
    expect(FILES.length).toBeGreaterThan(50);
    expect(FILES.some((f) => f.src.includes('buildReference'))).toBe(true);
  });

  it('the sanctioned formatter puts the code after a separator, not a hyphen', () => {
    const out = formatReferenceWithChannel('KBQ-2609-7F3K2-B', PaymentChannel.OMO);

    expect(out).toBe('KBQ-2609-7F3K2-B · OMO');
    expect(out).not.toBe('KBQ-2609-7F3K2-B-OMO');
    // The separator itself must not be a hyphen, however it is spelled.
    expect(REFERENCE_CHANNEL_SEPARATOR).not.toMatch(/-/);
    expect(REFERENCE_CHANNEL_SEPARATOR.trim()).toBe('·');
  });

  it('the formatted string still contains the reference untouched', () => {
    // The point of a separator rather than a rewrite: the reference can still be
    // read out of it, character for character.
    const out = formatReferenceWithChannel('KBQ-2609-7F3K2-B', PaymentChannel.MOMO);
    expect(out.split(REFERENCE_CHANNEL_SEPARATOR)[0]).toBe('KBQ-2609-7F3K2-B');
  });

  it.each(CODES)('no template literal glues %s onto a reference with a hyphen', (code) => {
    /**
     * The shape that is banned: a reference-bearing expression followed
     * immediately by `-` and the code, in a template literal or a concatenation.
     */
    const patterns = [
      new RegExp(String.raw`\$\{[^}]*[Rr]eference[^}]*\}\s*-\s*${code}\b`),
      new RegExp(String.raw`[Rr]eference\s*\+\s*['"\`]-${code}`),
      new RegExp(String.raw`['"\`]-\$\{[^}]*${code}`),
    ];

    const offenders = FILES.filter((f) => patterns.some((p) => p.test(f.src))).map((f) => f.path);
    expect(offenders).toEqual([]);
  });

  it('nothing appends a channel to a reference except the one formatter', () => {
    // `reference` and a channel in the same template literal, with anything
    // other than the sanctioned separator between them.
    const banned = /\$\{[^}]*[Rr]eference[^}]*\}[^`$]{0,4}\$\{[^}]*[Cc]hannel[^}]*\}/;

    const offenders = FILES.filter(
      (f) => !f.path.endsWith('payment-channels.ts') && banned.test(f.src),
    ).map((f) => f.path);

    expect(offenders).toEqual([]);
  });

  it('the reference generator knows nothing about channels', () => {
    // The strongest form: the file that builds references cannot mention them.
    const generator = FILES.find((f) => f.path.endsWith('payments/payment-reference.ts'));
    if (!generator) {
      throw new Error('payment-reference.ts not found - this sweep is looking in the wrong place');
    }
    for (const code of CODES) {
      expect(generator.src).not.toContain(code);
    }
    expect(generator.src).not.toContain('channel');
  });
});
