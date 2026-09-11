import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * G7 - `Payment.state` is written in exactly one place, and that place writes
 * the audit row in the same transaction.
 *
 * `transition()` is the corridor: the transition table, the deliberateness
 * guard, the identification gate and the evidence rule all live there, and
 * every state change - the send, the back-office step, validation, the dunning
 * sweep's EXPIRE - passes through it. That is only a guarantee while it is the
 * only door. A second `payment.update({ data: { state } })` written tomorrow,
 * anywhere, would change state with no guard and no audit row, and until this
 * file nothing would have gone red.
 *
 * Same shape as `no-payment-without-reference.spec.ts` for `payment.create`.
 *
 * Proved sharp on 2026-09-09 by adding `expireWithoutTrail()` to the dunning
 * service - one `payment.update` with a `state` - and watching this file fail
 * before the mutation was reverted. The diff is in the PR that added it.
 */
const ROOT = join(__dirname, '..', '..', '..', '..', '..');
const SERVICE = join(ROOT, 'apps', 'api', 'src', 'lands', 'payments', 'payments.service.ts');

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      // Generated clients and tests are not application code.
      if (entry === 'node_modules' || entry === '__test__' || entry.endsWith('-client')) return [];
      return walk(path);
    }
    return path.endsWith('.ts') && !path.endsWith('.spec.ts') && !path.endsWith('.dbspec.ts')
      ? [path]
      : [];
  });

/** Every `.ts` file that could hold a Prisma call against the lands database. */
const CODE = [
  ...walk(join(ROOT, 'apps', 'api', 'src')),
  ...walk(join(ROOT, 'libs', 'common', 'src')),
  ...walk(join(ROOT, 'prisma')),
];

/**
 * Every Prisma write to the `payment` model, with the text of the call.
 *
 * The call is captured from `payment.<op>(` to the first `})` that closes it
 * at depth zero, so nested `data: { ... }` blocks are inside the capture and a
 * `state` in them is seen. `tx.payment.update(` and
 * `this.prisma.payment.update(` both match: the model name is what matters.
 */
type Write = { file: string; op: string; call: string; method: string };

const paymentWrites = (file: string): Write[] => {
  const src = readFileSync(file, 'utf8');
  const pattern = /\bpayment\.(update|updateMany|upsert|create|createMany)\(/g;
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
    const call = src.slice(m.index, end + 1);
    // Comments are stripped before the enclosing method is looked for, so a
    // doc comment cannot be reported as the method's name.
    const before = src
      .slice(0, m.index)
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    const method =
      /(?:async\s+)?(\w+)\s*\([^)]*\)\s*(?::\s*[^{]+)?\{(?![\s\S]*(?:async\s+)?\w+\s*\([^)]*\)\s*(?::\s*[^{]+)?\{)/.exec(
        before.slice(-6000),
      );
    writes.push({
      file: relative(ROOT, file),
      op: m[1],
      call,
      method: method?.[1] ?? '(unknown)',
    });
  }
  return writes;
};

/** True when the call's `data` sets `state`. */
const writesState = (call: string): boolean => /\bstate\s*:/.test(call);

describe('Payment.state has exactly one write path, and it writes the audit row', () => {
  it('is sweeping the files it thinks it is', () => {
    expect(CODE.length).toBeGreaterThan(50);
    expect(CODE).toContain(SERVICE);
    expect(CODE.some((f) => f.endsWith(join('prisma', 'seed.ts')))).toBe(true);
    expect(CODE.some((f) => f.includes('dunning.service.ts'))).toBe(true);
  });

  it('exactly one Prisma write sets state, and it is transition() in the payments service', () => {
    const stateWrites = CODE.flatMap(paymentWrites).filter((w) => writesState(w.call));

    // The full call is in the failure message, so a new write path is named
    // by file and method rather than by a count going from 1 to 2.
    expect(stateWrites.map((w) => `${w.file} :: ${w.method}() :: payment.${w.op}`)).toEqual([
      'apps/api/src/lands/payments/payments.service.ts :: transition() :: payment.update',
    ]);
  });

  it('that write and the audit row are in one $transaction', () => {
    const src = readFileSync(SERVICE, 'utf8');
    const start = src.indexOf('async transition(');
    const body = src.slice(start, src.indexOf('\n  }\n', start));

    const tx = body.indexOf('this.prisma.$transaction([');
    const stateWrite = body.indexOf('state: to');
    const auditRow = body.indexOf('this.prisma.paymentTransition.create(');
    const txEnd = body.indexOf(']);', tx);

    expect(tx).toBeGreaterThan(-1);
    expect(stateWrite).toBeGreaterThan(tx);
    expect(auditRow).toBeGreaterThan(tx);
    expect(stateWrite).toBeLessThan(txEnd);
    expect(auditRow).toBeLessThan(txEnd);
  });

  it('the guards run before the transaction, not after', () => {
    const src = readFileSync(SERVICE, 'utf8');
    const start = src.indexOf('async transition(');
    const body = src.slice(start, src.indexOf('\n  }\n', start));
    const tx = body.indexOf('this.prisma.$transaction([');

    for (const guard of [
      'assertTransitionAllowed(',
      'assertTransitionIsDeliberate(',
      'assertClientIsIdentified(',
      'assertTransitionIsEvidenced(',
      'assertReceiptBelongsTo(',
    ]) {
      const at = body.indexOf(guard);
      expect(at).toBeGreaterThan(-1);
      expect(at).toBeLessThan(tx);
    }
  });

  it('no raw SQL writes the Payment table', () => {
    // A `$executeRaw` is a Prisma write the sweep above cannot read. None may
    // touch Payment; the migrations are SQL files and are not application code.
    const offenders = CODE.filter((f) => {
      const src = readFileSync(f, 'utf8');
      return (
        /UPDATE\s+"?Payment"?\s+SET/i.test(src) || /\$executeRaw[\s\S]{0,200}"Payment"/.test(src)
      );
    }).map((f) => relative(ROOT, f));

    expect(offenders).toEqual([]);
  });

  it('the payment model is never updated with a state through updateMany or upsert', () => {
    // Belt and braces for the first assertion: these two ops are the ones a
    // "bulk fix" script reaches for, and a state in them would already fail
    // above. Named separately so the failure says which op was used.
    const bulk = CODE.flatMap(paymentWrites).filter(
      (w) => (w.op === 'updateMany' || w.op === 'upsert') && writesState(w.call),
    );
    expect(bulk).toEqual([]);
  });
});
