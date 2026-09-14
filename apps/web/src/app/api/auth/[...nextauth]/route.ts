import type { NextRequest } from 'next/server';

import { handlers } from '@/auth';

export const { POST } = handlers;

/**
 * A23 - the API access token must never reach the browser.
 *
 * It lives in the encrypted session so the SERVER can attach it as a Bearer to
 * backend calls (lib/api/server.ts, via auth()). auth() computes the session
 * server-side WITHOUT going through this HTTP route, so stripping accessToken
 * from the /api/auth/session *response* here hides it from the client while
 * every server-side auth() caller still sees it. No client code reads it - the
 * platform is a BFF with no client-reachable data API, confirmed by grepping
 * apps/web for session.accessToken (only server.ts, server-only, reads it).
 *
 * This wraps only the session endpoint's response; every other auth route
 * (csrf, providers, callback, signin, signout) passes through untouched.
 */
export async function GET(req: NextRequest): Promise<Response> {
  const res = await handlers.GET(req);

  if (!req.nextUrl.pathname.endsWith('/session')) return res;
  if (!res.headers.get('content-type')?.includes('application/json')) return res;

  const data = await res
    .clone()
    .json()
    .catch(() => null);
  if (!data || typeof data !== 'object' || !('accessToken' in data)) return res;

  const safe: Record<string, unknown> = { ...(data as Record<string, unknown>) };
  delete safe.accessToken;
  const headers = new Headers(res.headers);
  headers.delete('content-length');
  return new Response(JSON.stringify(safe), { status: res.status, headers });
}
