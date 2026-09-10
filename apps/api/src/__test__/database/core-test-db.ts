import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@kambriq/common/prisma/core-client/client';
import { assertIsTestDatabase, TEST_SCHEMAS, urlFor } from './test-db-url';

/**
 * The handles a database-backed test uses against `core`.
 *
 * Two clients, on purpose:
 *
 * - **Prisma**, because it is the client the service uses. A row the service
 *   wrote is read back through the same types the application has.
 * - **`pg`**, for statements sent past the service: the CHECK constraints exist
 *   to refuse a caller that never went through a DTO, and raw SQL is the honest
 *   shape of that caller. The SQLSTATE comes back unwrapped, so a test asserts
 *   the database's own answer rather than a client library's paraphrase.
 */
export type TestDatabase = {
  prisma: PrismaClient;
  pool: Pool;
  url: string;
  close: () => Promise<void>;
};

const CORE = TEST_SCHEMAS.find((s) => s.name === 'core');
if (!CORE) throw new Error('The core schema is not declared in TEST_SCHEMAS.');

export const openCoreTestDatabase = (): TestDatabase => {
  const url = urlFor(CORE);
  assertIsTestDatabase(url);
  const pool = new Pool({ connectionString: url });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  return {
    prisma,
    pool,
    url,
    close: async () => {
      await prisma.$disconnect();
      await pool.end();
    },
  };
};

/** What Postgres says when it refuses. `code` is the SQLSTATE. */
export type PgRefusal = {
  code?: string;
  constraint?: string;
  table?: string;
  message: string;
};

/** Postgres error codes this suite asserts on, by name rather than by digits. */
export const SQLSTATE = {
  /** A CHECK constraint refused the row. */
  CHECK_VIOLATION: '23514',
  /** A NOT NULL column was not supplied. */
  NOT_NULL_VIOLATION: '23502',
} as const;

/**
 * Runs a statement and returns the refusal, or `null` when the database
 * accepted it.
 *
 * Tests assert `toMatchObject({ code, constraint })` on the result: with the
 * constraint gone the statement succeeds, the result is `null`, and the failure
 * reads `Expected: {code: '23514'}, Received: null` - which says exactly what
 * happened rather than that an expectation was not met.
 */
export const attempt = async (
  pool: Pool,
  sql: string,
  params: unknown[] = [],
): Promise<PgRefusal | null> => {
  try {
    await pool.query(sql, params);
    return null;
  } catch (error) {
    const e = error as PgRefusal;
    return { code: e.code, constraint: e.constraint, table: e.table, message: e.message };
  }
};
