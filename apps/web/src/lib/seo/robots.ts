/**
 * P4 - whether this deployment may be indexed by a search engine.
 *
 * ---------------------------------------------------------------------------
 * `NODE_ENV` cannot answer this, and using it would have been the whole bug
 * ---------------------------------------------------------------------------
 * `docker/Dockerfile.web` sets `ENV NODE_ENV=production` on the runtime image,
 * unconditionally, for **every** environment - because a Next.js production
 * build has to run with it. dev.kambriq.com therefore reports
 * `NODE_ENV === 'production'` exactly like prd would.
 *
 * So a `NODE_ENV !== 'production'` test would have put the header on nothing
 * that is actually deployed, the dev site would have stayed indexable under the
 * brand name, and the suite would have been green the whole time. It is the
 * shape of defect this repository keeps finding: a check that reads a value
 * which cannot distinguish the two cases it is being asked about.
 *
 * `APP_ENV` exists for this one decision and is read by nothing else. Every
 * other build input the web app takes is either a public URL or build metadata
 * (`GIT_SHA`, `IMAGE_TAG`), so there is nothing else to derive this from and
 * nothing else to break by changing it.
 *
 * ---------------------------------------------------------------------------
 * Which way it fails when nobody has set it
 * ---------------------------------------------------------------------------
 * **Absent means noindex.** Production has to say so, in as many words.
 *
 * The two failure modes are not symmetrical. If prd forgets to declare itself,
 * prd carries `noindex`: visible within a day of anybody looking at Search
 * Console, and fixed by setting one variable. If the default ran the other way
 * and dev forgot, dev is indexed under the brand name - which is the defect
 * being fixed here, is invisible until somebody searches, and takes weeks to
 * unpick once crawled.
 *
 * That is a deliberate trade and it has a cost: **prd must set
 * `APP_ENV=production` when it is first built.** prd has never been deployed;
 * the bootstrap checklist in `docs/adr/ADR-005-production-automation-prerequisites.md`
 * is where that belongs, and the register carries it as a follow-up.
 *
 * It is also the rule this repo already applies elsewhere - a degraded path is
 * an explicit setting, never an inference from absent configuration - pointed
 * the safe way round.
 */
/**
 * The rule itself lives in `libs/common` since P4's second half: the API sets
 * the same header from the same function, so dev.kambriq.com cannot be noindex
 * on its pages and indexable on its API. Re-exported here so every existing
 * reader of this file keeps working.
 */
// A relative path, not the `@kambriq/common` alias: `next.config.ts` imports
// this file, and the loader that compiles the config does not resolve the alias
// from here (measured: "Cannot find module '../../libs/common/...'").
// eslint-disable-next-line @nx/enforce-module-boundaries -- next.config.ts cannot resolve the alias; this is the one shared rule both apps must read
import {
  isIndexableEnvironment,
  NOINDEX_HEADER,
  PRODUCTION_APP_ENV,
} from '../../../../../libs/common/src/middleware/robots-header.middleware';

export { isIndexableEnvironment, NOINDEX_HEADER, PRODUCTION_APP_ENV };

/**
 * The headers to add for this deployment: the `noindex` pair everywhere except
 * production, and **nothing at all** in production.
 *
 * Returning an empty list rather than `index, follow` is deliberate. An
 * explicit `index` header adds no instruction a crawler does not already
 * assume, and it is one more thing that can be wrong on the one environment
 * where being wrong costs something.
 */
export const robotsHeaders = (
  env: NodeJS.ProcessEnv = process.env,
): Array<{ key: string; value: string }> =>
  isIndexableEnvironment(env) ? [] : [{ key: 'X-Robots-Tag', value: NOINDEX_HEADER }];
