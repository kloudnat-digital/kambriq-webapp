import NextAuth from 'next-auth';
import authConfig, { pageAuthConfig } from './auth.config';

/**
 * next-auth is configured with JWT strategy (no database adapter).
 *
 * Why no PrismaAdapter?
 * - PrismaAdapter is for database-backed sessions. It would create its own
 *   Account/Session tables that conflict with the NestJS backend's schema.
 * - With strategy: 'jwt', the session lives entirely in an encrypted httpOnly
 *   cookie managed by next-auth - no database reads per request.
 * - The NestJS backend is the source of truth for users and refresh tokens.
 */
/**
 * A47, second half - two instances over ONE cookie, split by who can write it.
 *
 * The proxy and the `/api/auth` route handlers write the session cookie back to
 * the browser, so they are the only ones allowed to refresh: `authForProxy`,
 * `handlers`, `signIn` and `signOut` use `authConfig`. A plain `auth()` in a
 * page or a server action drops the `set-cookie`, so a refresh there revoked
 * the browser's token and saved nothing: pages read with `pageAuthConfig`,
 * which never refreshes. Same secret, same cookie name - one session.
 */
export const {
  handlers,
  auth: authForProxy,
  signIn,
  signOut,
} = NextAuth({
  session: { strategy: 'jwt' },
  ...authConfig,
});

export const { auth } = NextAuth({
  session: { strategy: 'jwt' },
  ...pageAuthConfig,
});
