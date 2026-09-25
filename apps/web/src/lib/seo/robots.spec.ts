import { isIndexableEnvironment, NOINDEX_HEADER, robotsHeaders } from './robots';
// A static import on purpose: a dynamic `import()` of a library makes Nx treat
// it as lazy-loaded and then forbids every static import of it in this app.
// eslint-disable-next-line @nx/enforce-module-boundaries -- the point of this test is to compare against the shared rule itself
import * as shared from '../../../../../libs/common/src/middleware/robots-header.middleware';

/**
 * P4 - the noindex header, in **both** directions.
 *
 * A test that only checks the "on" case cannot see the failure that matters.
 * A header that is always on silently delists the production site, which is a
 * worse outcome than the one being fixed and is invisible from every side
 * except Search Console weeks later. So the absent case is asserted as hard as
 * the present one.
 */
describe('P4 - X-Robots-Tag', () => {
  const NOINDEX = [{ key: 'X-Robots-Tag', value: NOINDEX_HEADER }];

  describe('outside production', () => {
    it.each([
      ['dev', { APP_ENV: 'dev' }],
      ['staging', { APP_ENV: 'staging' }],
      ['test', { APP_ENV: 'test' }],
      ['absent', {}],
      ['empty', { APP_ENV: '' }],
      ['whitespace', { APP_ENV: '   ' }],
    ])('sends noindex when APP_ENV is %s', (_case, env) => {
      expect(robotsHeaders(env as NodeJS.ProcessEnv)).toEqual(NOINDEX);
      expect(isIndexableEnvironment(env as NodeJS.ProcessEnv)).toBe(false);
    });

    it('absent means noindex, and that default is the decision', () => {
      /**
       * The two failure modes are not symmetrical, so the default is not
       * arbitrary. If prd forgets to declare itself it carries noindex: visible
       * the first time anybody opens Search Console, fixed by one variable. If
       * the default ran the other way and dev forgot, dev is indexed under the
       * brand name - the defect being fixed here, invisible until somebody
       * searches for it, and weeks of work to unpick.
       */
      expect(robotsHeaders({} as NodeJS.ProcessEnv)).toEqual(NOINDEX);
    });

    it('does not read NODE_ENV, which cannot tell the environments apart', () => {
      /**
       * `docker/Dockerfile.web` sets `NODE_ENV=production` on the runtime image
       * for EVERY environment, because that is what a Next production build
       * runs as. A check reading it would have put the header on nothing that
       * is actually deployed and stayed green throughout.
       *
       * So: NODE_ENV=production with no APP_ENV - exactly what dev.kambriq.com
       * reports - must still send noindex.
       */
      expect(robotsHeaders({ NODE_ENV: 'production' } as NodeJS.ProcessEnv)).toEqual(NOINDEX);
      expect(robotsHeaders({ NODE_ENV: 'development' } as NodeJS.ProcessEnv)).toEqual(NOINDEX);
    });
  });

  describe('in production', () => {
    it('sends no robots header at all', () => {
      // Not `index, follow`: an explicit index adds no instruction a crawler
      // does not already assume, and it is one more thing that can be wrong on
      // the one environment where being wrong costs something.
      expect(robotsHeaders({ APP_ENV: 'production' } as NodeJS.ProcessEnv)).toEqual([]);
      expect(isIndexableEnvironment({ APP_ENV: 'production' } as NodeJS.ProcessEnv)).toBe(true);
    });

    it.each(['Production', 'PRODUCTION', '  production  '])(
      'accepts %p, so a stray capital or space does not delist the site',
      (value) => {
        expect(robotsHeaders({ APP_ENV: value } as NodeJS.ProcessEnv)).toEqual([]);
      },
    );

    it.each(['prod', 'prd', 'production-eu', 'produção'])(
      'refuses %p - only the exact word means the public site',
      (value) => {
        // Deliberately strict. A near-miss that suppressed the header would
        // publish a non-production environment, which is the whole defect.
        expect(robotsHeaders({ APP_ENV: value } as NodeJS.ProcessEnv)).toEqual(NOINDEX);
      },
    );
  });

  it('the header value is the pair a crawler acts on', () => {
    expect(NOINDEX_HEADER).toBe('noindex, nofollow');
  });
});

describe('P4 - one rule for the whole hostname', () => {
  it('is the very function the API uses, not a copy that happens to agree', () => {
    expect(isIndexableEnvironment).toBe(shared.isIndexableEnvironment);
    expect(NOINDEX_HEADER).toBe(shared.NOINDEX_HEADER);
  });
});
