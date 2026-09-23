import { Request, Response, NextFunction } from 'express';
import {
  CORRELATION_ID_HEADER,
  CorrelationIdMiddleware,
} from '../../middleware/correlation-id.middleware';

describe('CorrelationIdMiddleware', () => {
  let middleware: CorrelationIdMiddleware;

  beforeEach(() => {
    middleware = new CorrelationIdMiddleware();
  });

  it('generates a new correlation ID if none is provided', () => {
    const req = { headers: {} } as unknown as Request;
    const res = { setHeader: jest.fn() } as unknown as Response;
    const next: NextFunction = jest.fn();

    middleware.use(req, res, next);

    expect(req.headers[CORRELATION_ID_HEADER]).toBeDefined();
    expect(typeof req.headers[CORRELATION_ID_HEADER]).toBe('string');
    expect(res.setHeader).toHaveBeenCalledWith(
      CORRELATION_ID_HEADER,
      req.headers[CORRELATION_ID_HEADER],
    );
    expect(next).toHaveBeenCalled();
  });

  it('preserves an existing correlation ID from the request', () => {
    const existingId = 'abc-123-def';
    const req = { headers: { [CORRELATION_ID_HEADER]: existingId } } as unknown as Request;
    const res = { setHeader: jest.fn() } as unknown as Response;
    const next: NextFunction = jest.fn();

    middleware.use(req, res, next);

    expect(req.headers[CORRELATION_ID_HEADER]).toBe(existingId);
    expect(res.setHeader).toHaveBeenCalledWith(CORRELATION_ID_HEADER, existingId);
  });
});
