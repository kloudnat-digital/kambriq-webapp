import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  /**
   * The shape of the user object returned by authorize().
   * next-auth merges this into the JWT via the jwt() callback.
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
    /** Unix timestamp in ms */
    expiresAt: number;
  }

  /**
   * What useSession() / auth() exposes to the app.
   * Never includes the refresh token.
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
    accessToken: string;
    /** Set when token refresh failed - the app should redirect to /login */
    error?: 'RefreshTokenError';
  }
}

declare module 'next-auth/jwt' {
  /**
   * What lives encrypted inside next-auth's httpOnly session cookie.
   * Includes the refresh token so the jwt() callback can rotate it server-side.
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
    /** Unix timestamp in ms */
    expiresAt: number;
    error?: 'RefreshTokenError';
  }
}
