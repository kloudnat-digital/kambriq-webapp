import { maskQuery, maskUrl, REDACTED } from '../../logging/url-allowlist';

/**
 * D28 - what a request line may say about a URL. An **allowlist**, never a
 * denylist: a denylist forgets the next parameter, and the password-reset token
 * is exactly the parameter it would have forgotten.
 */
describe('D28 - a logged URL keeps only the query values it is allowed to', () => {
  it.each([
    ['/fr/verify-email?token=abc123', '/fr/verify-email?token=[redacted]'],
    ['/fr/reset-password?token=abc123', '/fr/reset-password?token=[redacted]'],
    ['/fr/auth/set-password?token=abc123', '/fr/auth/set-password?token=[redacted]'],
    [
      '/fr/auth/confirm-email-change?token=abc123',
      '/fr/auth/confirm-email-change?token=[redacted]',
    ],
    [
      '/fr/login?email=a%40b.cm&password=Hunter2!',
      '/fr/login?email=[redacted]&password=[redacted]',
    ],
  ])('%s', (url, logged) => {
    expect(maskUrl(url)).toBe(logged);
  });

  it('keeps the paging and sorting values an investigation needs', () => {
    expect(maskUrl('/api/v1/users?limit=100&page=3&sort=createdAt&order=desc')).toBe(
      '/api/v1/users?limit=100&page=3&sort=createdAt&order=desc',
    );
  });

  it('redacts a key nobody has thought of yet - the point of an allowlist', () => {
    expect(maskUrl('/fr/anything?next_secret_param=xyz&page=2')).toBe(
      '/fr/anything?next_secret_param=[redacted]&page=2',
    );
  });

  it('never keeps a fragment, and handles absolute URLs as a referer carries them', () => {
    expect(maskUrl('https://dev.kambriq.com/fr/reset-password?token=abc#t=xyz')).toBe(
      'https://dev.kambriq.com/fr/reset-password?token=[redacted]#[redacted]',
    );
  });

  it('leaves a URL without a query untouched', () => {
    expect(maskUrl('/fr/lands/00000000-0000-4000-8000-e00000000011')).toBe(
      '/fr/lands/00000000-0000-4000-8000-e00000000011',
    );
  });

  it('masks a parsed query object the same way, arrays included', () => {
    expect(maskQuery({ page: '2', token: 'abc', tags: ['a', 'b'] })).toEqual({
      page: '2',
      token: REDACTED,
      tags: REDACTED,
    });
  });
});
