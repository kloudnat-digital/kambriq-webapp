/**
 * The hosts the image optimizer may fetch from, and the CSP `img-src` that
 * names the same hosts.
 *
 * Every entry is a literal hostname. The optimizer (`/_next/image`) is
 * anonymous and hands whatever it fetches to sharp, so a wildcard host such as
 * `**.amazonaws.com` lets anybody who owns a bucket there choose the bytes it
 * decodes. The media bucket is named instead, and read from
 * `MEDIA_BUCKET_HOST` because it differs per environment
 * (`kambriq-media-<env>.s3.<region>.amazonaws.com`, no CloudFront in front).
 *
 * Read at `next build`: a standalone build freezes `images` and `headers()`
 * into its manifests, so the variable must reach the Docker build, not only
 * the running container.
 *
 * Missing variable: the bucket is simply not listed, and the optimizer refuses
 * its URLs. It never falls back to a wildcard. A value that is not a plain
 * S3 virtual-hosted hostname fails the build, because a typo that silently
 * widened or emptied the list is worse than a red build.
 */

export const MEDIA_BUCKET_HOST_VAR = 'MEDIA_BUCKET_HOST';

/** Photos on the home page hero and the KBS "who can register" section. */
export const STATIC_IMAGE_HOSTS = ['images.unsplash.com'] as const;

const S3_VIRTUAL_HOSTED = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]\.s3\.[a-z0-9-]+\.amazonaws\.com$/;

export function mediaBucketHost(env: NodeJS.ProcessEnv): string | null {
  const raw = env[MEDIA_BUCKET_HOST_VAR]?.trim();
  if (!raw) return null;
  if (!S3_VIRTUAL_HOSTED.test(raw)) {
    throw new Error(
      `${MEDIA_BUCKET_HOST_VAR} must be a bucket hostname such as ` +
        `kambriq-media-dev.s3.eu-central-1.amazonaws.com, without scheme, path or wildcard.`,
    );
  }
  return raw;
}

export function imageHosts(env: NodeJS.ProcessEnv): string[] {
  const bucket = mediaBucketHost(env);
  return bucket ? [...STATIC_IMAGE_HOSTS, bucket] : [...STATIC_IMAGE_HOSTS];
}

/**
 * `port: ''` refuses an explicit port. `pathname` and `search` are left
 * unset, so any path and any query on these hosts match - which the media
 * bucket needs, because its URLs are presigned and every signature differs.
 */
export function imageRemotePatterns(env: NodeJS.ProcessEnv) {
  return imageHosts(env).map((hostname) => ({
    protocol: 'https' as const,
    hostname,
    port: '',
  }));
}

export function imgSrcSources(env: NodeJS.ProcessEnv): string[] {
  return imageHosts(env).map((host) => `https://${host}`);
}
