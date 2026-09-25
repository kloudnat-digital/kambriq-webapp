import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * Nothing records that the acompte arrived except the step that asks the ledger.
 *
 * G1's guarantees are all on `Payment`: an append-only ledger, one write path to
 * the state, a transition demanding a named actor and a reason, and an evidence
 * receipt. `LandReservation.downPaymentConfirmed` is a second record of the same
 * fact in a different table, and while `confirmDownPayment` set it in a bare
 * update the whole barrier was bypassed by one admin button.
 *
 * That is a guarantee only while `confirmDownPayment` is the only writer. A
 * second `landReservation.update({ data: { downPaymentConfirmed: true } })`
 * written tomorrow, anywhere, would restore the defect exactly, and until this
 * file nothing would have gone red.
 *
 * Same shape as `single-state-write-path.spec.ts` for `Payment.state`.
 */
const ROOT = join(__dirname, '..', '..', '..', '..', '..');
const SERVICE = join(
  ROOT,
  'apps',
  'api',
  'src',
  'lands',
  'reservations',
  'reservations.service.ts',
);

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      if (entry === 'node_modules' || entry === '__test__' || entry.endsWith('-client')) return [];
      return walk(path);
    }
    return path.endsWith('.ts') && !path.endsWith('.spec.ts') && !path.endsWith('.dbspec.ts')
      ? [path]
      : [];
  });

const CODE = [
  ...walk(join(ROOT, 'apps', 'api', 'src')),
  ...walk(join(ROOT, 'libs', 'common', 'src')),
  ...walk(join(ROOT, 'prisma')),
];

/**
 * The declaration a write sits inside.
 *
 * Found by walking back to the nearest line that OPENS a declaration at class
 * or module indentation, rather than by the nearest `name(...) {` anywhere: an
 * `if (...) {` matches that shape, and the first version of this file reported
 * `if()` as the writer of the acompte. Control-flow keywords are excluded by
 * name for the same reason.
 */
const BLOCK_KEYWORDS = new Set(['if', 'for', 'while', 'switch', 'catch', 'do', 'else', 'return']);

const enclosingMethod = (src: string, at: number): string => {
  const lines = src.slice(0, at).split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    const m =
      /^ {0,2}(?:export\s+)?(?:private\s+|public\s+|protected\s+)?(?:static\s+)?(?:async\s+)?(?:function\s+)?([A-Za-z_$][\w$]*)\s*\(/.exec(
        lines[i],
      );
    if (m && !BLOCK_KEYWORDS.has(m[1])) return m[1];
  }
  return '(unknown)';
};

type Write = { file: string; op: string; call: string; method: string };

/**
 * Every Prisma write to `landReservation`, with the text of the call.
 *
 * Captured from `landReservation.<op>(` to the parenthesis that closes it at
 * depth zero, so a nested `data: { ... }` is inside the capture and a field set
 * there is seen. `tx.landReservation.update(` matches as well: the model name is
 * what matters, not the client it is reached through.
 */
const reservationWrites = (file: string): Write[] => {
  const src = readFileSync(file, 'utf8');
  const pattern = /\blandReservation\.(update|updateMany|upsert|create|createMany)\(/g;
  const writes: Write[] = [];
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(src)) !== null) {
    let depth = 0;
    let end = m.index + m[0].length - 1;
    for (; end < src.length; end++) {
      if (src[end] === '(') depth++;
      if (src[end] === ')') depth--;
      if (depth === 0) break;
    }
    writes.push({
      file: relative(ROOT, file),
      op: m[1],
      call: src.slice(m.index, end + 1),
      method: enclosingMethod(src, m.index),
    });
  }
  return writes;
};

/** True when the call claims the acompte arrived. */
const claimsTheAcompte = (call: string): boolean =>
  /\bdownPaymentConfirmed\s*:/.test(call) ||
  /\bstatus\s*:\s*(LandReservationStatus\.)?['"]?CONFIRMED['"]?/.test(call);

/**
 * `prisma/seed.ts` writes fixture reservations directly, acompte flag included.
 *
 * It is not an exception to the rule, it is outside it: a seed builds rows, it
 * does not serve a request, and its parcels carry no money. Named by function
 * rather than excluded by a path filter, so a write anywhere else under
 * `prisma/` trips the sweep. A further write inside `seedLands` itself does
 * not, and that is the limit of this exemption.
 */
const FIXTURE_WRITERS: ReadonlyArray<{ file: string; method: string; why: string }> = [
  { file: 'prisma/seed.ts', method: 'seedLands', why: 'builds fixture reservations directly' },
];

describe('the acompte is recorded by one step, and that step reads the ledger', () => {
  it('is sweeping the files it thinks it is', () => {
    expect(CODE.length).toBeGreaterThan(50);
    expect(CODE).toContain(SERVICE);
    expect(CODE.some((f) => f.endsWith(join('prisma', 'seed.ts')))).toBe(true);
    // And it can see writes at all, or every assertion below is vacuous.
    expect(CODE.flatMap(reservationWrites).length).toBeGreaterThan(3);
  });

  it('exactly one request path claims the acompte, and it is confirmDownPayment', () => {
    const fixture = new Set(FIXTURE_WRITERS.map((f) => `${f.file}::${f.method}`));
    const claims = CODE.flatMap(reservationWrites)
      .filter((w) => claimsTheAcompte(w.call))
      .filter((w) => !fixture.has(`${w.file}::${w.method}`));

    // The file and method are in the failure message, so a new writer is named
    // rather than a count going from 1 to 2.
    expect(claims.map((w) => `${w.file} :: ${w.method}() :: landReservation.${w.op}`)).toEqual([
      'apps/api/src/lands/reservations/reservations.service.ts :: confirmDownPayment() :: landReservation.update',
    ]);
  });

  it('that step asks the ledger before it writes', () => {
    const src = readFileSync(SERVICE, 'utf8');
    const start = src.indexOf('async confirmDownPayment(');
    const body = src.slice(start, src.indexOf('\n  }\n', start));

    const guard = body.indexOf('this.assertAcompteIsValidated(');
    const write = body.indexOf('this.prisma.landReservation.update(');

    expect(guard).toBeGreaterThan(-1);
    expect(write).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(write);
  });

  it('the ledger read accepts VALIDE and nothing else', () => {
    const src = readFileSync(SERVICE, 'utf8');
    const start = src.indexOf('private async assertAcompteIsValidated(');
    const body = src.slice(start, src.indexOf('\n  }\n', start));

    // PARTIELLEMENT_RECU is the one an operator would reach for. It means part
    // of the acompte arrived, which is not the acompte.
    expect(body).toContain('PaymentState.VALIDE');
    expect(body).not.toContain('PARTIELLEMENT_RECU');
  });

  it('keeps the fixture list exact, so it cannot rot into a lie', () => {
    const all = CODE.flatMap(reservationWrites).filter((w) => claimsTheAcompte(w.call));
    for (const f of FIXTURE_WRITERS) {
      expect(all.some((w) => w.file === f.file && w.method === f.method)).toBe(true);
    }
    expect(FIXTURE_WRITERS).toHaveLength(1);
  });
});
