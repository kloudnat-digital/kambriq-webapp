import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

/**
 * Every `kambriq.com` host written into a URL is one that exists.
 *
 * A runbook told the operator to point `KAMBRIQ_API_URL` at a host with no DNS
 * record. Sanity accepts such a webhook, reports it as configured, and delivers
 * nothing, so the archive it feeds stays empty while every step reports success.
 *
 * The check is offline on purpose. Resolving a name in CI would make the suite
 * depend on DNS and on a runner's egress, and a lookup that cannot be made is
 * indistinguishable from a name that does not exist. The list below is the
 * comparison instead: short, a fact about the zone, and a host added to a runbook
 * without being added here is the thing worth stopping.
 */

const ROOT = join(__dirname, '..', '..', '..', '..', '..');

/**
 * The hosts the zone answers for. Both measured on 2026-09-26:
 * `dev.kambriq.com` resolves to two addresses and answers, and `kambriq.com` is
 * the apex the site will be served from.
 *
 * A wildcard is deliberately not accepted here. `A40` is the entry: a pattern in
 * a host list is a list of everyone who can register a name under it, and there
 * is no reason for this repository to write one.
 */
const REAL_HOSTS = ['kambriq.com', 'dev.kambriq.com'] as const;

const SEARCHED = [
  'apps/api/src',
  'apps/web/src',
  'apps/api-e2e/src',
  'apps/web-e2e/src',
  'libs/common/src',
  'prisma',
  'scripts',
  'docs',
  '.github',
  'studio',
];

const EXTENSIONS = ['.ts', '.tsx', '.md', '.yml', '.yaml', '.json', '.example', '.sh'];

const SKIPPED_DIRS = new Set(['node_modules', '.next', 'dist', 'out-tsc', 'migrations', '.sanity']);

const walk = (dir: string): string[] => {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (SKIPPED_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (EXTENSIONS.includes(extname(entry))) out.push(full);
  }
  return out;
};

const FILES = [
  ...SEARCHED.flatMap((d) => walk(join(ROOT, d))),
  join(ROOT, 'CLAUDE.md'),
  join(ROOT, 'README.md'),
]
  .filter((f) => {
    try {
      return statSync(f).isFile();
    } catch {
      return false;
    }
  })
  .map((f) => relative(ROOT, f));

/**
 * A host in URL position, which is the only position that reaches a resolver.
 *
 * `://` is required, and that is the whole design. A sweep for the bare string
 * would flag any sentence naming a host in order to rule it out, so the guard
 * would forbid its own documentation. CLAUDE.md has that under "a sweep that
 * counts a token counts it in prose too". Comments are not stripped, because a
 * URL in a docstring is exactly what this is about.
 */
// The leading labels are optional, so the apex matches too: `kambriq.com` is the
// host production will be served from, and the one most likely to be written
// wrong.
const HOST_IN_URL = /:\/\/([^\s/'"`)\]<>]*kambriq\.com)/g;

const hostsIn = (file: string): string[] =>
  [...readFileSync(join(ROOT, file), 'utf8').matchAll(HOST_IN_URL)].map((m) => m[1]);

describe('every kambriq.com host in a URL is one that exists', () => {
  it('is looking at the tree at all', () => {
    // A scanner that finds nothing makes every assertion below vacuous: the
    // measurement failing quietly rather than the thing measured.
    expect(FILES.length).toBeGreaterThan(200);
    expect(FILES).toContain('studio/README.md');
    expect(FILES).toContain('scripts/sanity/upsert-policy-webhook.ts');
    expect(FILES).toContain('docs/ops/registre-chantiers.md');
  });

  it('finds the hosts that are there, so the regex is not matching nothing', () => {
    const all = new Set(FILES.flatMap(hostsIn));
    expect([...all].sort()).toEqual([...REAL_HOSTS].sort());
  });

  it('names every file whose URL points at a host that does not exist', () => {
    const offenders = FILES.flatMap((file) =>
      hostsIn(file)
        .filter((host) => !(REAL_HOSTS as readonly string[]).includes(host))
        .map((host) => `${file}: https://${host}`),
    );

    expect(offenders).toEqual([]);
  });

  it('matches a host in URL position and not a host merely named', () => {
    // The position rule, on a fixture rather than on prose elsewhere in the
    // repository: that coupling would break the moment somebody tidied a file.
    // Composed, so the fixture is not itself a URL in a file this spec scans.
    const host = `bad.${'kambriq'}.com`;
    const named = `the host ${host} is not used here`;
    const used = `curl https://${host}/api/v1`;

    expect([...named.matchAll(HOST_IN_URL)].map((m) => m[1])).toEqual([]);
    expect([...used.matchAll(HOST_IN_URL)].map((m) => m[1])).toEqual(['bad.kambriq.com']);
  });

  it('the webhook path already carries the API prefix, so the host must not', () => {
    // The two halves are one URL. `POLICY_WEBHOOK_PATH` starting with `/api/v1`
    // is what makes the site's own host the right value for `KAMBRIQ_API_URL`,
    // and a reader who assumes a separate API host writes the name that does
    // not resolve.
    const contract = readFileSync(join(ROOT, 'libs/common/src/cms/legal-policy.ts'), 'utf8');
    expect(contract).toContain("POLICY_WEBHOOK_PATH = '/api/v1/cms/webhooks/sanity'");
  });
});
