import { NextResponse } from 'next/server';

const UNKNOWN = 'unknown';

// Captured once at module load, i.e. at process start.
const STARTED_AT = new Date().toISOString();

// Never prerender: the metadata must be read from the runtime environment of
// the running container, not frozen into the bundle at build time.
export const dynamic = 'force-dynamic';

/**
 * Liveness plus build metadata.
 *
 * `status` is kept first and unchanged so existing ALB and ECS health checks
 * that only look for `{"status":"ok"}` keep passing. The build fields come from
 * docker/Dockerfile.web build args and let the deploy pipeline verify that the
 * image it just rolled out is the one actually serving traffic.
 */
export function GET() {
  return NextResponse.json({
    status: 'ok',
    version: process.env.APP_VERSION || UNKNOWN,
    imageTag: process.env.IMAGE_TAG || UNKNOWN,
    gitSha: process.env.GIT_SHA || UNKNOWN,
    gitRef: process.env.GIT_REF || UNKNOWN,
    buildTime: process.env.BUILD_TIME || UNKNOWN,
    startedAt: STARTED_AT,
  });
}
