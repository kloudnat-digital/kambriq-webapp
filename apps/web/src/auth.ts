import NextAuth from 'next-auth';
import authConfig from './auth.config';

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
export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: 'jwt' },
  ...authConfig,
});
