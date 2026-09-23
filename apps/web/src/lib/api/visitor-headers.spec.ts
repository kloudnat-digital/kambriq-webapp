jest.mock('next/headers', () => ({ headers: jest.fn() }));

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { headers } from 'next/headers';
import { CALLER_SECRET_HEADER, VISITOR_IP_HEADER, visitorHeaders } from './visitor-headers';

const incoming = headers as unknown as jest.Mock;
const SECRET = 'a45-web-secret-0123456789abcdef0123456789abcdef';
const env = { WEB_CALLER_SECRET: SECRET } as unknown as NodeJS.ProcessEnv;
const forwardedFor = (value: string | null) =>
  incoming.mockResolvedValue({ get: (k: string) => (k === 'x-forwarded-for' ? value : null) });

/**
 * A45 - what the web adds to a call it makes for a visitor.
 */
describe('A45 - visitorHeaders', () => {
  beforeEach(() => jest.resetAllMocks());

  it("sends the visitor's address, the last hop the ALB appended, with the secret", async () => {
    forwardedFor('10.66.66.66, 198.51.100.21');
    await expect(visitorHeaders(env)).resolves.toEqual({
      [VISITOR_IP_HEADER]: '198.51.100.21',
      [CALLER_SECRET_HEADER]: SECRET,
    });
  });

  it('sends nothing when the secret is not configured', async () => {
    forwardedFor('198.51.100.21');
    await expect(visitorHeaders({} as NodeJS.ProcessEnv)).resolves.toEqual({});
  });

  it('sends nothing outside a request, where headers() throws', async () => {
    incoming.mockRejectedValue(new Error('headers was called outside a request scope'));
    await expect(visitorHeaders(env)).resolves.toEqual({});
  });

  it.each([[null], [''], ['not-an-address'], ['198.51.100.21, not-an-address']])(
    'sends nothing when the forwarded value is %p, whose last hop is not an address',
    async (value) => {
      forwardedFor(value);
      await expect(visitorHeaders(env)).resolves.toEqual({});
    },
  );

  it('accepts an IPv6 visitor', async () => {
    forwardedFor('2001:db8::7');
    await expect(visitorHeaders(env)).resolves.toEqual({
      [VISITOR_IP_HEADER]: '2001:db8::7',
      [CALLER_SECRET_HEADER]: SECRET,
    });
  });
});

/**
 * Every call the web server makes to the API carries the headers. A new fetch
 * that forgets them would quietly go back to one bucket for the whole site.
 */
describe('A45 - every server-side call to the API vouches for its visitor', () => {
  const read = (p: string) => readFileSync(join(__dirname, '..', '..', p), 'utf8');

  it('in auth.config.ts, each of the four fetches to the API', () => {
    const src = read('auth.config.ts');
    const fetches = src.match(/await fetch\(`\$\{API_URL\}\/api\/v1\//g) ?? [];
    const vouched = src.match(/\.\.\.\(await visitorHeaders\(\)\)/g) ?? [];
    expect(fetches).toHaveLength(4);
    expect(vouched).toHaveLength(fetches.length);
  });

  it("in the API client's one fetch", () => {
    expect(read('lib/api/server.ts')).toMatch(/\.\.\.\(await visitorHeaders\(\)\),/);
  });
});
