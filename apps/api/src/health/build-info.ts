/**
 * Build metadata injected during the Docker build process.
 * These values are used to verify deployments and provide runtime environment context.
 * Falls back to 'unknown' for local or unversioned builds.
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
