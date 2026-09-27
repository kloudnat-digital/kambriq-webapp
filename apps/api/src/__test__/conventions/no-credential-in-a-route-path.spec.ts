import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

/**
 * No route carries a credential in a path segment.
 *
 * D28 masks the query, the fragment and the route parameters before a request
 * line is written. It cannot mask the path: a path segment is indistinguishable
 * from a credential by inspection, and the path is what an access log exists to
 * record. So a token in a path is written to the log group in full, and from
 * there to anything reading it - which is why this stops the route existing
 * rather than trying to redact it afterwards.
 *
 * The five credential-bearing links all use `?token=`, so nothing is refused
 * today. The guard is here because the natural way to add the sixth is
 * `@Get('reset/:token')`.
 */
const ROOT = join(__dirname, '..', '..', '..', '..', '..');
const SEARCHED = ['apps/api/src'];
const SKIPPED = new Set(['node_modules', 'dist', 'out-tsc', '__test__']);

/**
 * Names that mean "this value authenticates the bearer".
 *
 * Two lists, because one was wrong. A suffix match on `code` flagged
 * `:roleCode`, which identifies a role and grants nothing - a name that merely
 * spells like a credential, which is the defect this repository catalogues about
 * sweeps. So `code` and `key` match only on their own, and the unambiguous words
 * match as a suffix so that `:resetToken` is caught.
 */
const CREDENTIAL_EXACT = ['code', 'key'];
const CREDENTIAL_SUFFIX = ['token', 'secret', 'password', 'passwd', 'otp', 'apikey'];

/**
 * A route decorator's path, captured with its parameter names.
 *
 * Matched on the decorator at the start of a line, never on the bare word: a
 * docstring explaining that a token must not appear in a path is the first thing
 * a substring sweep would flag. CLAUDE.md has that under "a sweep that counts a
 * token counts it in prose too".
 */
const ROUTE_DECORATOR = /^[ \t]*@(?:Get|Post|Put|Patch|Delete|All)\(\s*['"`]([^'"`]*)['"`]/gm;

const PARAM_SEGMENT = /:([A-Za-z_][A-Za-z0-9_]*)/g;

const walk = (dir: string): string[] => {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (SKIPPED.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (extname(entry) === '.ts' && !entry.endsWith('.spec.ts')) out.push(full);
  }
  return out;
};

const FILES = SEARCHED.flatMap((d) => walk(join(ROOT, d))).map((f) => relative(ROOT, f));

/** Every route path declared in the API, with the file that declares it. */
const routePaths = (): Array<[string, string]> =>
  FILES.flatMap((file) =>
    [...readFileSync(join(ROOT, file), 'utf8').matchAll(ROUTE_DECORATOR)].map(
      (m) => [file, m[1]] as [string, string],
    ),
  );

/** The credential-named parameters in a path, lowercased for comparison. */
export const credentialParams = (path: string): string[] =>
  [...path.matchAll(PARAM_SEGMENT)]
    .map((m) => m[1].toLowerCase())
    .filter(
      (name) => CREDENTIAL_EXACT.includes(name) || CREDENTIAL_SUFFIX.some((c) => name.endsWith(c)),
    );

describe('no credential travels in a route path', () => {
  it('is reading the controllers at all', () => {
    // A scanner that finds nothing makes the assertion below vacuous.
    const paths = routePaths();
    expect(FILES.length).toBeGreaterThan(80);
    expect(paths.length).toBeGreaterThan(100);
    expect(paths.some(([, p]) => p.includes(':id'))).toBe(true);
  });

  it('fails for the right reason: a credential name, not any parameter', () => {
    expect(credentialParams('reset/:token')).toEqual(['token']);
    expect(credentialParams(':resetToken')).toEqual(['resettoken']);
    expect(credentialParams(':code')).toEqual(['code']);
    // Names that spell like one and grant nothing.
    expect(credentialParams('users/:id/roles/:roleCode')).toEqual([]);
    expect(credentialParams(':certificateNumber')).toEqual([]);
    expect(credentialParams(':agentCode')).toEqual([]);
    // The word in prose is not a declaration; only the decorator position counts.
    expect([...'// never put a :token in a path'.matchAll(ROUTE_DECORATOR)]).toEqual([]);
  });

  it('names every route that would put a credential in the log', () => {
    const offenders = routePaths()
      .flatMap(([file, path]) =>
        credentialParams(path).map((name) => `${file}: ${path} (:${name})`),
      )
      .sort();

    expect(offenders).toEqual([]);
  });
});
