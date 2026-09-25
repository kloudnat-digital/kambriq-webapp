import { headers } from 'next/headers';

/**
 * A45 - the headers that tell the API which visitor a server-side call is for.
 *
 * The web server calls the API through the public ALB, so the API sees the web
 * task's own address as the caller, and every visitor's call counted against
 * one rate-limit bucket. This passes the visitor's address on, and proves the
 * call comes from the web with `WEB_CALLER_SECRET`, which only the web and the
 * API hold. The API believes the address only with that secret
 * (`apps/api/src/core/throttler/caller-identity.ts`).
 *
 * **Where the visitor's address comes from.** The same ALB serves the web, and
 * it appends the address it saw to `X-Forwarded-For` - measured on the API's
 * side on dev, where a forged header arrives as `forged, <real>`. So the LAST
 * entry of the incoming request's `X-Forwarded-For` is the visitor, and every
 * earlier one is whatever the visitor chose to send.
 *
 * **Returns nothing, rather than guessing,** when the secret is not configured,
 * when the call is not made while handling a request (`headers()` throws
 * outside a request scope), or when the address is not an address. The API
 * then counts the call under the caller's own address, as it does for any
 * direct caller.
 */
export const VISITOR_IP_HEADER = 'x-kambriq-visitor-ip';
export const CALLER_SECRET_HEADER = 'x-kambriq-caller-secret';

const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
const IPV6 = /^[0-9a-f:]+$/i;

/** Plain checks rather than `node:net`, so this runs wherever the web code runs. */
const isAddress = (value: string): boolean =>
  IPV4.test(value) || (value.includes(':') && IPV6.test(value));

export const visitorHeaders = async (
  env: NodeJS.ProcessEnv = process.env,
): Promise<Record<string, string>> => {
  const secret = env['WEB_CALLER_SECRET']?.trim();
  if (!secret) return {};

  let forwarded: string | null;
  try {
    forwarded = (await headers()).get('x-forwarded-for');
  } catch {
    return {};
  }

  const hops = (forwarded ?? '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  const visitor = hops[hops.length - 1];
  if (!visitor || !isAddress(visitor)) return {};

  return { [VISITOR_IP_HEADER]: visitor, [CALLER_SECRET_HEADER]: secret };
};
