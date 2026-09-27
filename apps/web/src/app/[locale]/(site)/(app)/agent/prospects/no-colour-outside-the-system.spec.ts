import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Not one colour class outside the design system on this screen.
 *
 * The page being replaced scored ZERO by itself - and that number was
 * misleading, which is why this file counts what is rendered rather than what
 * one file contains. `agent/prospects/page.tsx` was a 25-line delegation to
 * `PlaceholderPage`, and that shared component carries ten non-system
 * occurrences: `gray-900` x2, `gray-500` x3, `gray-700` x2, `gray-300`,
 * `gray-400`, `white`. So the screen rendered ten while the page file read
 * clean.
 *
 * The precedents this screen follows are worse, and are followed for STRUCTURE
 * only: `candidates-list-content.tsx` carries twelve, and `lib/kbs.ts` carries
 * twenty-eight - almost all of them purely to colour status pills through
 * `KBS_STATUS_TONE` (`bg-blue-100 text-blue-800`, `bg-emerald-100`, and so on).
 * Copying that map for the five lead statuses would have added five more rows
 * of hand-picked colour.
 *
 * The tokens can express it instead, and the application already does so in
 * four places - `bg-success/10 text-success` in `verify-certificate`,
 * `admin/verify`, `kamnet/apply` and `lands-table`.
 */
const HERE = __dirname;

/** The families the design system owns, from the `@theme` block. */
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

/** Comments first. Four times now this repository has flagged its own prose. */
const withoutComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const offendersIn = (source: string): string[] => {
  const code = withoutComments(source);
  const found: string[] = [];
  for (const [, family, step] of code.matchAll(STEPPED)) {
    if (!SYSTEM_FAMILIES.includes(family as (typeof SYSTEM_FAMILIES)[number])) {
      found.push(`${family}-${step}`);
    }
  }
  for (const [, word] of code.matchAll(PLAIN)) found.push(word);
  return found;
};

/** Every file this screen owns, discovered rather than listed. */
const ownedFiles = (): string[] =>
  readdirSync(HERE).filter((f) => /\.tsx?$/.test(f) && !/\.spec\.tsx?$/.test(f));

/** The files the screen is made of. Listed, so their absence is a failure. */
const REQUIRED_FILES = [
  'page.tsx',
  'prospects-content.tsx',
  'prospect-row.tsx',
  'prospect-form.tsx',
  'prospect-delete-dialog.tsx',
  'lead-status.ts',
] as const;

describe('/agent/prospects carries no colour outside the design system', () => {
  it('is reading the directory it thinks it is', () => {
    // Vacuous-pass guard: an empty file list would make every assertion below
    // meaningless, and this is the only place that would say so.
    expect(ownedFiles().length).toBeGreaterThan(0);
    expect(ownedFiles()).toContain('page.tsx');
  });

  it('covers every file the screen is made of', () => {
    /**
     * Without this, the sweep passes while the screen does not exist.
     *
     * It did exactly that on its first run: `ownedFiles()` found only the
     * 25-line `PlaceholderPage` delegation, which genuinely carries zero
     * non-system classes, so the guard reported 4/4 green having measured the
     * ABSENCE of a screen rather than the cleanliness of one. A gate that is
     * satisfied by nothing being there is not a gate.
     */
    const present = ownedFiles();
    const missing = REQUIRED_FILES.filter((f) => !present.includes(f));

    expect(missing).toEqual([]);
  });

  it.each(ownedFiles())('%s names no non-system colour class', (file) => {
    const offenders = offendersIn(readFileSync(join(HERE, file), 'utf8'));
    expect({ file, offenders }).toEqual({ file, offenders: [] });
  });

  it('renders no status pill through a hand-written colour map', () => {
    // `KBS_STATUS_TONE` is the shape to avoid. Importing it, or writing an
    // equivalent, is how twenty-eight non-system classes got into `lib/kbs.ts`.
    for (const file of ownedFiles()) {
      const src = withoutComments(readFileSync(join(HERE, file), 'utf8'));
      expect(src).not.toMatch(/KBS_STATUS_TONE|_TONE\b/);
    }
  });

  it('still catches a non-system class in code, and forgives one only in prose', () => {
    // Discrimination. A sweep that refuses everything proves nothing about what
    // it admits; one that admits everything proves less.
    expect(offendersIn('<p className="text-gray-500" />')).toEqual(['gray-500']);
    expect(offendersIn('<p className="bg-white" />')).toEqual(['white']);
    expect(offendersIn('// it used to be text-gray-500\n')).toEqual([]);
    expect(offendersIn('/* it used to be bg-emerald-100 */')).toEqual([]);
    expect(offendersIn('<p className="text-muted-foreground" />')).toEqual([]);
    expect(offendersIn('<p className="bg-success/10 text-success" />')).toEqual([]);
    expect(offendersIn('<p className="bg-primary-500/10" />')).toEqual([]);
  });
});
