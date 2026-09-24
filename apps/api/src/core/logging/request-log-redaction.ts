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
];
