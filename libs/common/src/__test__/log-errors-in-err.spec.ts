import * as fs from 'fs';
import * as path from 'path';

/**
 * Repo-wide invariant: an error object is logged under `err`, and nowhere else.
 *
 * Two shapes lose it, both measured on 26 September:
 *
 *   logger.error('DB connection failed', error)       -> no placeholder, so pino
 *                                                        drops the argument: no
 *                                                        message, no stack
 *   logger.warn('Email failed %o', { error })          -> the L3 hook lifts it to
 *                                                        an `error` field, and pino
 *                                                        writes an Error there as {}
 *
 * The one shape that keeps it is `logger.warn('Email failed %o', { err: error })`:
 * the hook passes `err` through, and pino-http's serializer writes its type,
 * message and stack. So an argument, or a payload value, that is a bare
 * error-named identifier must sit under `err`.
 *
 * Unlike `logging-metadata.spec.ts`, this walks the hand-written `prisma/`
 * service folders too - eight of the thirteen offenders were there - and skips
 * only the generated clients.
 */

const ROOTS = ['apps/api/src', 'libs/common/src'];
const GENERATED = path.join('libs', 'common', 'src', 'prisma');
const CALL = /\.logger\.(log|warn|error|debug|verbose|fatal)\(/g;
const ERROR_NAME = /^(error|err|e|exception|cause)$/;

const repoRoot = path.resolve(__dirname, '../../../..');

const walk = (dir: string): string[] => {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '__test__') return [];
      if (path.relative(repoRoot, p) === GENERATED) return [];
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

/** `{ a, error, b: error }` -> the keys whose value is a bare error-named identifier, other than `err`. */
const errorKeysOutsideErr = (objectLiteral: string): string[] =>
  splitTopLevel(objectLiteral.trim().slice(1, -1))
    .map((p) => p.trim())
    .filter(Boolean)
    .flatMap((prop) => {
      const [key, value] = prop.includes(':') ? prop.split(':').map((x) => x.trim()) : [prop, prop];
      return ERROR_NAME.test(value) && key !== 'err' ? [key] : [];
    });

export const offenders = (roots = ROOTS): string[] => {
  const found: string[] = [];
  for (const root of roots) {
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
        const where = `${path.relative(repoRoot, file)}:${src.slice(0, at).split('\n').length}`;
        for (const arg of splitTopLevel(src.slice(i, j - 1))
          .slice(1)
          .map((a) => a.trim())) {
          if (ERROR_NAME.test(arg)) found.push(`${where} passes ${arg} as an argument`);
          else if (arg.startsWith('{')) {
            for (const key of errorKeysOutsideErr(arg))
              found.push(`${where} logs an error under "${key}"`);
          }
        }
      }
    }
  }
  return found;
};

describe('logging: an error object is written under err, where it keeps its message and stack', () => {
  it('no logger call passes an error as a bare argument or under another key', () => {
    expect(offenders()).toEqual([]);
  });

  it('reads the prisma service folders the metadata rule skips', () => {
    const files = walk(path.join(repoRoot, 'apps/api/src')).map((f) => path.relative(repoRoot, f));
    expect(files).toContain(
      path.join('apps', 'api', 'src', 'core', 'prisma', 'core-prisma.service.ts'),
    );
  });
});
