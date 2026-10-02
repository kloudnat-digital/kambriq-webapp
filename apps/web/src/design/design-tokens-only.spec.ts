import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DESIGN_DEBT } from './design-debt';
import { hardCodedIn, type HardCodedKind } from './hard-coded-values';

/**
 * J15 - the design tokens are the only source of colour, typography and spacing.
 *
 * Inverted, like C44: any value written in place of a token is refused unless
 * `design-debt.ts` declares it with its reason. J10 found 1 226 colour classes
 * outside the system on 17 September (1 132 by these rules on 2 October); a
 * guard that refused them all on day one would be switched off by day three, so
 * they are a declared debt that may only shrink, and the 1 133rd is refused.
 */
const WEB_SRC = join(__dirname, '..');
const ROOT = join(WEB_SRC, '..', '..', '..');

/** The figures this list may not exceed. Lowering them is the point; raising them is a reviewed step back. */
const PINNED_ENTRIES = 152;
const PINNED_OCCURRENCES = 1154;

const sources = (): string[] =>
  execFileSync('git', ['ls-files', '-z', '--', 'apps/web/src'], { cwd: ROOT, encoding: 'utf8' })
    .split('\0')
    .filter(
      (f) =>
        /\.(tsx|ts|mdx)$/.test(f) &&
        !/\.(spec|test)\.tsx?$/.test(f) &&
        !f.startsWith('apps/web/src/design/'),
    )
    .map((f) => f.replace('apps/web/src/', ''));

const found = (): Map<string, number> => {
  const out = new Map<string, number>();
  for (const file of sources()) {
    const counts = hardCodedIn(readFileSync(join(WEB_SRC, file), 'utf8'));
    for (const [kind, n] of Object.entries(counts) as [HardCodedKind, number][]) {
      if (n > 0) out.set(`${file} ${kind}`, n);
    }
  }
  return out;
};

const declared = new Map(DESIGN_DEBT.map((d) => [`${d.file} ${d.kind}`, d.count]));

describe('J15 - no value bypasses the design tokens', () => {
  it('is reading the sources it thinks it is', () => {
    expect(sources().length).toBeGreaterThan(300);
    expect(sources()).toContain('app/global-error.tsx');
  });

  it('refuses a hard-coded value in any file the debt list does not declare', () => {
    const undeclared = [...found()]
      .filter(([key]) => !declared.has(key))
      .map(([k, n]) => `${k}: ${n}`);
    expect(undeclared).toEqual([]);
  });

  it('holds every declared file to its count: more is refused, less must be written down', () => {
    const now = found();
    const moved = [...declared]
      .filter(([key, n]) => (now.get(key) ?? 0) !== n)
      .map(([key, n]) => `${key}: declared ${n}, found ${now.get(key) ?? 0}`);
    expect(moved).toEqual([]);
  });

  it('gives every entry a reason, once', () => {
    for (const d of DESIGN_DEBT) {
      expect(d.reason.trim().length).toBeGreaterThan(20);
      expect(d.count).toBeGreaterThan(0);
    }
    expect(declared.size).toBe(DESIGN_DEBT.length);
  });

  it('only shrinks: the list is no longer, and sums no higher, than its pins', () => {
    expect(DESIGN_DEBT.length).toBeLessThanOrEqual(PINNED_ENTRIES);
    expect(DESIGN_DEBT.reduce((s, d) => s + d.count, 0)).toBeLessThanOrEqual(PINNED_OCCURRENCES);
  });

  it('sees each kind it claims to see, and forgives a value only in prose', () => {
    const seen = (src: string) =>
      Object.entries(hardCodedIn(src))
        .filter(([, n]) => n > 0)
        .map(([k]) => k);
    expect(seen('<p className="text-gray-500" />')).toEqual(['colour-class']);
    expect(seen('<p className="hover:bg-white" />')).toEqual(['colour-class']);
    expect(seen('<p className="bg-brand-500" />')).toEqual(['colour-class']);
    expect(seen('<p className="bg-[#123456]" />')).toEqual(['arbitrary-colour']);
    expect(seen('<p className="mt-[13px]" />')).toEqual(['arbitrary-spacing']);
    expect(seen('<p className="text-[15px]" />')).toEqual(['arbitrary-typography']);
    expect(seen('<p style={{ color: x }} />')).toEqual(['inline-style']);
    expect(seen('<p className="text-muted-foreground bg-primary-500/10 p-4" />')).toEqual([]);
    expect(seen('// it used to be text-gray-500\n')).toEqual([]);
  });

  /**
   * What these rules cannot see, written down so the boundary is known: a class
   * assembled at run time (`'bg-' + tone`, `text-${tone}-500`), a colour arriving
   * through a variable or a prop into a third-party component, an inline style
   * spread from an object (`style={styles}`), a value in a `.css` file (none
   * today besides `globals.css`, which defines the tokens), and a hex literal
   * (held by `app/brand-palette.spec.ts` instead).
   */
  it('does not see a class assembled at run time - a known limit, pinned', () => {
    expect(hardCodedIn('<p className={`text-${tone}-500`} />')['colour-class']).toBe(0);
    expect(hardCodedIn("<p className={'bg-' + tone} />")['colour-class']).toBe(0);
    expect(hardCodedIn('<p style={styles} />')['inline-style']).toBe(0);
  });
});
