import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { Client } from 'pg';
import { assertIsTestDatabase, TEST_SCHEMAS, urlFor } from './test-db-url';

/**
 * Brings each test database to the state its migrations describe.
 *
 * Runs once before the suite, per schema:
 *
 *   1. connects to the server's maintenance database and creates
 *      `kambriq_<schema>_test` if it is absent - or drops and recreates it when
 *      `KAMBRIQ_DB_TEST_RESET=1`, which is how a scratch migration used to
 *      prove a constraint sharp is undone;
 *   2. runs `prisma migrate deploy` against it - **the real migration files**,
 *      the same ones dev and prd receive.
 *
 * Nothing here re-declares a table, a constraint or a trigger. The migration is
 * the thing under test; a harness that built the schema by another route would
 * be testing the harness.
 *
 * A17: in CI, localhost:5432 is a postgres:16-alpine service container on the
 * Database suite job in ci.yml. This setup connects to it exactly as it does to
 * pnpm docker:dev locally - same default URL - so the suite that could not run
 * in CI for months now does, path-filtered to changes under prisma/ and here.
 */
const ROOT = join(__dirname, '..', '..', '..', '..', '..');

module.exports = async function globalSetup(): Promise<void> {
  for (const schema of TEST_SCHEMAS) {
    const url = urlFor(schema);
    const dbName = assertIsTestDatabase(url);
    const target = new URL(url);

    const maintenance = new URL(url);
    maintenance.pathname = '/postgres';

    const client = new Client({ connectionString: maintenance.toString() });
    try {
      await client.connect();
    } catch (error) {
      throw new Error(
        `Postgres is not reachable at ${target.host}. Start it with \`pnpm docker:dev\` ` +
          `(docker/docker-compose.yml), or point ${schema.urlVar} at a server. ` +
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
     * `prisma.config.ts` reads the schema's runtime variable and loads `.env`
     * through dotenv, which never overrides a variable that is already set - so
     * the test URL passed here wins over the developer's own `.env`.
     */
    const output = execFileSync(
      'npx',
      [
        'prisma',
        'migrate',
        'deploy',
        '--schema',
        `prisma/${schema.name}/schema.prisma`,
        '--config',
        `prisma/${schema.name}/prisma.config.ts`,
      ],
      {
        cwd: ROOT,
        env: { ...process.env, [schema.runtimeVar]: url },
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );

    /**
     * The exit code says the process ended; the line says the migrations ran.
     * `deploy-dev.yml`'s seed step went green for weeks while seeding nothing
     * because only the exit code was ever read. Both are checked here.
     */
    const applied = /No pending migrations to apply|have been successfully applied/.test(output);
    if (!applied) {
      throw new Error(
        `prisma migrate deploy exited 0 for ${schema.name} but never said the migrations were ` +
          `applied. Output:\n${output}`,
      );
    }

    const summary = output
      .split('\n')
      .filter((l) => /migrations? (found|to apply|applied)|^\d{14}_/.test(l))
      .join('\n');
    console.log(`[db-test] ${target.host}/${dbName}\n${summary}`);
  }
};
