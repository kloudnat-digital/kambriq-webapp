import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { Client } from 'pg';
import { assertIsTestDatabase, TEST_DB_URL } from './test-db-url';

/**
 * A17 - brings the test database to the state the migrations describe.
 *
 * Runs once before the suite:
 *
 *   1. connects to the server's maintenance database and creates
 *      `kambriq_lands_test` if it is absent (or drops and recreates it when
 *      `KAMBRIQ_DB_TEST_RESET=1`, which is how a scratch migration used to
 *      prove a test sharp is undone);
 *   2. runs `prisma migrate deploy` against it - **the real migration files**,
 *      the same ones dev and prd receive. Nothing here re-declares a trigger or
 *      a constraint; if the migration does not install it, the suite sees a
 *      database without it.
 *
 * The migration is the thing under test. A harness that set the schema up by
 * some other route would prove the harness.
 */
const ROOT = join(__dirname, '..', '..', '..', '..', '..');

module.exports = async function globalSetup(): Promise<void> {
  const dbName = assertIsTestDatabase(TEST_DB_URL);
  const target = new URL(TEST_DB_URL);

  const maintenance = new URL(TEST_DB_URL);
  maintenance.pathname = '/postgres';

  const client = new Client({ connectionString: maintenance.toString() });
  try {
    await client.connect();
  } catch (error) {
    throw new Error(
      `Postgres is not reachable at ${target.host}. Start it with \`pnpm docker:dev\` ` +
        `(docker/docker-compose.yml) or point DATABASE_URL_LANDS_TEST at a server. ` +
        `Underlying error: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  try {
    if (process.env['KAMBRIQ_DB_TEST_RESET'] === '1') {
      await client.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
      console.log(`\n[db-test] dropped ${dbName} (KAMBRIQ_DB_TEST_RESET=1)`);
    }
    const exists = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    if (exists.rowCount === 0) {
      await client.query(`CREATE DATABASE "${dbName}"`);
      console.log(`\n[db-test] created ${dbName}`);
    }
  } finally {
    await client.end();
  }

  /**
   * `prisma.config.ts` reads `DATABASE_URL_LANDS` and loads `.env` through
   * dotenv, which never overrides a variable that is already set - so the test
   * URL passed here wins over the developer's `.env`.
   */
  const output = execFileSync(
    'npx',
    [
      'prisma',
      'migrate',
      'deploy',
      '--schema',
      'prisma/lands/schema.prisma',
      '--config',
      'prisma/lands/prisma.config.ts',
    ],
    {
      cwd: ROOT,
      env: { ...process.env, DATABASE_URL_LANDS: TEST_DB_URL },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );

  /**
   * The exit code says the process ended; the line says the migrations ran.
   * `deploy-dev.yml`'s seed step went green for weeks while seeding nothing
   * because only the exit code was read. Both are checked here.
   */
  const applied = /No pending migrations to apply|have been successfully applied/.test(output);
  if (!applied) {
    throw new Error(
      `prisma migrate deploy exited 0 but never said the migrations were applied. Output:\n${output}`,
    );
  }

  const summary = output
    .split('\n')
    .filter((l) => /migrations? (found|to apply|applied)|^\d{14}_/.test(l))
    .join('\n');
  console.log(`[db-test] ${target.host}/${dbName}\n${summary}`);
};
