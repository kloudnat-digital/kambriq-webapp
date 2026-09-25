import type { Session } from 'next-auth';

/**
 * The session as a browser is allowed to see it.
 *
 * `Session.accessToken` is the API bearer token. It exists so that server code
 * can attach it to backend calls (`lib/api/server.ts`), and it must never be
 * serialised to a client.
 */
export type ClientSession = Omit<Session, 'accessToken'>;

/**
 * Strips the API bearer token from a session before it crosses into client
 * code.
 *
 * `<Providers>` is a Client Component, so everything passed to it is
 * serialised into the RSC payload that every browser downloads. Passing the
 * whole `auth()` result therefore published the bearer token on every
 * authenticated page, in plain text, to anyone who read the response body -
 * including a shared machine's disk cache and any browser extension.
 *
 * The route handler at `app/api/auth/[...nextauth]` already strips the same
 * field from the `/api/auth/session` response, which closed one of the two
 * ways out and left this one open. Nothing on the client reads the token: the
 * only reader is `lib/api/server.ts`, which is `server-only`.
 */
export const sessionForClient = (session: Session | null): ClientSession | null => {
  if (!session) return null;

  const clientSession: ClientSession & { accessToken?: string } = { ...session };
  delete clientSession.accessToken;
  return clientSession;
};
