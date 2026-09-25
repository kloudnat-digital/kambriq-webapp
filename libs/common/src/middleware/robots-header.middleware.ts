import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Determines indexability based on APP_ENV.
 * Defaults to noindex for safety. Only environments explicitly marked as 'production' are indexable.
 */
export const NOINDEX_HEADER = 'noindex, nofollow';

/** Explicit production environment identifier. */
export const PRODUCTION_APP_ENV = 'production';

export const isIndexableEnvironment = (env: NodeJS.ProcessEnv = process.env): boolean =>
  env['APP_ENV']?.trim().toLowerCase() === PRODUCTION_APP_ENV;

/**
 * Express middleware to inject 'X-Robots-Tag' headers outside of production environments.
 * Registered globally to ensure coverage across all responses, including 401s and 404s.
 */
export const robotsHeaderMiddleware = (env: NodeJS.ProcessEnv = process.env): RequestHandler => {
  const indexable = isIndexableEnvironment(env);
  return (_req: Request, res: Response, next: NextFunction) => {
    if (!indexable) res.setHeader('X-Robots-Tag', NOINDEX_HEADER);
    next();
  };
};
