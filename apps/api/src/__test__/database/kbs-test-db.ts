import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@kambriq/common/prisma/kbs-client/client';
import { assertIsTestDatabase, TEST_SCHEMAS, urlFor } from './test-db-url';

/**
 * A client on `kambriq_kbs_test`, migrated by `global-setup.ts` from the real
 * kbs migrations. The same shape as `core-test-db.ts` and `lands-test-db.ts`.
 */
export type KbsTestDatabase = {
  prisma: PrismaClient;
  pool: Pool;
  url: string;
  close: () => Promise<void>;
};

const KBS = TEST_SCHEMAS.find((s) => s.name === 'kbs');
if (!KBS) throw new Error('The kbs schema is not declared in TEST_SCHEMAS.');

export const openKbsTestDatabase = (): KbsTestDatabase => {
  const url = urlFor(KBS);
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
