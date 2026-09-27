import { maskUrl } from '@kambriq/common/logging/url-allowlist';

/**
 * D28 - the web's access line: one per page request, written by the proxy,
 * which runs on the URLs the site serves and on nothing else (no assets).
 *
 * Who: the visitor's address - the last `x-forwarded-for` hop, the one the load
 * balancer appended, the same rule `visitor-headers.ts` vouches to the API - and
 * the account id when signed in. What and when: method, URL, time. The URL goes
 * through the shared allowlist first, so the five email links that carry a
 * `?token=` are written `token=[redacted]`.
 *
 * JSON on stdout, one line, so CloudWatch Insights reads its fields. Not
 * `console.log` (banned) and not the winston logger (`server-only`, and its
 * lines are not JSON). Status is not known here - the proxy runs before the page.
 */
type ProxyRequest = {
  method?: string;
  nextUrl: URL;
  headers?: { get(name: string): string | null };
};

const lastHop = (forwarded: string | null | undefined): string | undefined =>
  (forwarded ?? '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
    .pop();

export const accessLine = (req: ProxyRequest, userId: string | undefined) => ({
  kind: 'access' as const,
  time: new Date().toISOString(),
  method: req.method ?? 'GET',
  url: maskUrl(`${req.nextUrl.pathname}${req.nextUrl.search}`),
  visitorIp: lastHop(req.headers?.get('x-forwarded-for')),
  userId,
  userAgent: req.headers?.get('user-agent') ?? undefined,
});

/** Never lets logging break a request. */
export const writeAccessLine = (line: ReturnType<typeof accessLine>): void => {
  try {
    process.stdout.write(`${JSON.stringify(line)}\n`);
  } catch {
    // A write failure is not the visitor's problem.
  }
};
