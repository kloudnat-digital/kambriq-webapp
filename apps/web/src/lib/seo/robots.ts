/**
 * Determines environment indexability based on APP_ENV.
 * Defaults to noindex for safety if APP_ENV is unset or non-production.
 * APP_ENV must be explicitly 'production' to enable indexing.
 */
// Relative path used since `next.config.ts` loader fails to resolve `@kambriq/common` alias.
// eslint-disable-next-line @nx/enforce-module-boundaries -- Shared rule across applications.
import {
  isIndexableEnvironment,
  NOINDEX_HEADER,
  PRODUCTION_APP_ENV,
} from '../../../../../libs/common/src/middleware/robots-header.middleware';

export { isIndexableEnvironment, NOINDEX_HEADER, PRODUCTION_APP_ENV };

/**
 * Yields empty headers in indexable environments (implicitly allowing index/follow),
 * and explicit `noindex` headers elsewhere.
 */
export const robotsHeaders = (
  env: NodeJS.ProcessEnv = process.env,
): Array<{ key: string; value: string }> =>
  isIndexableEnvironment(env) ? [] : [{ key: 'X-Robots-Tag', value: NOINDEX_HEADER }];
