import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@kambriq/common/prisma/kamnet-client/client';
import { assertIsTestDatabase, TEST_SCHEMAS, urlFor } from './test-db-url';

/**
 * A client on `kambriq_kamnet_test`, migrated by `global-setup.ts` from the
 * real kamnet migrations. The same shape as `kbs-test-db.ts` and
 * `core-test-db.ts`.
 *
 * P11 is the first subject to need this database in the `*.dbspec.ts` tier: who
 * appears in the public directory is decided by `publicListingConsentAt` and
 * `suspendedAt` on a real `KamnetAgent` row, and a fixture that stubbed either
 * would be proving the stub.
 */
export type KamnetTestDatabase = {
  prisma: PrismaClient;
  pool: Pool;
  url: string;
  close: () => Promise<void>;
};

const KAMNET = TEST_SCHEMAS.find((s) => s.name === 'kamnet');
if (!KAMNET) throw new Error('The kamnet schema is not declared in TEST_SCHEMAS.');

export const openKamnetTestDatabase = (): KamnetTestDatabase => {
  const url = urlFor(KAMNET);
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
