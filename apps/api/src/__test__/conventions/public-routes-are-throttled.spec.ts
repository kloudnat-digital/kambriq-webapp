import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * P11 - an anonymous route carries a rate limit, or says why it does not.
 *
 * ---------------------------------------------------------------------------
 * Why this exists, and why a comment was not enough
 * ---------------------------------------------------------------------------
 * `GET /kbs/public/verify/:kcaNumber` answered without a token and without a
 * throttle from the day it shipped. `kamnet-public.controller.ts` then recorded
 * that fact in a code comment - "the other anonymous route in this API carries
 * no throttle at all, and that is the gap this one does not repeat" - which on
 * a PUBLIC repository is an open weakness with a signpost next to it.
 *
 * The number is guessable. `verifyCertificate`'s own docstring says so: "KCA
 * numbers are a date and four hex characters, so they can be enumerated."
 * 65,536 requests per issue date separate the numbers KAMBRIQ has issued from
 * the ones it has not, and a VALID verdict says somebody holds a current
 * certificate. The route deliberately returns no name, which keeps the harvest
 * thin - but thin is not a rate limit.
 *
 * So the throttle is on the route now, and this file is what keeps it there. A
 * guard beats a comment: a comment describes the state of the code on the day
 * somebody wrote it, and this fails in CI on the day somebody changes it.
 *
 * ---------------------------------------------------------------------------
 * Exemptions are a list with reasons, not a regex with a hole
 * ---------------------------------------------------------------------------
 * "Every public route must be throttled" is false here, and a test that
 * asserted it would have been deleted by the first person it blocked - the fate
 * of every guard that cries wolf. Three public routes legitimately carry no
 * throttle: the health checks. Both kinds are named
 * below with which they are, the same shape as
 * `ROLE_FREE_CANDIDATE_ROUTES` in `route-guards.spec.ts`.
 */
const API_SRC = join(__dirname, '..', '..');

const walk = (dir: string): string[] => {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (entry.endsWith('.controller.ts')) out.push(full);
  }
  return out;
};

/** Comments are stripped, so a sentence mentioning a decorator is never one. */
const stripComments = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const HTTP = /^\s*@(Get|Post|Put|Patch|Delete)\(\s*(?:'([^']*)')?/;

type PublicRoute = { file: string; route: string; throttled: boolean };

/**
 * Every `@Public()` route, and whether its own decorator stack throttles it.
 *
 * The stack is read in BOTH directions from the HTTP decorator - up until a
 * blank line or the previous method's close, then down to the method's opening
 * brace - because a decorator may sit either side of `@Get`. This is A20's
 * parser in `contract-guard-parity.spec.ts`, deliberately: two files that
 * disagree about what a route's decorators are would be worse than one.
 */
const publicRoutes = (file: string): PublicRoute[] => {
  const rel = relative(API_SRC, file);
  const lines = stripComments(readFileSync(file, 'utf8')).split('\n');
  const clsIdx = lines.findIndex((l) => l.trim().startsWith('export class'));
  const classRegion = lines.slice(0, clsIdx === -1 ? lines.length : clsIdx).join('\n');
  const classThrottle = /^\s*@Throttle\(/m.test(classRegion);
  const classPublic = /^\s*@Public\(\)/m.test(classRegion);

  const out: PublicRoute[] = [];
  for (let i = 0; i < lines.length; i++) {
    const mark = HTTP.exec(lines[i]);
    if (!mark) continue;

    const up: string[] = [];
    for (let k = i - 1; k > clsIdx; k--) {
      const s = lines[k].trim();
      if (s === '' || s === '}') break;
      up.push(lines[k]);
    }
    const down: string[] = [lines[i]];
    for (let k = i + 1; k < lines.length; k++) {
      down.push(lines[k]);
      if (/\)\s*(:\s*[^={]+)?\s*\{/.test(lines[k]) || lines[k].trim().endsWith('{')) break;
    }
    const block = [...up, ...down].join('\n');

    if (!(classPublic || /@Public\(\)/.test(block))) continue;

    out.push({
      file: rel,
      route: `${mark[1].toUpperCase()} ${mark[2] ?? ''}`.trim(),
      throttled: classThrottle || /@Throttle\(/.test(block),
    });
  }
  return out;
};

/**
 * Public routes that carry no `@Throttle`, each with the reason.
 *
 * Two kinds, and the difference matters:
 *
 * **Deliberate.** `health` is polled continuously by the ALB target group and
 * by ECS. A rate limit there would make the load balancer's own checks fail and
 * pull healthy tasks out of service - the limiter would be the outage.
 *
 * The five `auth` routes P11 listed here as "inherited and not examined" -
 * refresh, logout, verify-email, reset-password, reactivate - carry their own
 * limits since A41, chosen per route against a measurement of how they are
 * really called (`auth-anonymous-routes-throttled.spec.ts`). Only the health
 * checks remain, and they remain on purpose.
 */
const UNTHROTTLED_BY_DECISION: Record<string, readonly string[]> = {
  'health/health.controller.ts': ['GET', 'GET ready', 'GET version'],
};

const key = (r: PublicRoute) => `${r.file} :: ${r.route}`;

const isExempt = (r: PublicRoute) => (UNTHROTTLED_BY_DECISION[r.file] ?? []).includes(r.route);

describe('P11 - every public route is throttled, or is listed as deliberately not', () => {
  const routes = walk(API_SRC)
    .filter((f) => !f.includes('__test__'))
    .flatMap(publicRoutes);

  /**
   * A parser that found nothing would pass every assertion below it. The count
   * is a floor rather than an equality so that ADDING a public route does not
   * fail here - it fails on the throttle assertion, which is the one that
   * matters.
   */
  it('is reading the public surface it thinks it is', () => {
    expect(routes.length).toBeGreaterThanOrEqual(16);
    expect(routes.map(key)).toContain('core/contact/contact.controller.ts :: POST requests');
    expect(routes.map(key)).toContain(
      'kamnet/controllers/kamnet-public.controller.ts :: GET agents',
    );
  });

  it('throttles every public route that is not listed as deliberately unthrottled', () => {
    const unguarded = routes.filter((r) => !r.throttled && !isExempt(r)).map(key);

    expect(unguarded).toEqual([]);
  });

  /**
   * The route this subject exists for, asserted by name.
   *
   * The assertion above would also pass if this route were quietly added to
   * `UNTHROTTLED_BY_DECISION`, so the specific claim is made specifically.
   */
  it('throttles the certificate verifier, whose numbers are enumerable', () => {
    const verify = routes.find(
      (r) => key(r) === 'kbs/controllers/kbs-public.controller.ts :: GET verify/:kcaNumber',
    );

    expect(verify).toBeDefined();
    expect(verify?.throttled).toBe(true);
    expect(isExempt(verify as PublicRoute)).toBe(false);
  });

  /**
   * The exemption list has to rot loudly.
   *
   * An entry that no longer names a public route, or names one that has since
   * gained a throttle, is a stale exemption - and a stale exemption is exactly
   * how a list like this stops describing the code it governs.
   */
  it('lists no exemption that is stale', () => {
    const live = new Set(routes.map(key));
    const stale: string[] = [];

    for (const [file, exempted] of Object.entries(UNTHROTTLED_BY_DECISION)) {
      for (const route of exempted) {
        const k = `${file} :: ${route}`;
        if (!live.has(k)) stale.push(`${k} - no longer a public route`);
        else if (routes.find((r) => key(r) === k)?.throttled) {
          stale.push(`${k} - now throttled, so the exemption can go`);
        }
      }
    }

    expect(stale).toEqual([]);
  });
});
