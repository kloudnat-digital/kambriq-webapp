/**
 * A17 - where the database-backed suite connects.
 *
 * Kept in a file that imports nothing, because jest's `globalSetup` loads it
 * before any test does and should not drag the Prisma client in with it.
 *
 * The default matches `docker/docker-compose.yml`: the same Postgres the
 * developer already runs, a **different database** on it. The unit suite
 * never opens a connection; this suite opens one only here.
 */
export const TEST_DB_URL =
  process.env['DATABASE_URL_LANDS_TEST'] ??
  'postgresql://postgres:password@localhost:5432/kambriq_lands_test';

/**
 * Refuses anything that is not unmistakably a test database.
 *
 * This suite writes rows and, to prove the triggers, tries to update and
 * delete them. dev holds real people's accounts since 6 September and prd
 * will one day; a suite that could be pointed at either by an environment
 * variable is a suite that will be, once. The name has to say `_test`, and a
 * name that does not is refused before a connection is opened.
 */
export const assertIsTestDatabase = (url: string): string => {
  const name = new URL(url).pathname.replace(/^\//, '');
  if (!/^[a-z0-9_]+_test$/.test(name)) {
    throw new Error(
      `Refusing to run the database-backed suite against "${name}": the database name must ` +
        `end in "_test". This suite inserts, updates and deletes rows to prove the ` +
        `database refuses it, and it is not going to do that to a database people use.`,
    );
  }
  return name;
};
