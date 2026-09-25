import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * P4 - whether this deployment may be indexed, decided once for the web and the
 * API alike. `apps/web/src/lib/seo/robots.ts` re-exports this rule, so the two
 * sides of one hostname cannot answer differently.
 *
 * **`APP_ENV`, never `NODE_ENV`.** Both runtime images set
 * `NODE_ENV=production` on every environment, dev included, so `NODE_ENV`
 * cannot tell dev from prd. **Absent means noindex**: a prd that forgets to
 * declare itself is visible in Search Console within a day and fixed by one
 * variable, while a dev that forgot would be indexed under the brand name.
 * The full reasoning is in `apps/web/src/lib/seo/robots.ts`.
 */
export const NOINDEX_HEADER = 'noindex, nofollow';

/** The one value that means "this deployment is the public site". */
export const PRODUCTION_APP_ENV = 'production';

export const isIndexableEnvironment = (env: NodeJS.ProcessEnv = process.env): boolean =>
  env['APP_ENV']?.trim().toLowerCase() === PRODUCTION_APP_ENV;

/**
 * Sets `X-Robots-Tag` on every response outside production.
 *
 * Express middleware rather than a Nest interceptor, on purpose: an
 * interceptor runs only for a matched handler, so a 404 for an unknown route
 * and a 401 from a guard would go out without the header. Register it before
 * routing (`main.ts`), and it reaches both.
 *
 * The environment is read once, when the middleware is built, because it does
 * not change while the process runs.
 */
export const robotsHeaderMiddleware = (env: NodeJS.ProcessEnv = process.env): RequestHandler => {
  const indexable = isIndexableEnvironment(env);
  return (_req: Request, res: Response, next: NextFunction) => {
    if (!indexable) res.setHeader('X-Robots-Tag', NOINDEX_HEADER);
    next();
  };
};
