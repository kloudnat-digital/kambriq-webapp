/**
 * Build metadata baked into the image at docker build time.
 *
 * The values come from build args in docker/Dockerfile.api, which ci.yml fills
 * from the commit being built. They are therefore immutable properties of the
 * image itself: an image cannot report a tag it was not built as. That is what
 * makes them usable as a deployment gate - deploy-dev.yml polls the version
 * endpoint after each rollout and fails if the served imageTag is not the tag
 * it just deployed.
 *
 * Every field falls back to 'unknown' so a locally built or pre-versioning
 * image still answers instead of crashing.
 */
export interface BuildInfo {
  /** Package version (release-please manages package.json). */
  version: string;
  /** ECR image tag, e.g. "sha-abc1234". The value the deploy gate compares. */
  imageTag: string;
  /** Full commit SHA the image was built from. */
  gitSha: string;
  /** Branch or tag the build ran on, e.g. "develop". */
  gitRef: string;
  /** ISO 8601 UTC timestamp of the image build. */
  buildTime: string;
  /** Runtime environment (NODE_ENV). */
  env: string;
  /** ISO 8601 UTC timestamp of process start - distinguishes a restart from a redeploy. */
  startedAt: string;
}

const UNKNOWN = 'unknown';

// Captured once at module load, i.e. at process start.
const STARTED_AT = new Date().toISOString();

export function getBuildInfo(): BuildInfo {
  return {
    version: process.env.APP_VERSION || UNKNOWN,
    imageTag: process.env.IMAGE_TAG || UNKNOWN,
    gitSha: process.env.GIT_SHA || UNKNOWN,
    gitRef: process.env.GIT_REF || UNKNOWN,
    buildTime: process.env.BUILD_TIME || UNKNOWN,
    env: process.env.NODE_ENV || UNKNOWN,
    startedAt: STARTED_AT,
  };
}
