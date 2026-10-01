import { MEDIA_BUCKET_HOST_VAR, mediaBucketHost } from './image-hosts';
import { SANITY_PROJECT_ID_VAR, sanityProjectId } from './sanity-hosts';
import { STUDIO_ORIGIN_VAR, studioOrigin } from './studio-origin';

/**
 * C44 - every value that feeds a security header names something this
 * platform has proven it holds.
 *
 * A Studio subdomain, a bucket name and a Sanity project id are globally
 * claimable: anybody can create one. A well-formed value is therefore not a
 * safe value - `https://kambriq.sanity.studio` was well formed and belonged to
 * another organisation, and `frame-ancestors` granted it the right to frame this
 * site. So the rule is inverted: a value is refused unless it is listed here,
 * and it is listed only after it has been claimed, with the proof of the claim.
 *
 * This is a reviewed list, edited by a person when a host is claimed. It cannot
 * prove ownership on its own at build time (CI holds no Sanity credentials and
 * should not); what it guarantees is that an unlisted value fails the build
 * instead of shipping.
 */
export type Claim = { readonly value: string; readonly proof: string };

export const CLAIMED_STUDIO_ORIGINS: readonly Claim[] = [
  {
    value: 'https://kambriq-studio.sanity.studio',
    proof:
      '`sanity deploy` from studio/ for project 4c3y0546 printed "Studio deployed to ' +
      'https://kambriq-studio.sanity.studio/", 2026-10-01 11:03:54Z.',
  },
];

export const CLAIMED_MEDIA_BUCKET_HOSTS: readonly Claim[] = [
  {
    value: 'kambriq-media-dev.s3.eu-central-1.amazonaws.com',
    proof:
      '`aws s3api head-bucket --bucket kambriq-media-dev --expected-bucket-owner 051551940370` ' +
      'succeeded, region eu-central-1, 2026-10-01 11:04:19Z.',
  },
];

export const CLAIMED_SANITY_PROJECT_IDS: readonly Claim[] = [
  {
    value: '4c3y0546',
    proof:
      '`sanity projects list`, logged in as the project owner, listed 4c3y0546 "kambriq", ' +
      'created 2026-09-27, 2026-10-01 05:59:11Z.',
  },
];

const refuse = (variable: string, value: string): never => {
  throw new Error(
    `${variable}=${value} names a host this platform has not proven it holds. ` +
      'Claim it first, then add it to apps/web/src/lib/security/claimed-hosts.ts with the proof.',
  );
};

/** Throws on any configured security-header value that is not on its claimed list. */
export function assertSecurityHostsClaimed(env: NodeJS.ProcessEnv): void {
  const origin = studioOrigin(env);
  if (origin && !CLAIMED_STUDIO_ORIGINS.some((c) => c.value === origin)) {
    refuse(STUDIO_ORIGIN_VAR, origin);
  }
  const bucket = mediaBucketHost(env);
  if (bucket && !CLAIMED_MEDIA_BUCKET_HOSTS.some((c) => c.value === bucket)) {
    refuse(MEDIA_BUCKET_HOST_VAR, bucket);
  }
  const project = sanityProjectId(env);
  if (project && !CLAIMED_SANITY_PROJECT_IDS.some((c) => c.value === project)) {
    refuse(SANITY_PROJECT_ID_VAR, project);
  }
}
