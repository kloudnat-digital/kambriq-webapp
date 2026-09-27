import { safeCallbackUrl } from './routes';

/**
 * P3 - `callbackUrl` is constrained to internal paths.
 *
 * **Read since I45 (27 September):** `logInAction` signs in with
 * `redirectTo: safeCallbackUrl(callbackUrl, '/')`. Until then it used the
 * literal `'/'`, so every `callbackUrl` the proxy wrote was read by nobody, and
 * a signed-out person following the email-change link came back to their home
 * page instead of the confirmation.
 *
 * Written the obvious way - `redirectTo: searchParams.callbackUrl` - it would
 * be a textbook open redirect immediately after somebody types a password. So
 * the value is constrained where it is written AND where it is read, by this
 * guard; `lib/actions/login-callback.spec.ts` holds the read.
 */
describe('P3 - safeCallbackUrl', () => {
  describe('accepts internal paths', () => {
    it.each([
      '/',
      '/mylands',
      '/admin/payments',
      '/mylands/payment/3f2504e0-4f89-41d3-9a0c-0305e82c3301',
      '/lands?page=2',
      '/lands?q=douala&page=2',
      '/legal/privacy#section-3',
    ])('%p passes through unchanged', (path) => {
      expect(safeCallbackUrl(path)).toBe(path);
    });
  });

  describe('refuses anything that could leave the site', () => {
    it.each([
      ['https://evil.example/phish', 'an absolute external URL'],
      ['http://evil.example', 'an absolute URL over http'],
      ['//evil.example', 'protocol-relative, which a browser resolves as an origin'],
      ['///evil.example', 'three slashes, normalised to protocol-relative'],
      ['/\\evil.example', 'a backslash, which several browsers normalise to /'],
      ['\\\\evil.example', 'a UNC-looking path'],
      ['javascript:alert(1)', 'not a navigation to a page'],
      ['data:text/html,<script>', 'not a navigation to a page'],
      ['mylands', 'relative, so it resolves against whatever page is current'],
      ['../admin', 'relative traversal'],
      ['/\tevil.example', 'a tab, which browsers strip before parsing'],
      ['/\nevil.example', 'a newline, which browsers strip before parsing'],
    ])('%p is refused (%s)', (value) => {
      expect(safeCallbackUrl(value)).toBe('/');
    });

    it('falls back to the caller’s value when one is given', () => {
      expect(safeCallbackUrl('https://evil.example', '/mylands')).toBe('/mylands');
    });
  });

  describe('the empty cases', () => {
    it.each([
      [null, 'null'],
      [undefined, 'undefined'],
      ['', 'an empty string'],
    ])('%p falls back rather than producing an empty redirect', (value) => {
      expect(safeCallbackUrl(value as string | null | undefined)).toBe('/');
    });
  });

  it('the result is always something a URL can be built from', () => {
    // The property behind every case above: whatever comes out, resolving it
    // against our own origin must stay on our own origin.
    const hostile = [
      'https://evil.example',
      '//evil.example',
      '/\\evil.example',
      'javascript:alert(1)',
      '',
      'no-leading-slash',
    ];
    for (const value of hostile) {
      const resolved = new URL(safeCallbackUrl(value), 'https://kambriq.test');
      expect(resolved.origin).toBe('https://kambriq.test');
    }
  });
});
