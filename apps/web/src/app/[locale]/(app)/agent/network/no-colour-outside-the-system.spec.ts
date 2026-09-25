import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Not one new colour class outside the design system.
 *
 * Step 0 re-anchored `globals.css` on the brand palette and, in doing so,
 * measured what the re-anchoring does NOT reach: 1226 occurrences of 75
 * distinct Tailwind colour classes in `apps/web/src`, 734 of them `gray-*`.
 * A `text-gray-500` renders the same grey before and after, so every one of
 * them is a place the design system does not actually govern.
 *
 * The constraint on this PR is therefore directional rather than absolute: the
 * count in a file it touches must go DOWN, never up. `/agent/network/page.tsx`
 * carried nine - `gray-400` x3, `gray-900` x2, `gray-200`, `gray-600`,
 * `gray-500`, `white` - and this pins it at zero.
 *
 * Why a test rather than a review note: the failure is silent. A `bg-white`
 * typed into a new component looks right on the day it is written and stops
 * matching the system the day the system moves, which is exactly what step 0
 * just did. The same reasoning as `brand-palette.spec.ts`, one layer up: that
 * one bans a hex, this one bans a palette that is not ours.
 */
const HERE = __dirname;

/**
 * The families the design system owns, from the `@theme` block in
 * `globals.css`: four eleven-step scales plus the semantic role tokens.
 * Anything else is Tailwind's default palette, which is not KAMBRIQ's.
 */
const SYSTEM_FAMILIES = [
  'primary',
  'accent',
  'gold',
  'surface',
  'background',
  'foreground',
  'card',
  'muted',
  'border',
  'input',
  'ring',
  'secondary',
  'destructive',
  'success',
  'warning',
] as const;

/** Every Tailwind utility that takes a colour. */
const COLOUR_UTILITIES = [
  'bg',
  'text',
  'border',
  'ring',
  'from',
  'via',
  'to',
  'fill',
  'stroke',
  'divide',
  'outline',
  'shadow',
  'decoration',
  'placeholder',
  'accent',
  'caret',
].join('|');

const STEPPED = new RegExp(`\\b(?:${COLOUR_UTILITIES})-([a-z]+)-(\\d{2,3})\\b`, 'g');
const PLAIN = new RegExp(`\\b(?:${COLOUR_UTILITIES})-(white|black)\\b`, 'g');

/**
 * Comments are stripped first, and this repository has paid for that lesson
 * three times: `route-guards.spec.ts` counted a comment explaining a route was
 * NOT public as a public route, and `brand-palette.spec.ts` flagged its own
 * prose naming the old hex values. A sweep that bans a token flags the code
 * explaining the ban first.
 */
const withoutComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const offendersIn = (relative: string): string[] => {
  const code = withoutComments(readFileSync(join(HERE, relative), 'utf8'));
  const found: string[] = [];
  for (const [, family, step] of code.matchAll(STEPPED)) {
    if (!SYSTEM_FAMILIES.includes(family as (typeof SYSTEM_FAMILIES)[number])) {
      found.push(`${family}-${step}`);
    }
  }
  for (const [, word] of code.matchAll(PLAIN)) found.push(word);
  return found;
};

describe('/agent/network carries no colour outside the design system', () => {
  it('page.tsx names no non-system colour class', () => {
    expect(offendersIn('page.tsx')).toEqual([]);
  });

  it('every component this page owns names no non-system colour class', () => {
    for (const file of ['network-content.tsx', 'network-empty.tsx', 'network-node.tsx']) {
      expect({ file, offenders: offendersIn(file) }).toEqual({ file, offenders: [] });
    }
  });

  /**
   * The sweep has to discriminate, or it has replaced a false positive with a
   * silent hole. A gate that refuses everything proves nothing about what it
   * admits; one that admits everything proves less.
   */
  it('still catches a non-system class in code, and forgives one only in prose', () => {
    const catches = (src: string) => {
      const code = withoutComments(src);
      return [...code.matchAll(STEPPED)]
        .filter(([, f]) => !SYSTEM_FAMILIES.includes(f as (typeof SYSTEM_FAMILIES)[number]))
        .map(([, f, s]) => `${f}-${s}`);
    };

    expect(catches('<p className="text-gray-500" />')).toEqual(['gray-500']);
    expect(catches('// it used to be text-gray-500\n')).toEqual([]);
    expect(catches('/* it used to be text-gray-500 */')).toEqual([]);
    expect(catches('<p className="text-muted-foreground" />')).toEqual([]);
    expect(catches('<p className="bg-primary-500/10" />')).toEqual([]);
  });
});
