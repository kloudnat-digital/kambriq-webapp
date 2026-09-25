import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  /**
   * User object structure returned by authorize().
   * Merged into the JWT via the jwt() callback.
   */
  interface User {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    roles: string[];
    language: string;
    accessToken: string;
    refreshToken: string;
    /** Expiration time of the access token (Unix timestamp in milliseconds). */
    accessExpiresAt: number;
  }

  /**
   * Session structure exposed to the application via useSession() or auth().
   * The refresh token is intentionally excluded.
   */
  interface Session {
    user: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      roles: string[];
      language: string;
    };
    /**
     * The API bearer token. Present server-side only.
     *
     * `auth()` always resolves it, and `lib/api/server.ts` is its only reader.
     * It is absent on the client in both directions: `sessionForClient` strips
     * it before the session reaches `<Providers>`, and the route handler at
     * `app/api/auth/[...nextauth]` strips it from the `/api/auth/session`
     * response that `useSession()` refetches.
     *
     * Optional rather than required for that reason. Declared required, the
     * compiler would promise client code a field that is never there.
     */
    accessToken?: string;
    /** Indicates a failed token refresh; triggers a redirect to /login. */
    error?: 'RefreshTokenError';
  }
}

declare module 'next-auth/jwt' {
  /**
   * Structure of the encrypted next-auth httpOnly session cookie.
   * Includes the refresh token to allow server-side rotation via the jwt() callback.
   */
  interface JWT {
    user: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      roles: string[];
      language: string;
    };
    accessToken: string;
    refreshToken: string;
    /** Expiration time of the access token (Unix timestamp in milliseconds). */
    accessExpiresAt: number;
    error?: 'RefreshTokenError';
  }
}
