import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Enforces strict usage of the design system palette.
 *
 * Prevents the introduction of Tailwind utility classes (e.g., `gray-*`, `white`)
 * that fall outside the defined `@theme` palette in `globals.css`.
 * Any deviation bypasses the design system and creates hardcoded visual drift.
 */
const HERE = __dirname;

/** Permitted design system families defined in `globals.css`. */
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

/** Strips comments to prevent the regex from falsely flagging documentation. */
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

  /** Verifies that the regex accurately discriminates code from prose. */
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
