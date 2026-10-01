import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * C43 - no logging call writes an email address in clear.
 *
 * The privacy policy lists what the logs keep, and a recipient's address is not
 * on that list. Every `logger.*(` and `console.*(` call, and every message the
 * bootstrap prints through its postcondition, is read with its arguments; an
 * interpolation or an object property whose value names an address must go
 * through `maskEmail` (or `redactEmails` for text the call did not compose).
 *
 * The behaviour of each path is proved where it lives; this sweep is what makes
 * the next path, written by somebody who never read this, fail the build.
 */
const ROOT = join(__dirname, '..', '..', '..', '..', '..');
const DIRS = ['apps/api/src', 'libs/common/src', 'prisma'].map((d) => join(ROOT, d));

const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (e.isDirectory()) {
      return ['__test__', 'node_modules', 'migrations'].includes(e.name) ||
        e.name.endsWith('-client')
        ? []
        : walk(join(dir, e.name));
    }
    return e.name.endsWith('.ts') && !e.name.endsWith('.spec.ts') ? [join(dir, e.name)] : [];
  });

/** The text of a call, from its opening parenthesis to the matching close. */
const callText = (src: string, open: number): string => {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '(') depth++;
    else if (src[i] === ')' && --depth === 0) return src.slice(open, i + 1);
  }
  return src.slice(open);
};

const CALL = /\b(?:logger|console)\.(?:log|debug|info|warn|error|verbose)\(|\bproblems\.push\(/g;

/** An expression that names an address, by its last identifier. */
const ADDRESS = /(?:^|\.)(?:e?mail|emails?|to|recipient|address|\w+Email|\w+Address)$/i;

/** Addresses that are the platform's own configuration, not a person's. */
const DECLARED: Record<string, string> = {
  fromAddress: "the configured sender, noreply@ - the platform's own address",
};

/** The arguments of the call itself, split on its own commas only. */
const topLevelArgs = (call: string): string[] => {
  const args: string[] = [];
  let depth = 0;
  let quote = '';
  let start = 1;
  for (let i = 1; i < call.length - 1; i++) {
    const c = call[i];
    if (quote) {
      if (c === quote && call[i - 1] !== '\\') quote = '';
    } else if (c === '`' || c === "'" || c === '"') quote = c;
    else if ('([{'.includes(c)) depth++;
    else if (')]}'.includes(c)) depth--;
    else if (c === ',' && depth === 0) {
      args.push(call.slice(start, i).trim());
      start = i + 1;
    }
  }
  args.push(call.slice(start, call.length - 1).trim());
  return args;
};

/** The call with every masked argument removed, so what remains is what is written as is. */
const withoutMasked = (call: string): string => {
  let out = call;
  for (const fn of ['maskEmail(', 'redactEmails(']) {
    let at = out.indexOf(fn);
    while (at >= 0) {
      const inner = callText(out, at + fn.length - 1);
      out = out.slice(0, at) + 'MASKED' + out.slice(at + fn.length - 1 + inner.length);
      at = out.indexOf(fn);
    }
  }
  return out;
};

const unmasked = (raw: string): string[] => {
  const call = withoutMasked(raw);
  const found: string[] = [];
  for (const m of call.matchAll(/\$\{([^}]+)\}/g)) {
    const expr = m[1].trim();
    if (ADDRESS.test(expr) && !(expr in DECLARED)) found.push(`\${${expr}}`);
  }
  for (const m of call.matchAll(/\b(\w+)\s*:\s*([\w.?]+)\s*[,}\n]/g)) {
    const [, key, value] = m;
    if (key in DECLARED) continue;
    // Judged by the value: `to: newTier` is a transition, `to: payload.to` an address.
    if (ADDRESS.test(value)) found.push(`${key}: ${value}`);
  }
  for (const arg of topLevelArgs(call)) {
    if (/^\w+(?:\.\w+)*$/.test(arg) && ADDRESS.test(arg) && !(arg in DECLARED)) found.push(arg);
  }
  return found;
};

const offenders = (): string[] =>
  DIRS.flatMap(walk).flatMap((file) => {
    const src = readFileSync(file, 'utf8');
    return [...src.matchAll(CALL)].flatMap((m) => {
      const call = callText(src, (m.index ?? 0) + m[0].length - 1);
      const line = src.slice(0, m.index).split('\n').length;
      return unmasked(call).map((what) => `${relative(ROOT, file)}:${line} ${what}`);
    });
  });

describe('C43 - no logging call writes an address in clear', () => {
  it('finds none', () => {
    expect(offenders()).toEqual([]);
  });

  it('reads the calls it is about, not nothing', () => {
    const files = DIRS.flatMap(walk);
    const calls = files.reduce((n, f) => n + [...readFileSync(f, 'utf8').matchAll(CALL)].length, 0);
    expect(files.map((f) => relative(ROOT, f))).toContain(
      'libs/common/src/email/email.processor.ts',
    );
    expect(calls).toBeGreaterThan(200);
  });

  it('would refuse the shapes it exists for', () => {
    expect(unmasked('(`Email sent to ${to} messageId=${id}`)')).toEqual(['${to}']);
    expect(unmasked("('queued %o', { to: payload.to, template })")).toEqual(['to: payload.to']);
    expect(unmasked('(`sent to ${maskEmail(to)}`)')).toEqual([]);
    expect(unmasked("('active %o', { fromAddress: this.from })")).toEqual([]);
    expect(unmasked("('failed for', user.email)")).toEqual(['user.email']);
    expect(unmasked('(`account=${owner.get(e.email)}`)')).toEqual([]);
  });
});
