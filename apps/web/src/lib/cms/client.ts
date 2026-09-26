import { createClient, type SanityClient } from '@sanity/client';
import { CMS_API_VERSION } from '@kambriq/common/cms/delivery';
import { sanityDataset, sanityProjectId } from '@/lib/security/sanity-hosts';

/**
 * The Sanity delivery client.
 *
 * `@sanity/client` rather than `next-sanity`: see
 * `libs/common/src/cms/delivery.ts` for the measurement that decided it.
 *
 * The file imports the shared contract by path rather than through the
 * `@kambriq/common` barrel, which would pull server-only Nest and Prisma code
 * into the web bundle.
 *
 * The two variables are validated in `lib/security/sanity-hosts.ts`, which
 * `next.config.ts` reads - so a half-configured project fails the build rather
 * than the first request.
 */

/**
 * The client, or `null` when no project is configured.
 *
 * `null` is the fail-closed state the rest of the app reads: a page with no
 * document answers 404 rather than rendering an empty shell. The same absent
 * variable also removes `cdn.sanity.io` from the image allowlist, so the two
 * cannot disagree about whether the CMS exists.
 */
export function cmsClient(env: NodeJS.ProcessEnv = process.env): SanityClient | null {
  const projectId = sanityProjectId(env);
  const dataset = sanityDataset(env);
  if (!projectId || !dataset) return null;

  return createClient({
    projectId,
    dataset,
    /**
     * Pinned. From `v2025-02-19` the default perspective is `published`, so a
     * draft cannot reach a visitor; `latest` would move that under us.
     */
    apiVersion: CMS_API_VERSION,
    /**
     * The CDN, which Sanity purges on publish. It is also the free plan's
     * cheap path: an uncached query counts against the API, a CDN hit does not.
     */
    useCdn: true,
    /** No token. Everything this app reads is published and public. */
  });
}
