import * as fs from 'fs';
import * as path from 'path';

/**
 * Repo-wide invariant, not a unit test.
 *
 * nestjs-pino's Logger.call takes the LAST optional param as the context and
 * passes the rest to pino as format arguments. Nest's Logger appends the class
 * name last, so a metadata object lands in pino's interpolation slot and is
 * discarded unless the message carries a placeholder:
 *
 *   logger.info({ctx}, 'Email sent',    {id})  ->  "msg":"Email sent"
 *   logger.info({ctx}, 'Email sent %o', {id})  ->  "msg":"Email sent {\"id\":...}"
 *
 * 102 call sites were silently dropping their payloads, including every
 * unhandled exception's message and stack. This test fails if one comes back.
 *
 * apps/web is excluded: it uses winston, which formats metadata itself.
 */

const ROOTS = ['apps/api/src', 'libs/common/src'];
const CALL = /\.logger\.(log|warn|error|debug|verbose|fatal)\(/g;

const walk = (dir: string): string[] => {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '__test__' || e.name === 'prisma') return [];
      return walk(p);
    }
    return e.name.endsWith('.ts') && !e.name.endsWith('.spec.ts') ? [p] : [];
  });
};

const splitTopLevel = (args: string): string[] => {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let k = 0; k < args.length; k++) {
    const ch = args[k];
    if (ch === '(' || ch === '[' || ch === '{') depth++;
    else if (ch === ')' || ch === ']' || ch === '}') depth--;
    else if (ch === ',' && depth === 0) {
      parts.push(args.slice(start, k));
      start = k + 1;
    }
  }
  parts.push(args.slice(start));
  return parts;
};

const offenders = (): string[] => {
  const found: string[] = [];
  const repoRoot = path.resolve(__dirname, '../../../..');
  for (const root of ROOTS) {
    for (const file of walk(path.join(repoRoot, root))) {
      const src = fs.readFileSync(file, 'utf8');
      for (const m of src.matchAll(CALL)) {
        const at = m.index ?? 0;
        const i = at + m[0].length;
        let depth = 1;
        let j = i;
        while (j < src.length && depth > 0) {
          if (src[j] === '(') depth++;
          else if (src[j] === ')') depth--;
          j++;
        }
        const parts = splitTopLevel(src.slice(i, j - 1));
        if (parts.length >= 2 && parts[1].trim().startsWith('{') && !parts[0].includes('%o')) {
          const line = src.slice(0, at).split('\n').length;
          found.push(`${path.relative(repoRoot, file)}:${line}`);
        }
      }
    }
  }
  return found;
};

describe('logging: metadata must not be silently dropped', () => {
  it('every logger call passing an object carries a %o placeholder', () => {
    expect(offenders()).toEqual([]);
  });
});
