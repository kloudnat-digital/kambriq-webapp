import type { IncomingMessage } from 'node:http';
import { maskQuery, maskUrl } from '@kambriq/common/logging/url-allowlist';
import { lastForwardedHop, vouchedVisitor } from '../throttler/caller-identity';

/**
 * D28 - the API's request line (pino-http, one per request, 7 days on dev).
 *
 * It already said what and when; it now says **who**: the visitor's address -
 * the one the web vouches for with `WEB_CALLER_SECRET` (A45), else the address
 * the load balancer saw - and the account id once authenticated. And it says
 * nothing it must not: the URL, the parsed query and the referer go through
 * the allowlist in `url-allowlist.ts` before the line is written.
 */
type SerializedReq = {
  url?: string;
  query?: Record<string, unknown>;
  params?: Record<string, unknown>;
  headers?: Record<string, unknown>;
  [key: string]: unknown;
};

export const accessLogSerializers = {
  req: (req: SerializedReq): SerializedReq => {
    const headers = { ...(req.headers ?? {}) };
    if (typeof headers['referer'] === 'string') headers['referer'] = maskUrl(headers['referer']);
    return {
      ...req,
      url: typeof req.url === 'string' ? maskUrl(req.url) : req.url,
      query: maskQuery(req.query),
      // pino-http's serializer also emits route params, and the spread copies
      // them. No route carries a credential in a path segment today; the day one
      // does, an unmasked `params` writes it to the log group.
      params: maskQuery(req.params),
      headers,
    };
  },
};

export const accessLogProps =
  (secret: string | null) =>
  (req: IncomingMessage): Record<string, unknown> => {
    const header = req.headers['x-correlation-id'];
    const correlationId = Array.isArray(header) ? header[0] : header;
    const user = (req as IncomingMessage & { user?: { id?: string } }).user;
    return {
      correlationId,
      visitorIp: vouchedVisitor(req.headers, secret) ?? lastForwardedHop(req.headers),
      userId: user?.id,
    };
  };
