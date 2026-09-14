import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * A20 - the published contract must not be wider than the guard.
 *
 * Authentication is opt-out: JwtAuthGuard is global, so every route requires a
 * bearer token unless @Public() removes it. The OpenAPI document only shows that
 * requirement where @ApiBearerAuth() is present. When a guarded route lacks it,
 * the contract advertises an open endpoint that the guard actually refuses - a
 * promise wider than what is enforced. A client reads the document, calls the
 * route without a token, and gets a 401 the contract said nothing about.
 *
 * So this pins the parity in BOTH directions:
 *   - a guarded route (not @Public) MUST carry @ApiBearerAuth, at the method or
 *     the class;
 *   - a @Public route MUST NOT, or the document claims an auth it does not need.
 *
 * Static, like route-guards.spec.ts: it reads the decorators, not a running app,
 * so a divergence fails in unit tests without booting Nest or Redis. The parser
 * collects a handler's full decorator stack in both directions, because a
 * decorator may sit above @Get or below it.
 */
const API_SRC = join(__dirname, '..', '..');

const walk = (dir: string): string[] => {
  const out: string[] = [];
  for (const e of readdirSync(dir)) {
    const full = join(dir, e);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (e.endsWith('.controller.ts')) out.push(full);
  }
  return out;
};

const stripComments = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const HTTP = /^\s*@(Get|Post|Put|Patch|Delete)\(/;

type Divergence = { file: string; route: string; kind: string };

const analyse = (file: string): Divergence[] => {
  const rel = relative(API_SRC, file);
  const lines = stripComments(readFileSync(file, 'utf8')).split('\n');
  const clsIdx = lines.findIndex((l) => l.trim().startsWith('export class'));
  const classRegion = lines.slice(0, clsIdx === -1 ? lines.length : clsIdx).join('\n');
  const classBearer = /^\s*@ApiBearerAuth\(/m.test(classRegion);
  const classPublic = /^\s*@Public\(\)/m.test(classRegion);

  const out: Divergence[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (!HTTP.test(lines[i])) continue;

    // decorators above @Get, until a blank line or the previous method's close
    const up: string[] = [];
    for (let k = i - 1; k > clsIdx; k--) {
      const s = lines[k].trim();
      if (s === '' || s === '}') break;
      up.push(lines[k]);
    }
    // from @Get down to the method body's opening brace
    const down: string[] = [lines[i]];
    for (let k = i + 1; k < lines.length; k++) {
      down.push(lines[k]);
      if (/\)\s*(:\s*[^={]+)?\s*\{/.test(lines[k]) || lines[k].trim().endsWith('{')) break;
    }
    const block = [...up, ...down].join('\n');

    const isPublic = classPublic || /@Public\(\)/.test(block);
    const hasBearer = classBearer || /@ApiBearerAuth\(/.test(block);
    const route = /@(?:Get|Post|Put|Patch|Delete)\(\s*'([^']*)'/.exec(lines[i])?.[1] ?? '';

    if (!isPublic && !hasBearer) {
      out.push({
        file: rel,
        route,
        kind: 'guarded route missing @ApiBearerAuth (contract wider than the guard)',
      });
    }
    if (isPublic && hasBearer) {
      out.push({
        file: rel,
        route,
        kind: '@Public route carries @ApiBearerAuth (contract claims an auth it does not need)',
      });
    }
  }
  return out;
};

describe('OpenAPI contract vs guard parity (A20)', () => {
  const controllers = walk(API_SRC).filter((f) => !f.includes('__test__'));

  it('every guarded route documents its bearer auth, and no public route pretends to need one', () => {
    const divergences = controllers.flatMap(analyse);
    const report = divergences.map((d) => `  ${d.file} '${d.route}' - ${d.kind}`).join('\n');
    // Assert on the human-readable report so a failure NAMES every divergence.
    expect(report).toBe('');
  });
});
