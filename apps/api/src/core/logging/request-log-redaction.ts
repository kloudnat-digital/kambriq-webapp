import { SIGNATURE_HEADER_NAME } from '@sanity/webhook';
import { REDACTED_REQUEST_HEADERS } from '../throttler/caller-identity';

/**
 * A46 - the paths the request logger never writes.
 *
 * `pinoHttp` records every request's headers verbatim. Anything that proves who
 * somebody is, or lets somebody act as them, must be removed before the line is
 * written - redaction happens in the logger, so no log group, export or console
 * ever holds the value.
 */
export const REQUEST_LOG_REDACT_PATHS: string[] = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  ...REDACTED_REQUEST_HEADERS,
  /**
   * The Sanity webhook signature. It is not the secret, and it is credential
   * material twice over: an HMAC beside a payload that is published content is
   * material for an offline attack on the secret, and nothing in the signature
   * scheme checks the timestamp's age, so a signature that leaks stays valid.
   *
   * Taken from the library's own constant rather than typed, so a header rename
   * cannot leave a redaction path pointing at nothing.
   */
  `req.headers["${SIGNATURE_HEADER_NAME}"]`,
];
