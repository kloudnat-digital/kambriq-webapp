/**
 * Where the database-backed suite connects.
 *
 * Kept in a file that imports nothing, because jest's `globalSetup` loads it
 * before any test does and should not drag the Prisma client in with it.
 *
 * ---------------------------------------------------------------------------
 * One entry per schema, because there are four of them
 * ---------------------------------------------------------------------------
 * `prisma/{core,kbs,kamnet,lands}` are four schemas against four databases. A
 * harness hard-wired to one of them would have to be rewritten by the next
 * chantier that needs a different one, so the list is the configuration and
 * adding a schema is one entry.
 *
 * Only `core` is here today: it is the only schema with `*.dbspec.ts` files.
 * `lands` is the next one, and it is a single line.
 */
export type TestSchema = {
  /** The prisma directory under `prisma/`, and the name used in messages. */
  readonly name: string;
  /** The env var a developer may override the URL with. */
  readonly urlVar: string;
  /** The env var `prisma migrate deploy` reads for this schema. */
  readonly runtimeVar: string;
  readonly defaultUrl: string;
};

export const TEST_SCHEMAS: readonly TestSchema[] = [
  {
    name: 'core',
    urlVar: 'DATABASE_URL_CORE_TEST',
    runtimeVar: 'DATABASE_URL_CORE',
    defaultUrl: 'postgresql://postgres:password@localhost:5432/kambriq_core_test',
  },
];

/** The URL for one schema: the override if set, the compose default otherwise. */
export const urlFor = (schema: TestSchema): string =>
  process.env[schema.urlVar] ?? schema.defaultUrl;

/**
 * Refuses anything that is not unmistakably a test database.
 *
 * This suite writes rows and deletes them. dev has held real people's accounts
 * since 6 September, and prd will one day; a suite that could be pointed at
 * either by an environment variable is a suite that will be, once. The name has
 * to end in `_test`, and one that does not is refused before a connection is
 * opened.
 */
export const assertIsTestDatabase = (url: string): string => {
  const name = new URL(url).pathname.replace(/^\//, '');
  if (!/^[a-z0-9_]+_test$/.test(name)) {
    throw new Error(
      `Refusing to run the database-backed suite against "${name}": the database name must ` +
        `end in "_test". This suite inserts and deletes rows, and it is not going to do ` +
        `that to a database people use.`,
    );
  }
  return name;
};
