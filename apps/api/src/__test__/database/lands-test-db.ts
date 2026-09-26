import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@kambriq/common/prisma/lands-client/client';
import { PaymentPurpose, PaymentState } from '@kambriq/common';
import { assertIsTestDatabase, TEST_SCHEMAS, urlFor } from './test-db-url';

/**
 * A17 - the handles a database-backed test uses.
 *
 * Two clients, on purpose:
 *
 * - **Prisma**, for fixtures. It is the client the service uses, so a fixture
 *   that the generated types accept is a fixture the application could have
 *   written.
 * - **`pg`**, for the assaults. The triggers and CHECK constraints exist to
 *   refuse "a script, a console, or the next developer in a hurry" - callers
 *   that never go through Prisma. Sending the UPDATE as SQL is the honest shape
 *   of that caller, and the SQLSTATE comes back unwrapped, so a test asserts
 *   the database's own answer rather than a client library's paraphrase of it.
 */
export type TestDatabase = {
  prisma: PrismaClient;
  pool: Pool;
  /** The resolved connection string, for a spec that must build its own client. */
  url: string;
  close: () => Promise<void>;
};

/**
 * Resolved when #97 and #98 met: both created this harness independently, and
 * the generic `TEST_SCHEMAS` list is what let them become one rather than one
 * overwriting the other. `lands` is an entry in that list now, looked up the
 * same way `core` is.
 */
const LANDS = TEST_SCHEMAS.find((s) => s.name === 'lands');
if (!LANDS) throw new Error('The lands schema is not declared in TEST_SCHEMAS.');

export const openTestDatabase = (): TestDatabase => {
  const url = urlFor(LANDS);
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

/**
 * Postgres error codes this suite asserts on, by name.
 *
 * https://www.postgresql.org/docs/16/errcodes-appendix.html
 */
export const SQLSTATE = {
  /** `kambriq_append_only()` raises with this code. */
  RESTRICT_VIOLATION: '23001',
  /** A CHECK constraint refused the row. */
  CHECK_VIOLATION: '23514',
  /** The column does not exist - the total is not a column. */
  UNDEFINED_COLUMN: '42703',
  /** A `RAISE EXCEPTION` with no `ERRCODE` - the G6 reminder triggers. */
  RAISE_EXCEPTION: 'P0001',
  /** A NOT NULL column left empty - `Payment.purpose` has no default (G20). */
  NOT_NULL_VIOLATION: '23502',
  /** A unique index refused the row - one live payment per purpose (G20). */
  UNIQUE_VIOLATION: '23505',
  /** A write to a `GENERATED ALWAYS` column - `Land.pricePerM2` (G19). */
  GENERATED_ALWAYS: '428C9',
} as const;

/**
 * Runs a statement and returns the refusal, or `null` if the database accepted
 * it.
 *
 * Tests assert `toMatchObject({ code, constraint })` on the result: when the
 * guarantee is missing the statement succeeds, the result is `null`, and the
 * failure reads "Expected: {code: '23514'}, Received: null" - which says exactly
 * what happened.
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

/**
 * A payment with everything it needs to exist: a label, a land, a reservation.
 *
 * Every fixture gets its own land, so the partial unique index "one active
 * reservation per land" never collides between tests, and the append-only
 * tables can keep growing - rows in this database are never deleted, which is
 * the property under test.
 */
export const createPaymentFixture = async (
  prisma: PrismaClient,
  over: { state?: PaymentState; amountDue?: bigint; reference?: string | null } = {},
): Promise<{ id: string; reservationId: string; landId: string }> => {
  const tag = randomUUID();

  const label = await prisma.landLabel.upsert({
    where: { code: 'TFL' },
    create: { code: 'TFL', name: 'Titre foncier' },
    update: {},
  });

  const land = await prisma.land.create({
    data: {
      title: `A17 fixture ${tag}`,
      slug: `a17-${tag}`,
      description: 'Created by the database-backed suite.',
      region: 'Littoral',
      sizeM2: 500,
      totalPrice: 15_000_000,
      labelId: label.id,
    },
  });

  const reservation = await prisma.landReservation.create({
    data: {
      landId: land.id,
      agentUserId: `agent-${tag}`,
      clientUserId: `client-${tag}`,
      clientName: 'Fixture Client',
      clientEmail: `a17-${tag}@example.test`,
      downPaymentAmount: 750_000,
    },
  });

  const payment = await prisma.payment.create({
    data: {
      purpose: PaymentPurpose.ACOMPTE,
      reservationId: reservation.id,
      currency: 'XAF',
      amountDue: over.amountDue ?? 750_000n,
      state: over.state ?? PaymentState.EN_VERIFICATION,
      reference: over.reference ?? null,
    },
  });

  return { id: payment.id, reservationId: reservation.id, landId: land.id };
};
