/**
 * What a token is for.
 *
 * Both tokens were signed from one payload with one secret and carried nothing
 * to tell them apart, so a refresh token was accepted as a bearer token by
 * every route - for its full 30 days, and past a logout, because revoking a
 * refresh token only removes the database row the refresh path reads.
 */
export type TokenType = 'access' | 'refresh';

export interface JwtPayload {
  sub: string; // userId
  email: string;
  roles: string[]; // role codes
  lang: string;
  type: TokenType;
  iat?: number;
  exp?: number;
}

export interface RequestUser {
  id: string;
  email: string;
  roles: string[];
  lang: string;
}
