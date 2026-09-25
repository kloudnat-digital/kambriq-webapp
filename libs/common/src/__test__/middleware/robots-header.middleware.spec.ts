import type { NextFunction, Request, Response } from 'express';
import {
  isIndexableEnvironment,
  NOINDEX_HEADER,
  robotsHeaderMiddleware,
} from '../../middleware/robots-header.middleware';

/**
 * P4 - the API answers the indexing question the web answers, from the same
 * rule: `APP_ENV`, never `NODE_ENV`, and absent means noindex.
 *
 * Both directions are asserted. A header that is always on silently delists
 * production, which is worse than the defect being fixed.
 */
const run = (env: NodeJS.ProcessEnv) => {
  const setHeader = jest.fn();
  const next = jest.fn() as unknown as NextFunction;
  robotsHeaderMiddleware(env)({} as Request, { setHeader } as unknown as Response, next);
  return { setHeader, next: next as unknown as jest.Mock };
};

describe('P4 - robotsHeaderMiddleware', () => {
  it.each([
    ['dev', { APP_ENV: 'dev' }],
    ['absent', {}],
    ['empty', { APP_ENV: '' }],
    ['production with NODE_ENV only', { NODE_ENV: 'production' }],
  ])('sends noindex when APP_ENV is %s, and lets the request through', (_label, env) => {
    const { setHeader, next } = run(env as NodeJS.ProcessEnv);
    expect(setHeader).toHaveBeenCalledWith('X-Robots-Tag', NOINDEX_HEADER);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('sends nothing in production, and still lets the request through', () => {
    const { setHeader, next } = run({ APP_ENV: 'production' } as NodeJS.ProcessEnv);
    expect(setHeader).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('decides once, when it is built, not on every request', () => {
    const env = { APP_ENV: 'production' } as NodeJS.ProcessEnv;
    const middleware = robotsHeaderMiddleware(env);
    env['APP_ENV'] = 'dev';
    const setHeader = jest.fn();
    middleware({} as Request, { setHeader } as unknown as Response, jest.fn());
    expect(setHeader).not.toHaveBeenCalled();
  });

  it('reads APP_ENV case- and whitespace-insensitively, like the web', () => {
    expect(isIndexableEnvironment({ APP_ENV: ' Production ' } as NodeJS.ProcessEnv)).toBe(true);
  });
});
