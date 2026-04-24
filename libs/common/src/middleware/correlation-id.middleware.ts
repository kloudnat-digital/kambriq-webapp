/**
 * Correlation ID Middleware
 *
 * Ensures every request carries a unique trace identifier throughout its
 * entire lifecycle - from the incoming HTTP request to every log line it
 * produces, and back to the client in the response headers.
 *
 * How it works:
 *   1. If the client (frontend, or upstream service) already
 *      sent an `x-correlation-id` header, we reuse it - this allows a
 *      chain of services to share the same ID across multiple hops.
 *   2. If no ID is present, we generate a fresh UUID for this request.
 *   3. The ID is written back onto req.headers so it is available to any
 *      downstream service calls made during the request.
 *   4. The ID is set on the response so the caller can log it on their side
 *      and correlate their traces with ours.
 *
 * Pino picks it up via the `customProps` hook in AppModule and attaches it
 * as a structured field on every log line emitted for that request - making
 * it trivial to find every trace of a specific request in production logs.
 *
 * Example: a bug report says "my payment failed at 14:32".
 * You grep logs for `correlationId: "abc-123"` and instantly see the full
 * call chain: guard → service → DB query → queue job, all in order.
 */
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

export const CORRELATION_ID_HEADER = 'x-correlation-id';

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const correlationId = req.headers[CORRELATION_ID_HEADER] || randomUUID();

    req.headers[CORRELATION_ID_HEADER] = correlationId; // forward to downstream calls
    res.setHeader(CORRELATION_ID_HEADER, correlationId); // return to caller

    next();
  }
}
