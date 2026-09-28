import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * These suites run against a DEPLOYED api, not a local process.
 *
 * The previous setup waited for a port on localhost and the one spec asserted
 * `GET /api` returned `{ message: 'Hello API' }` - a route that does not exist,
 * in a project CI never ran. A test nobody runs, asserting something untrue, is
 * worse than no test: it reads as coverage.
 */
module.exports = async function () {
  const target = process.env.KAMBRIQ_API_URL ?? 'https://dev.kambriq.com/api/v1';
  console.log(`\napi-e2e target: ${target}\n`);
  globalThis.__TEARDOWN_MESSAGE__ = '\napi-e2e done\n';
  // One token per seeded account for the whole run (`sessionFor` in
  // journeys/support.ts), removed by global-teardown.
  process.env['JOURNEYS_SESSIONS_DIR'] = mkdtempSync(join(tmpdir(), 'kambriq-journeys-'));
};
