/**
 * Determines whether the current deployment may be indexed by search engines.
 *
 * Relies exclusively on the `APP_ENV` environment variable rather than `NODE_ENV`,
 * as Next.js requires `NODE_ENV=production` for all deployed builds (including staging/dev).
 * Defaults to `noindex` if `APP_ENV` is missing or unrecognised to prevent accidental indexing of non-production environments.
 */
export const NOINDEX_HEADER = 'noindex, nofollow';

/** Expected value of APP_ENV for the production environment. */
export const PRODUCTION_APP_ENV = 'production';

/**
 * Evaluates whether the environment permits search engine indexing.
 * Strictly relies on APP_ENV matching the production value.
 */
export const isIndexableEnvironment = (env: NodeJS.ProcessEnv = process.env): boolean =>
  env.APP_ENV?.trim().toLowerCase() === PRODUCTION_APP_ENV;

/**
 * Generates X-Robots-Tag headers based on the environment indexability.
 * Returns empty headers for production to rely on crawler defaults, and
 * a noindex directive for all other environments.
 */
export const robotsHeaders = (
  env: NodeJS.ProcessEnv = process.env,
): Array<{ key: string; value: string }> =>
  isIndexableEnvironment(env) ? [] : [{ key: 'X-Robots-Tag', value: NOINDEX_HEADER }];
