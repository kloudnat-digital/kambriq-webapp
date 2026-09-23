/**
 * Correlation ID Middleware
 *
 * Ensures every request carries a unique trace identifier throughout its lifecycle.
 *
 * Behavior:
 * 1. Reuses the existing `x-correlation-id` header if provided by the client or upstream service.
 * 2. Generates a new UUID if the header is absent.
 * 3. Attaches the correlation ID to the request headers for downstream services.
 * 4. Appends the correlation ID to the response headers for caller correlation.
 *
 * This identifier is integrated with the logging system (e.g., Pino) to provide structured tracing
 * across the request's execution path.
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
