export interface JwtPayload {
  sub: string; // userId
  email: string;
  roles: string[]; // role codes
  lang: string;
  iat?: string;
  exp?: string;
}

export interface RequestUser {
  id: string;
  email: string;
  roles: string[];
  lang: string;
}
