import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { IdVerificationStatus } from '@kambriq/common/constants/core';
import { CorePrismaService } from '../../core/prisma/core-prisma.service';
import { UsersService } from '../../core/users/users.service';
import { mockI18n, mockStorageService } from '../utils';
import { openCoreTestDatabase, type TestDatabase } from './core-test-db';

/**
 * C36 - the identity-review queue lists only accounts that still exist. A
 * soft-deleted account's pending document is not shown, not counted, and does
 * not set the age of the oldest wait.
 */
describe('C36 - the identity queue leaves soft-deleted accounts out', () => {
  let db: TestDatabase;
  let prisma: CorePrismaService;
  let users: UsersService;
  const DAY = 86_400_000;

  beforeAll(async () => {
    db = openCoreTestDatabase();
    prisma = new CorePrismaService({
      get: (k: string) => (k === 'DATABASE_URL_CORE' ? db.url : undefined),
    } as unknown as ConfigService);
    await prisma.onModuleInit();
    users = new UsersService(
      prisma,
      {} as never,
      mockI18n() as never,
      {} as never,
      mockStorageService() as never,
    );
  });

  afterAll(async () => {
    await prisma.onModuleDestroy();
    await db.close();
  });

  const pending = async (deleted: boolean, submittedDaysAgo: number) => {
    const id = randomUUID();
    await db.prisma.user.create({
      data: {
        id,
        email: `c36-${id}@example.test`,
        firstName: 'C36',
        lastName: deleted ? 'Gone' : 'Here',
        ...(deleted ? { isActive: false, deletedAt: new Date(), deactivatedBy: null } : {}),
      },
    });
    await db.prisma.userProfile.create({
      data: {
        userId: id,
        idVerificationStatus: IdVerificationStatus.PENDING,
        idDocumentUrls: [`users/${id}/id/front.jpg`],
        idSubmittedAt: new Date(Date.now() - submittedDaysAgo * DAY),
      },
    });
    return id;
  };

  it("keeps an active account's document and leaves a deleted account's out of the list, the count and the age", async () => {
    const before = await users.listPendingIdDocuments({ page: 1, limit: 100 } as never);
    const here = await pending(false, 3);
    const gone = await pending(true, 4000);

    const page = await users.listPendingIdDocuments({ page: 1, limit: 100 } as never);
    const ids = page.data.map((r) => r.userId);

    expect(ids).toContain(here);
    expect(ids).not.toContain(gone);
    expect(page.meta.total).toBe(before.meta.total + 1);
    expect(page.meta.oldestWaitingDays).toBeLessThan(4000);
  });
});
