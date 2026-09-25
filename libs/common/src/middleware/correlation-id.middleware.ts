/**
 * Injects a correlation ID into the request lifecycle for distributed tracing.
 * Reuses existing 'x-correlation-id' or generates a UUID fallback.
 * Attaches the ID to downstream request headers and caller response headers.
 */
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

export const CORRELATION_ID_HEADER = 'x-correlation-id';

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const correlationId = req.headers[CORRELATION_ID_HEADER] || randomUUID();

    req.headers[CORRELATION_ID_HEADER] = correlationId; // Forward to downstream services.
    res.setHeader(CORRELATION_ID_HEADER, correlationId); // Return to caller.

    next();
  }
}
