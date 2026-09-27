/**
 * D28 - one line per web page request, written by the proxy: who (the visitor's
 * address as the load balancer saw it, the account), what, when - and no token
 * or password from the URL. Mocks as in proxy.spec.ts: the proxy runs raw.
 */
jest.mock('next/server', () => ({
  NextResponse: {
    next: () => ({ kind: 'next' }),
    redirect: (url: URL) => ({ kind: 'redirect', url: url.toString() }),
  },
}));
jest.mock('next-intl/middleware', () => ({
  __esModule: true,
  default: () => () => ({ kind: 'intl' }),
}));
jest.mock('./auth', () => ({ authForProxy: (handler: unknown) => handler }));

import proxy from './proxy';
import { accessLine } from './lib/access-log';

type Session = { user?: { id?: string; roles?: string[] } } | null;

const run = (path: string, session: Session, headers: Record<string, string> = {}) => {
  const written: string[] = [];
  const spy = jest.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
    written.push(String(chunk));
    return true;
  });
  try {
    (proxy as unknown as (req: unknown) => unknown)({
      method: 'GET',
      nextUrl: new URL(`https://app.test${path}`),
      headers: new Headers(headers),
      auth: session,
    });
  } finally {
    spy.mockRestore();
  }
  return written.map((l) => JSON.parse(l));
};

describe('D28 - the web proxy writes one access line per page request', () => {
  it.each([
    '/fr/verify-email?token=SECRET-1',
    '/fr/reset-password?token=SECRET-2',
    '/fr/auth/set-password?token=SECRET-3',
    '/fr/auth/confirm-email-change?token=SECRET-4',
    '/fr/login?email=a%40b.cm&password=SECRET-5',
  ])('%s is written without its credential', (path) => {
    const lines = run(path, null, { 'x-forwarded-for': '203.0.113.9' });
    expect(lines).toHaveLength(1);
    expect(JSON.stringify(lines[0])).not.toMatch(/SECRET-\d/);
    expect(lines[0]).toMatchObject({ kind: 'access', method: 'GET', visitorIp: '203.0.113.9' });
    expect(lines[0].url).toContain('[redacted]');
  });

  it('names the signed-in account, and keeps the page number', () => {
    const lines = run('/fr/lands?page=2', { user: { id: 'user-42', roles: ['CLIENT'] } });
    expect(lines[0]).toMatchObject({ url: '/fr/lands?page=2', userId: 'user-42' });
  });

  it('takes the last forwarded hop, the one the load balancer appended', () => {
    const line = accessLine(
      {
        method: 'GET',
        nextUrl: new URL('https://app.test/fr'),
        headers: new Headers({ 'x-forwarded-for': '10.9.9.9, 198.51.100.7' }),
      },
      undefined,
    );
    expect(line.visitorIp).toBe('198.51.100.7');
  });
});
