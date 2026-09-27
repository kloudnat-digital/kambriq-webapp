/**
 * D28 - what a request log line may say about a URL, for the API and the web.
 *
 * An **allowlist** (Visquis, 27 September): the query keys below keep their
 * value; every other value is written as `[redacted]`, and so is any fragment.
 * Never a denylist - five email links carry a credential in their query
 * (`verify-email`, `reset-password`, `set-password`, `confirm-email-change`,
 * each `?token=`), and a denylist is exactly the list that forgets the next one.
 *
 * Applied **before** the line is written, so no log group, export or console
 * ever holds the value. No dependency: the web proxy imports it too.
 */
export const LOGGED_QUERY_KEYS: ReadonlySet<string> = new Set([
  'page',
  'limit',
  'depth',
  'sort',
  'order',
  'status',
]);

export const REDACTED = '[redacted]';

const decodeKey = (raw: string): string => {
  try {
    return decodeURIComponent(raw.replace(/\+/g, ' '));
  } catch {
    return raw;
  }
};

/** A URL (path or absolute) with every non-allowed query value and any fragment redacted. */
export const maskUrl = (url: string): string => {
  const hash = url.indexOf('#');
  const withoutHash = hash >= 0 ? url.slice(0, hash) : url;
  const fragment = hash >= 0 ? `#${REDACTED}` : '';
  const q = withoutHash.indexOf('?');
  if (q < 0) return withoutHash + fragment;
  const query = withoutHash
    .slice(q + 1)
    .split('&')
    .filter(Boolean)
    .map((pair) => {
      const eq = pair.indexOf('=');
      const key = eq >= 0 ? pair.slice(0, eq) : pair;
      return LOGGED_QUERY_KEYS.has(decodeKey(key)) ? pair : `${key}=${REDACTED}`;
    })
    .join('&');
  return `${withoutHash.slice(0, q)}?${query}${fragment}`;
};

/** A parsed query object, masked the same way. */
export const maskQuery = (query: Record<string, unknown> | undefined): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(query ?? {}).map(([k, v]) => [
      k,
      LOGGED_QUERY_KEYS.has(k) && typeof v === 'string' ? v : REDACTED,
    ]),
  );
