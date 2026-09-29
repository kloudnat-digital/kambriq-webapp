import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * The chantier register is the record of what has been done, and it is the only
 * one.
 *
 * Between 18 and 23 September 2026 a second record, `WAVE_STATUS.md`, sat at the
 * repository root and carried PRs #155 to #162 while the register still read
 * "Last closed: Friday 4 September" and mentioned none of them. Both documents
 * were maintained, by different people, and they disagreed. Nothing reported it:
 * a stale record looks exactly like a current one.
 *
 * The assertions below are the properties a reader relies on when they open that
 * file cold. Each one had already failed in the live document when this was
 * written: the `## Open` table existed twice with different rows, `H1`'s entry
 * had lost its heading, and four states were declared against eight in use.
 */
const ROOT = join(__dirname, '..', '..', '..', '..', '..');
const REGISTER = 'docs/ops/registre-chantiers.md';

const register = readFileSync(join(ROOT, REGISTER), 'utf8');
const lines = register.split('\n');

/** The `## Open` table header rows, by index. There must be exactly one. */
const openHeaders = lines
  .map((line, i) => ({ line, i }))
  .filter(({ line }) => line.startsWith('| Entry ') && line.includes('State'))
  .map(({ i }) => i);

type Row = { entry: string; state: string };

const openRows = ((): Row[] => {
  if (openHeaders.length === 0) return [];
  const out: Row[] = [];
  for (let i = openHeaders[0] + 2; i < lines.length && lines[i].startsWith('|'); i++) {
    // Stop at a second header rather than reading it as a row. A duplicate table
    // must fail its own assertion and nothing else: parsing through it would
    // trip the state and entry checks too, and three failures naming three
    // different things is not a diagnosis.
    if (lines[i].startsWith('| Entry ')) break;
    const cells = lines[i].split('|').map((c) => c.trim());
    out.push({ entry: cells[1], state: cells[2] });
  }
  return out;
})();

/**
 * The chantier a row is about. `` `H2` follow-up 2 `` and `` `G10b` (infra) ``
 * are rows about `H2` and `G10b`, and neither has an entry of its own by design:
 * the detail belongs to the parent.
 */
const chantierOf = (entry: string): string => /^`([^`]+)`/.exec(entry)?.[1] ?? entry;

const stripBackticks = (s: string) => s.replace(/`/g, '').trim();

/** The states the `### States` table declares. */
const declaredStates = ((): string[] => {
  const start = lines.findIndex((l) => l.startsWith('### States'));
  if (start < 0) return [];
  const out: string[] = [];
  for (let i = start + 3; i < lines.length && lines[i].startsWith('|'); i++) {
    out.push(stripBackticks(lines[i].split('|')[1]));
  }
  return out;
})();

/** Every `### ` entry heading, and the state each one declares at its end. */
const entryHeadings = lines.filter((l) => l.startsWith('### '));
const entryTitles = entryHeadings.map((h) => h.slice(4).split(' - ')[0]);

/** `### P20 and P21 - ... - `PROUVE`` is an entry for P20 and for P21. */
const hasEntry = (chantier: string): boolean =>
  entryTitles.some((t) =>
    new RegExp(`(^|\\W)${chantier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|\\W)`).test(t),
  );

/**
 * Open chantiers whose detail is not in this file.
 *
 * Quarantine, not permission, and pinned in both directions: a new open chantier
 * with no entry fails because it is not here, and writing an entry without
 * removing its line fails too, so the list cannot rot into a lie.
 *
 * Empty since #174 wrote the last missing entry (`P10`). A new open chantier
 * with no entry fails because it is not here.
 */
const NO_ENTRY_YET: ReadonlyArray<{ chantier: string; why: string }> = [];

/**
 * Files allowed to look like a record of work.
 *
 * Anything else matching `RECORD_SHAPED` is a second record, which is the defect
 * this file exists for. A frozen wave note is allowed under `docs/ops/waves/`
 * only while it says in as many words that it is not the record.
 */
const RECORD_SHAPED = /(status|wave|suivi|tracker|registre|register)/i;
const WAVE_NOTES = 'docs/ops/waves';
const NOT_THE_RECORD = '**This is not the record.**';

const markdownFiles = ((): string[] => {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name === '.git' || name === 'dist') continue;
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (name.endsWith('.md')) out.push(relative(ROOT, full));
    }
  };
  walk(join(ROOT, 'docs'));
  for (const name of readdirSync(ROOT)) {
    if (name.endsWith('.md')) out.push(name);
  }
  return out;
})();

describe('the chantier register is the record, and the only one', () => {
  it('is reading the register at all', () => {
    // Every assertion below is vacuous against a file this parser cannot read.
    // The count of Open tables belongs to its own test below, not here, or the
    // two can never be observed failing apart.
    expect(openHeaders.length).toBeGreaterThan(0);
    expect(openRows.length).toBeGreaterThan(60);
    expect(entryHeadings.length).toBeGreaterThan(30);
    expect(declaredStates.length).toBeGreaterThan(4);
    expect(markdownFiles).toContain(REGISTER);
  });

  it('has one Open table, not two', () => {
    // It had two, back to back, each carrying rows the other lacked and each
    // being edited by different people. The header row is the whole signal.
    expect(openHeaders).toHaveLength(1);
  });

  it('names no chantier twice in the Open table', () => {
    const seen = new Map<string, number>();
    for (const row of openRows) seen.set(row.entry, (seen.get(row.entry) ?? 0) + 1);
    expect([...seen].filter(([, n]) => n > 1).map(([entry]) => entry)).toEqual([]);
  });

  it('uses no state the States table does not declare', () => {
    const used = new Set<string>();
    for (const row of openRows) used.add(stripBackticks(row.state));
    for (const heading of entryHeadings) {
      const trailing = /`([A-Z][A-Z ,]+)`\s*$/.exec(heading);
      if (trailing) used.add(trailing[1].trim());
    }
    expect([...used].filter((s) => !declaredStates.includes(s)).sort()).toEqual([]);
  });

  it('gives every open chantier an entry, or names it in the inventory', () => {
    const quarantined = new Set(NO_ENTRY_YET.map((q) => q.chantier));
    const orphans = [...new Set(openRows.map((r) => chantierOf(r.entry)))]
      .filter((c) => !hasEntry(c) && !quarantined.has(c))
      .sort();
    expect(orphans).toEqual([]);
  });

  it('keeps the inventory exact, so it cannot rot into a lie', () => {
    // Write an entry and forget this list, and this fails - which is the point.
    const open = new Set(openRows.map((r) => chantierOf(r.entry)));
    const stale = NO_ENTRY_YET.filter((q) => !open.has(q.chantier) || hasEntry(q.chantier)).map(
      (q) => q.chantier,
    );
    expect(stale).toEqual([]);
    expect(NO_ENTRY_YET).toHaveLength(0);
  });

  it('is the only file in the repository shaped like a record of work', () => {
    const others = markdownFiles
      .filter((f) => f !== REGISTER && RECORD_SHAPED.test(f))
      .filter((f) => {
        if (!f.startsWith(WAVE_NOTES)) return true;
        return !readFileSync(join(ROOT, f), 'utf8').includes(NOT_THE_RECORD);
      });
    expect(others).toEqual([]);
  });
});
