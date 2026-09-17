import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Step 0 of the agent launch wave: the brand palette is the anchor of the
 * design system, and no component may carry a colour of its own.
 *
 * Visquis reversed the earlier arbitration on 17 September 2026. The brand
 * palette wins and the code aligns - navy, teal, gold, cream - while the
 * STRUCTURE of `globals.css` is kept whole: the same four eleven-step
 * families, the same semantic role tokens, the same six radii, the same three
 * shadows, the same two fonts. Only the anchor values change.
 *
 * Written as a test rather than left to review because the failure mode is
 * silent. A hex typed into a component renders correctly on the day it is
 * written and stops matching the system the day the system moves - which is
 * exactly what this change is. `apps/web/src/app/layout.tsx` already carried
 * `#0D1B2A` before this PR: the right colour, in the wrong place, agreeing
 * with the new palette by accident.
 *
 * The mapping, decided by Visquis: teal is the action colour and therefore
 * `primary`; navy is chrome and takes `accent`, whose anchor sits at step 800
 * because navy is a dark value; gold and cream keep their families.
 */
const ROOT = join(__dirname, '..', '..', '..', '..');
const GLOBALS = join(ROOT, 'apps', 'web', 'src', 'app', 'globals.css');

/** The four brand values, at the step each family anchors on. */
const ANCHORS: ReadonlyArray<{ token: string; value: string; name: string }> = [
  { token: '--color-primary-500', value: '#1a7a6e', name: 'teal, the action colour' },
  { token: '--color-accent-800', value: '#0d1b2a', name: 'navy, chrome' },
  { token: '--color-gold-500', value: '#b8972a', name: 'gold' },
  { token: '--color-surface-100', value: '#eeece5', name: 'cream' },
];

/**
 * The five files the brief names. Every hex in them is replaced by a token.
 *
 * `global-error.tsx` carries three, not one: `#111827`, `#4f46e5` and `#fff`.
 * The brief counted seven hex values across five files; there are eight, and
 * `#4f46e5` is an indigo belonging to no KAMBRIQ palette at all.
 */
const FILES_THAT_MUST_CARRY_NO_HEX: readonly string[] = [
  'apps/web/src/components/products/lands/search/lands-map.tsx',
  'apps/web/src/components/lands/app/land-map.tsx',
  'apps/web/src/components/app-shell/sidebar.tsx',
  'apps/web/src/app/layout.tsx',
  'apps/web/src/app/global-error.tsx',
];

/**
 * The ONE module allowed to spell a brand hex, and why it has to exist.
 *
 * Two kinds of code cannot use a token. The Mapbox markers in `lands-map.tsx`
 * and `land-map.tsx` are built imperatively and styled through
 * `style.cssText` - `lands-map.tsx` says so in its own comment, "Tailwind
 * classes don't work here". And `app/global-error.tsx` is a root error
 * boundary that renders its own `<html>`, so `globals.css` is never in scope
 * and a `var(--color-...)` would resolve to nothing; making the error page
 * depend on the stylesheet loading would make it depend on the thing that may
 * have broken.
 *
 * Same shape as `libs/common/src/types/roles.enum.ts` being the only place a
 * role code may be written: one file spells the strings, that is its whole
 * job, and the test below pins it to the anchors so the two cannot drift.
 */
const ALLOWED: readonly string[] = ['apps/web/src/lib/brand-colors.ts'];

/** `#abc`, `#abcdef`, `#abcdef12` - any CSS hex colour. */
const HEX = /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g;

/**
 * Comments are stripped before the match, and this is not a convenience.
 *
 * This repository has already paid for the lesson once: `route-guards.spec.ts`
 * counted `@Public()` by splitting on the token, and a route whose comment
 * explained that it was deliberately NOT public was counted as a public route.
 * A sweep that bans a token flags the code explaining the ban first.
 *
 * It happened here immediately. `layout.tsx` carries the sentence "this value
 * was ALREADY #0D1B2A before step 0" and `global-error.tsx` says "one of them,
 * #4f46e5, was an indigo belonging to no KAMBRIQ palette" - both true, both
 * useful to the next reader, and neither a colour the application renders.
 *
 * A literal that matters is in code, so the ban is applied to code.
 */
function withoutComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '') // block comments, including JSDoc
    .replace(/(^|[^:])\/\/.*$/gm, '$1'); // line comments, but not "https://"
}

function readGlobals(): string {
  return readFileSync(GLOBALS, 'utf8');
}

/** Relative luminance, WCAG 2.1 definition. */
function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const full =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h;
  const channel = (pair: string): number => {
    const srgb = parseInt(pair, 16) / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4);
  };
  const r = channel(full.slice(0, 2));
  const g = channel(full.slice(2, 4));
  const b = channel(full.slice(4, 6));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio, 1:1 to 21:1. */
function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Resolve a `--color-*` declaration, following one level of `var(...)`. */
function tokenValue(css: string, token: string): string | null {
  const direct = new RegExp(`${token}:\\s*(#[0-9a-fA-F]{3,8})\\s*;`).exec(css);
  if (direct) return direct[1].toLowerCase();
  const indirect = new RegExp(`${token}:\\s*var\\((--color-[a-z0-9-]+)\\)\\s*;`).exec(css);
  if (indirect) return tokenValue(css, indirect[1]);
  return null;
}

describe('the brand palette is the anchor of the design system', () => {
  it.each(ANCHORS)('anchors $token on $value ($name)', ({ token, value }) => {
    expect(tokenValue(readGlobals(), token)).toBe(value);
  });

  it('keeps the eleven-step structure on all four families', () => {
    const css = readGlobals();
    const steps = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
    for (const family of ['primary', 'accent', 'gold', 'surface']) {
      for (const step of steps) {
        expect(tokenValue(css, `--color-${family}-${step}`)).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
  });

  it('keeps the six radii, the three shadows and the two fonts', () => {
    const css = readGlobals();
    for (const t of ['sm', 'md', 'lg', 'xl', '2xl', 'full']) {
      expect(css).toContain(`--radius-${t}:`);
    }
    for (const t of ['card', 'hover', 'modal']) {
      expect(css).toContain(`--shadow-${t}:`);
    }
    expect(css).toContain('--font-sans: Switzer');
    expect(css).toContain("--font-mono: 'JetBrains Mono'");
  });
});

describe('no component carries a colour of its own', () => {
  it.each(FILES_THAT_MUST_CARRY_NO_HEX)('%s contains no hex colour in code', (relative) => {
    const code = withoutComments(readFileSync(join(ROOT, relative), 'utf8'));
    const found = code.match(HEX) ?? [];
    expect(found).toEqual([]);
  });

  /**
   * The stripper has to discriminate, or it has replaced a false positive with
   * a silent hole. A gate that refuses everything proves nothing about what it
   * lets through; one that admits everything proves less.
   */
  it('still fails on a hex in code, and only forgives one in prose', () => {
    expect(withoutComments("const c = '#32723b';").match(HEX)).toEqual(['#32723b']);
    expect(withoutComments('// it used to be #32723b\n').match(HEX)).toBeNull();
    expect(withoutComments('/* it used to be #32723b */').match(HEX)).toBeNull();
    // A URL is not a comment, and must survive the line-comment rule.
    expect(withoutComments("const u = 'https://x/#abc123';").match(HEX)).toEqual(['#abc123']);
  });
});

/**
 * AA is 4.5:1 for body text and 3:1 for large text and UI boundaries.
 *
 * The pairs below are the ones `globals.css` itself declares - each role token
 * against the foreground token named for it - plus the stepped text tokens
 * against the surfaces they are observed on in the components. They are not a
 * guess at what the application renders: `text-muted-foreground` on `bg-muted`
 * occurs in eight className attributes, `text-primary-foreground` on
 * `bg-primary` in three, `text-primary-600` inside `bg-primary-100` in five.
 *
 * Note what this does NOT cover, because it is a real gap and not a rounding:
 * 1206 occurrences of 109 non-system Tailwind colour classes remain in
 * `apps/web` - `text-gray-500` 182 times, `text-gray-900` 170, `bg-white` 96 -
 * and none of them moves when these anchors move.
 */
const AA_BODY = 4.5;
const AA_LARGE = 3;

const PAIRS: ReadonlyArray<{ fg: string; bg: string; min: number; why: string }> = [
  { fg: '--color-foreground', bg: '--color-background', min: AA_BODY, why: 'body text' },
  { fg: '--color-card-foreground', bg: '--color-card', min: AA_BODY, why: 'text in a card' },
  {
    fg: '--color-muted-foreground',
    bg: '--color-muted',
    min: AA_BODY,
    why: '104 uses, the most common pair',
  },
  {
    fg: '--color-primary-foreground',
    bg: '--color-primary',
    min: AA_BODY,
    why: 'label on a primary button',
  },
  {
    fg: '--color-accent-foreground',
    bg: '--color-accent',
    min: AA_BODY,
    why: 'text on navy chrome',
  },
  { fg: '--color-gold-foreground', bg: '--color-gold', min: AA_BODY, why: 'text on gold' },
  {
    fg: '--color-destructive-foreground',
    bg: '--color-destructive',
    min: AA_BODY,
    why: 'error button',
  },
  { fg: '--color-success-foreground', bg: '--color-success', min: AA_BODY, why: 'success button' },
  { fg: '--color-warning-foreground', bg: '--color-warning', min: AA_BODY, why: 'warning button' },
  {
    fg: '--color-secondary-foreground',
    bg: '--color-secondary',
    min: AA_BODY,
    why: 'secondary button',
  },
  {
    fg: '--color-primary',
    bg: '--color-background',
    min: AA_BODY,
    why: 'text-primary on the page, 94 uses',
  },
  {
    fg: '--color-primary-600',
    bg: '--color-primary-100',
    min: AA_BODY,
    why: 'observed in 5 classNames',
  },
  { fg: '--color-gold-700', bg: '--color-gold-50', min: AA_BODY, why: 'observed in 1 className' },
  /**
   * A DELIBERATELY LOWER FLOOR, with the reason, rather than a deleted
   * assertion or a forced value.
   *
   * WCAG 1.4.11 asks 3:1 of user-interface COMPONENTS and meaningful
   * graphics - a control's boundary, an icon carrying information. It does not
   * ask it of a decorative separator, and `--color-border` is the hairline
   * between cards and around inputs. Reaching 3:1 against near-white cream
   * needs `surface-600` (#878680), which turns every card edge into a hard
   * mid-grey line: a visual regression dressed up as compliance.
   *
   * So the floor is 1.5, which this palette clears at 1.82 - and which the
   * PREVIOUS palette did not, at 1.36. The thing that genuinely must meet 3:1
   * is the focus indicator, and that is the assertion below it: 5.13.
   *
   * If a bordered element ever becomes the only boundary of a control, that
   * control needs its own token at 3:1 and this row stops covering it.
   */
  {
    fg: '--color-border',
    bg: '--color-background',
    min: 1.5,
    why: 'a decorative hairline, not a control boundary',
  },
  {
    fg: '--color-ring',
    bg: '--color-background',
    min: AA_LARGE,
    why: 'the focus ring must be visible',
  },
];

/**
 * `brand-colors.ts` exists because some code cannot reach a token, and it is
 * only safe while it agrees with the anchors. Both files say so in their
 * comments; this is what makes that a checked claim rather than a promise.
 */
describe('the one module allowed to spell a hex agrees with the anchors', () => {
  const MIRRORED: ReadonlyArray<{ constant: string; token: string }> = [
    { constant: 'BRAND_TEAL', token: '--color-primary-500' },
    { constant: 'BRAND_TEAL_DARK', token: '--color-primary-600' },
    { constant: 'BRAND_NAVY', token: '--color-accent-800' },
    { constant: 'BRAND_GOLD', token: '--color-gold-500' },
    { constant: 'BRAND_CREAM', token: '--color-surface-100' },
    { constant: 'BRAND_PAPER', token: '--color-surface-50' },
    { constant: 'BRAND_INK', token: '--color-surface-950' },
  ];

  it.each(MIRRORED)('$constant equals $token', ({ constant, token }) => {
    const src = readFileSync(join(ROOT, ALLOWED[0]), 'utf8');
    const declared = new RegExp(`${constant}\\s*=\\s*'(#[0-9a-fA-F]{3,8})'`).exec(src);
    expect(declared).not.toBeNull();
    expect((declared as RegExpExecArray)[1].toLowerCase()).toBe(tokenValue(readGlobals(), token));
  });

  it('is the only file outside globals.css permitted to carry a brand hex', () => {
    expect(ALLOWED).toEqual(['apps/web/src/lib/brand-colors.ts']);
  });
});

describe('every declared text-on-background pair meets AA', () => {
  it.each(PAIRS)('$fg on $bg reaches $min:1 ($why)', ({ fg, bg, min }) => {
    const css = readGlobals();
    const f = tokenValue(css, fg);
    const b = tokenValue(css, bg);
    expect(f).toMatch(/^#[0-9a-f]{3,8}$/);
    expect(b).toMatch(/^#[0-9a-f]{3,8}$/);
    const ratio = contrast(f as string, b as string);
    // Reported to one decimal so a failure prints the number, not a boolean.
    expect(Number(ratio.toFixed(2))).toBeGreaterThanOrEqual(min);
  });
});
