/**
 * Differentiates token purpose to ensure distinct authorization flows
 * for access and refresh operations.
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
