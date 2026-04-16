import { type NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

export default {
  providers: [
    Credentials({
      /**
       * Declares what fields the sign-in form sends.
       * next-auth passes these as strings - booleans need manual coercion.
       */
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        rememberMe: { label: 'Remember me', type: 'checkbox' },
      },

      /**
       * Runs server-side when signIn('credentials', { ... }) is called.
       * Calls the NestJS backend and returns the user + tokens on success,
       * or null on failure (next-auth will show an error page/callback).
       */
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const res = await fetch(`${API_URL}/api/v1/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: credentials.email,
            password: credentials.password,
            // credentials are always strings - coerce the checkbox value
            rememberMe: credentials.rememberMe === 'true',
          }),
        });

        // NestJS wraps all responses in { success: true, data: { ... } }
        const body = await res.json().catch(() => ({}));

        if (!res.ok) {
          // Throw the real API error message so logInAction can surface it to the user.
          // Returning null here would silently swallow lock messages, attempt counts, etc.
          throw new Error(body?.message ?? 'Authentication failed');
        }

        const { data } = body;

        // Grace period - account soft-deleted but within the reactivation window.
        // The API returns 200 OK with requiresReactivation instead of tokens.
        // We signal this to logInAction via a structured JSON error.
        if (data?.requiresReactivation) {
          throw new Error(
            JSON.stringify({
              code: 'REACTIVATION_REQUIRED',
              userId: data.userId,
              daysRemaining: data.daysRemaining,
            }),
          );
        }

        return {
          id: data.user.id,
          email: data.user.email,
          firstName: data.user.firstName,
          lastName: data.user.lastName,
          roles: data.user.roles,
          language: data.user.language,
          accessToken: data.tokens.accessToken,
          refreshToken: data.tokens.refreshToken,
          expiresAt: new Date(data.tokens.expiresAt).getTime(),
        };
      },
    }),
  ],

  pages: {
    signIn: '/login',
    error: '/login',
  },

  callbacks: {
    /**
     * jwt() runs every time the session is read (server-side).
     * On first sign-in: `user` is populated - we copy everything into the token.
     * On subsequent calls: we check if the access token has expired and refresh it.
     */
    async jwt({ token, user }) {
      // Initial sign-in - populate the token from the user returned by authorize()
      if (user) {
        return {
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            roles: user.roles,
            language: user.language,
          },
          accessToken: user.accessToken,
          refreshToken: user.refreshToken,
          expiresAt: user.expiresAt,
        };
      }

      // Access token still valid - return as-is
      // 60s buffer so we refresh before it actually expires
      if (Date.now() < token.expiresAt - 60_000) {
        return token;
      }

      // Access token expired - ask the NestJS backend for a new one
      try {
        const res = await fetch(`${API_URL}/api/v1/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: token.refreshToken }),
        });

        if (!res.ok) throw new Error(`Refresh failed: ${res.status}`);

        const { data } = await res.json();

        return {
          ...token,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken ?? token.refreshToken,
          expiresAt: new Date(data.expiresAt).getTime(),
          error: undefined,
        };
      } catch {
        // Refresh failed (token revoked, server down, etc.)
        // Signal to the app that the session is broken → redirect to login
        return { ...token, error: 'RefreshTokenError' as const };
      }
    },

    /**
     * session() shapes what useSession() / auth() returns to the app.
     * We expose the user and accessToken but never the refreshToken.
     */
    async session({ session, token }) {
      return {
        ...session,
        user: token.user,
        accessToken: token.accessToken,
        error: token.error,
      };
    },
  },
} satisfies NextAuthConfig;
