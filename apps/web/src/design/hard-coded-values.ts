/**
 * J15 - what counts as a value written in place of a design token.
 *
 * The design tokens in `app/globals.css` are the only source of colour,
 * typography and spacing. These patterns find the ways a value bypasses them
 * in a Tailwind class or an inline style; `design-tokens-only.spec.ts` refuses
 * any it finds that `design-debt.ts` does not declare.
 *
 * Inverted, like C44's host list: a colour family is allowed only if the
 * system defines it, so a family nobody has thought of yet is refused too.
 */

/** The colour families `globals.css` defines. Anything else is outside the system. */
export const SYSTEM_FAMILIES: readonly string[] = [
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
];

/** Every Tailwind utility that takes a colour. */
const COLOUR_UTILITIES =
  'bg|text|border|ring|from|via|to|fill|stroke|divide|outline|shadow|decoration|placeholder|accent|caret';

export type HardCodedKind =
  | 'colour-class'
  | 'arbitrary-colour'
  | 'arbitrary-spacing'
  | 'arbitrary-typography'
  | 'inline-style';

const STEPPED = new RegExp(`\\b(?:${COLOUR_UTILITIES})-([a-z]+)-(\\d{2,3})\\b`, 'g');
const PLAIN = new RegExp(`\\b(?:${COLOUR_UTILITIES})-(?:white|black)\\b`, 'g');
const ARBITRARY_COLOUR = new RegExp(
  `\\b(?:${COLOUR_UTILITIES})-\\[(?:#|rgb|hsl|oklch|color:)[^\\]]*\\]`,
  'g',
);
const ARBITRARY_SPACING =
  /(?<![\w-])-?(?:p|px|py|pt|pr|pb|pl|ps|pe|m|mx|my|mt|mr|mb|ml|ms|me|gap|gap-x|gap-y|space-x|space-y)-\[[^\]]+\]/g;
const ARBITRARY_TYPOGRAPHY = /\b(?:font|leading|tracking)-\[[^\]]+\]|\btext-\[\d[^\]]*\]/g;
const INLINE_STYLE =
  /style=\{\{[^}]*\b(?:color|background|backgroundColor|borderColor|fontFamily|fontSize|fontWeight|margin\w*|padding\w*|gap)\s*:/g;

/** Removes comments, so a value named in prose is not counted as one used in code. */
export const withoutComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

/** Every hard-coded value in a source file, by kind. */
export const hardCodedIn = (source: string): Record<HardCodedKind, number> => {
  const code = withoutComments(source);
  const count = (rx: RegExp) => [...code.matchAll(rx)].length;
  return {
    'colour-class':
      [...code.matchAll(STEPPED)].filter(([, family]) => !SYSTEM_FAMILIES.includes(family)).length +
      count(PLAIN),
    'arbitrary-colour': count(ARBITRARY_COLOUR),
    'arbitrary-spacing': count(ARBITRARY_SPACING),
    'arbitrary-typography': count(ARBITRARY_TYPOGRAPHY),
    'inline-style': count(INLINE_STYLE),
  };
};
