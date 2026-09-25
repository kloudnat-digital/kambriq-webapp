import { createHash, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';

/**
 * A45 - whose rate-limit bucket a request spends.
 *
 * ---------------------------------------------------------------------------
 * What the deployment does, measured on dev (23 September)
 * ---------------------------------------------------------------------------
 * - The API's TCP peer is ALWAYS the ALB (`10.0.x.x`), so the connection
 *   cannot say who the caller is.
 * - The ALB **appends** the address it saw to `X-Forwarded-For` and never
 *   replaces it: a forged `X-Forwarded-For: A` arrives as `A, <real>`, so the
 *   last hop is trustworthy and every earlier one is the caller's choice.
 * - A call the web server makes for a visitor arrives with `X-Forwarded-For:
 *   <web task's public IP>`, one hop, and that address is new after every
 *   deploy (four different ones on 23 September). So the web cannot be
 *   recognised by its address, and every visitor it served shared one bucket
 *   per route.
 *
 * ---------------------------------------------------------------------------
 * The rule
 * ---------------------------------------------------------------------------
 * The web vouches for the visitor: it sends the visitor's address in
 * `x-kambriq-visitor-ip`, and proves it is the web with `x-kambriq-caller-secret`,
 * a value only the web and the API hold (`WEB_CALLER_SECRET`). The API believes
 * the address ONLY when that secret matches. Anything else - no secret
 * configured, no secret sent, a wrong one, an address that is not an address -
 * falls back to exactly what the guard did before: the last forwarded hop.
 *
 * A forwarded address believed from anybody would be worse than none: any
 * caller could pick its own bucket and the limits would stop meaning anything.
 */
export const VISITOR_IP_HEADER = 'x-kambriq-visitor-ip';
export const CALLER_SECRET_HEADER = 'x-kambriq-caller-secret';
export const CALLER_SECRET_ENV = 'WEB_CALLER_SECRET';

/** The shortest secret accepted. A short one is refused at startup, not used. */
export const MIN_CALLER_SECRET_LENGTH = 32;

/**
 * Request headers that must never reach a log line. The secret is the only
 * thing standing between a caller and a bucket of its choosing.
 */
export const REDACTED_REQUEST_HEADERS = [`req.headers["${CALLER_SECRET_HEADER}"]`];

type Headers = Record<string, string | string[] | undefined> | undefined;

const single = (value: string | string[] | undefined): string | undefined =>
  typeof value === 'string' ? value.trim() : undefined;

/** Reads `WEB_CALLER_SECRET` once. Unset is allowed; set and short is a misconfiguration. */
export const readCallerSecret = (env: NodeJS.ProcessEnv = process.env): string | null => {
  const secret = env[CALLER_SECRET_ENV]?.trim();
  if (!secret) return null;
  if (secret.length < MIN_CALLER_SECRET_LENGTH) {
    throw new Error(
      `${CALLER_SECRET_ENV} is set but shorter than ${MIN_CALLER_SECRET_LENGTH} characters. ` +
        'Set a long random value, or unset it to count every web call under the web task.',
    );
  }
  return secret;
};

/** Constant-time, and length-independent: both sides are hashed first. */
const sameSecret = (sent: string, expected: string): boolean =>
  timingSafeEqual(
    createHash('sha256').update(sent).digest(),
    createHash('sha256').update(expected).digest(),
  );

/** The visitor the web vouched for, or null when nothing trustworthy was sent. */
export const vouchedVisitor = (headers: Headers, secret: string | null): string | null => {
  if (!secret) return null;
  const sent = single(headers?.[CALLER_SECRET_HEADER]);
  if (!sent || !sameSecret(sent, secret)) return null;
  const visitor = single(headers?.[VISITOR_IP_HEADER]);
  return visitor && isIP(visitor) ? visitor : null;
};

/**
 * Whether a caller sent a secret that does not match the one configured.
 *
 * `vouchedVisitor` collapses three different situations into `null`: nothing
 * was sent, the API holds no secret, or what was sent is wrong. The first two
 * are ordinary - a direct caller vouches for nobody, and an unset secret is a
 * stated choice that the guard already warns about at startup.
 *
 * The third is a misconfiguration, and it is the one that looks exactly like
 * working: the web believes it is vouching, the API quietly ignores it, and
 * every visitor the web serves goes back to sharing one bucket. That is the A2
 * defect returning with nothing to show for it. A rotation applied on one side
 * only is how it happens.
 */
export const callerSecretMismatch = (headers: Headers, secret: string | null): boolean => {
  if (!secret) return false;
  const sent = single(headers?.[CALLER_SECRET_HEADER]);
  return Boolean(sent) && !sameSecret(sent as string, secret);
};

/** The address the ALB saw: the last `X-Forwarded-For` entry (A2, A36). */
export const lastForwardedHop = (headers: Headers): string | null => {
  const forwarded = headers?.['x-forwarded-for'];
  const chain = Array.isArray(forwarded) ? forwarded.join(',') : forwarded;
  if (typeof chain !== 'string') return null;
  const parts = chain
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : null;
};

export const resolveTracker = (req: Record<string, unknown>, secret: string | null): string => {
  const headers = req['headers'] as Headers;
  return (
    vouchedVisitor(headers, secret) ??
    lastForwardedHop(headers) ??
    (req['ip'] as string | undefined) ??
    'unknown'
  );
};
