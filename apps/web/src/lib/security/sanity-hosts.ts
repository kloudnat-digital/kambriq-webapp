/**
 * The Sanity hosts the browser is allowed to reach, derived from the project id.
 *
 * One of them, and it is project-scoped:
 *
 * - the asset CDN, `https://cdn.sanity.io/images/<projectId>/`, where the
 *   project is a path segment. `cdn.sanity.io` on its own is every Sanity
 *   customer's assets, and the image optimizer hands whatever it fetches to
 *   sharp - the same hole `**.amazonaws.com` was, one directive over.
 *
 * Read at `next build`: a standalone build freezes `images` and `headers()`
 * into its manifests, so the variable must reach the Docker build.
 *
 * Missing variable: the host is not listed and the browser refuses it. That is
 * the state before a Sanity project exists, and it is never widened.
 *
 * There is no `connect-src` entry, and that is a statement about the delivery
 * rather than an omission. Documents are fetched by the Next server through
 * `@sanity/client`; nothing in the browser talks to Sanity. `<SanityLive />`
 * would have needed one, and it is not used - see
 * `libs/common/src/cms/delivery.ts` for the measurement that decided that.
 */

export const SANITY_PROJECT_ID_VAR = 'NEXT_PUBLIC_SANITY_PROJECT_ID';
export const SANITY_DATASET_VAR = 'NEXT_PUBLIC_SANITY_DATASET';

/**
 * `@sanity/client` accepts `/^[-a-z0-9]+$/i` for a project id. This is the
 * intersection of that and a DNS label, because the id is a subdomain here:
 * lowercase, no leading or trailing hyphen, bounded.
 */
const PROJECT_ID = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;

export function sanityProjectId(env: NodeJS.ProcessEnv): string | null {
  const raw = env[SANITY_PROJECT_ID_VAR]?.trim();
  if (!raw) return null;

  if (!PROJECT_ID.test(raw)) {
    throw new Error(
      `${SANITY_PROJECT_ID_VAR} must be a Sanity project id such as 7k3m2q1p - ` +
        `lowercase letters, digits and hyphens, without scheme, path or wildcard. Received: ${raw}`,
    );
  }
  return raw;
}

/**
 * The asset path prefix for this project, with its trailing slash.
 *
 * A CSP source expression ending in `/` matches by prefix, and Next's
 * `remotePatterns` takes the same prefix with `**`.
 */
export function sanityImagePathPrefix(env: NodeJS.ProcessEnv): string | null {
  const projectId = sanityProjectId(env);
  return projectId ? `/images/${projectId}/` : null;
}

export const SANITY_CDN_HOST = 'cdn.sanity.io';

/**
 * A dataset name, as Sanity accepts one: lowercase letters, digits, underscores
 * and dashes, starting with a letter or a digit.
 */
const DATASET_NAME = /^[a-z0-9][-_a-z0-9]{0,63}$/;

/**
 * The dataset the pages read, or `null` when the CMS is not configured at all.
 *
 * Throws when the project is configured and the dataset is not. An unset project
 * means "no CMS here", which this app supports; a project with no dataset is a
 * half-configured build, and the unconfigured case is the one that has to be
 * loud.
 *
 * It lives beside the project id, and `next.config.ts` calls it, so the failure
 * is a **build** failure. Read only at runtime it would have been a 500 on the
 * first page somebody opened, which is the same defect one deploy later.
 */
export function sanityDataset(env: NodeJS.ProcessEnv): string | null {
  const projectId = sanityProjectId(env);
  const raw = env[SANITY_DATASET_VAR]?.trim();

  if (!projectId) return null;

  if (!raw) {
    throw new Error(
      `${SANITY_DATASET_VAR} is required when ${SANITY_PROJECT_ID_VAR} is set. ` +
        'A project with no dataset cannot be queried, and guessing "production" would ' +
        'point a deployed site at a dataset nobody chose.',
    );
  }

  if (!DATASET_NAME.test(raw)) {
    throw new Error(
      `${SANITY_DATASET_VAR} must be a dataset name (lowercase letters, digits, "-" and "_"), got "${raw}".`,
    );
  }

  return raw;
}
