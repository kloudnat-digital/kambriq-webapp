/**
 * The `frame-ancestors` directive, built from the one origin allowed to frame
 * this site.
 *
 * Sanity's Presentation tool renders the live site inside the Studio, so
 * enabling it requires the Studio's origin here. Blocked, the symptom is a blank
 * panel rather than an error naming the header.
 *
 * Read at `next build`, not at runtime: a standalone build freezes `headers()`
 * into its manifest, so the variable must reach the Docker build.
 *
 * The `SANITY_STUDIO_` prefix is Sanity's convention for variables the Studio
 * bundles, and this is not one of them: it is read here and nowhere else. The
 * Studio's own variables live in `studio/.env`.
 */

export const STUDIO_ORIGIN_VAR = 'SANITY_STUDIO_ORIGIN';

/** `https://<project>.sanity.studio`, and nothing else. */
const STUDIO_ORIGIN = /^https:\/\/[a-z0-9][a-z0-9-]{0,61}[a-z0-9]\.sanity\.studio$/;

/**
 * The configured Studio origin, or `null` when none is set.
 *
 * Throws on anything that is not a literal Studio origin. Published guides
 * suggest `https://*.sanity.studio`; anybody can create a Sanity project and be
 * given a subdomain there, so that pattern admits every Sanity customer's Studio.
 * A value that widened or emptied the directive must fail the build rather than
 * ship.
 */
export function studioOrigin(env: NodeJS.ProcessEnv): string | null {
  const raw = env[STUDIO_ORIGIN_VAR]?.trim();
  if (!raw) return null;

  if (!STUDIO_ORIGIN.test(raw)) {
    throw new Error(
      `${STUDIO_ORIGIN_VAR} must be a literal Studio origin such as ` +
        `https://kambriq-studio.sanity.studio - with the scheme, without a path, and ` +
        `never a wildcard. Received: ${raw}`,
    );
  }
  return raw;
}

/**
 * Unset yields `'none'`: Presentation is not in use, and setting the variable is
 * what opens the door.
 *
 * `'self'` is deliberately absent. Nothing on this origin frames its own pages.
 */
export function frameAncestors(env: NodeJS.ProcessEnv = process.env): string {
  const origin = studioOrigin(env);
  return origin ? `frame-ancestors ${origin}` : "frame-ancestors 'none'";
}
