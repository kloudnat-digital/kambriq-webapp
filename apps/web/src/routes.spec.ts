import {
  AUTH_ROUTES,
  PUBLIC_PATHS,
  REDIRECT_WHEN_AUTHED,
  ROLE_DEFAULTS,
  getDefaultRoute,
  isPublic,
  matchGate,
} from './routes';

// These three helpers decide every branch in proxy.ts. isPublic in particular
// is what silently fixed the May redirect loop in August: the loop guard reads
// `!isPublic(pathname)`, so a change to PUBLIC_PATHS can reintroduce the bug
// without anyone touching proxy.ts. Nothing guarded that until now.

describe('isPublic', () => {
  it.each(PUBLIC_PATHS)('treats the declared public path %s as public', (p) => {
    expect(isPublic(p)).toBe(true);
  });

  it('treats a sub-path of a public prefix as public', () => {
    // /legal and /products have no index page; they exist as prefixes.
    expect(isPublic('/legal/privacy')).toBe(true);
    expect(isPublic('/products/lands')).toBe(true);
    expect(isPublic('/verify-certificate/KCA-123')).toBe(true);
  });

  it('does not treat a protected path as public', () => {
    expect(isPublic('/mylands')).toBe(false);
    expect(isPublic('/admin/kbs')).toBe(false);
    expect(isPublic('/agent/dashboard')).toBe(false);
  });

  it('does not match on a bare string prefix', () => {
    // '/logins' must not be public just because it starts with '/login'.
    expect(isPublic('/logins')).toBe(false);
    expect(isPublic('/planning')).toBe(false);
  });

  it('keeps /login public, which is what breaks the redirect loop', () => {
    expect(isPublic(AUTH_ROUTES.LOGIN)).toBe(true);
  });
});

describe('matchGate', () => {
  it('matches an exact gate prefix', () => {
    expect(matchGate('/admin/kbs')?.roles).toEqual(['ADMIN_KBS', 'ADMIN_GLOBAL']);
    expect(matchGate('/agent')?.roles).toEqual(['AGENT', 'ADMIN_GLOBAL']);
  });

  it('matches a sub-path of a gate prefix', () => {
    expect(matchGate('/admin/kbs/candidates')?.roles).toEqual(['ADMIN_KBS', 'ADMIN_GLOBAL']);
  });

  it('does not match on a bare string prefix', () => {
    // '/landing' must not be gated by the '/land' rule.
    expect(matchGate('/landing')).toBeUndefined();
  });

  it('returns undefined for an ungated path', () => {
    expect(matchGate('/mylands')).toBeUndefined();
    expect(matchGate('/login')).toBeUndefined();
  });
});

describe('getDefaultRoute', () => {
  it.each(Object.entries(ROLE_DEFAULTS))('routes %s to %s', (role, expected) => {
    expect(getDefaultRoute([role])).toBe(expected);
  });

  it('falls back to /mylands for no roles or an unknown role', () => {
    expect(getDefaultRoute([])).toBe('/mylands');
    expect(getDefaultRoute(['NOT_A_ROLE'])).toBe('/mylands');
  });

  it('takes the first role that has a default', () => {
    expect(getDefaultRoute(['NOT_A_ROLE', 'AGENT'])).toBe('/lands');
  });

  // The invariant that makes the REDIRECT_WHEN_AUTHED branch safe: if a default
  // route were ever an auth route, an authenticated user landing on /login would
  // be redirected to /login forever.
  it.each([...Object.keys(ROLE_DEFAULTS), 'NOT_A_ROLE'])(
    'never routes %s to an auth route',
    (role) => {
      const target = getDefaultRoute([role]);
      expect(Object.values(AUTH_ROUTES)).not.toContain(target);
      expect(REDIRECT_WHEN_AUTHED).not.toContain(target);
    },
  );
});
