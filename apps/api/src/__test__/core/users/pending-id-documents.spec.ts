import { Test, TestingModule } from '@nestjs/testing';
import { I18nService } from 'nestjs-i18n';
import { ConfigService } from '@nestjs/config';
import { EmailService, StorageService } from '@kambriq/common';
import { UsersService } from '../../../core/users/users.service';
import { CorePrismaService } from '../../../core/prisma/core-prisma.service';
import {
  mockConfigService,
  mockCorePrisma,
  mockEmailService,
  mockI18n,
  mockStorageService,
} from '../../utils';

/**
 * A10 - the review half that had never run.
 *
 * `PATCH /users/:id/id-document/review` existed and was guarded by
 * `ADMIN_GLOBAL`, and had **never been called once**: 59 documents sat at
 * `pending`, `verified: 0`, `rejected: 0`, growing by one per deploy. The route
 * and the role were both there. **The queue was not**, so the only way to find a
 * pending document was to page through every user and look.
 *
 * Nothing may sit indefinitely with nobody accountable, which means a backlog
 * has to answer two questions: how many, and how long has the oldest waited.
 */
const DAY = 86_400_000;

const profile = (over: Record<string, unknown> = {}) => ({
  userId: 'u1',
  idDocumentUrls: ['s3://a.pdf'],
  idSubmittedAt: new Date(Date.now() - 3 * DAY),
  user: { id: 'u1', email: 'a@maildrop.cc', firstName: 'A', lastName: 'B' },
  ...over,
});

describe('the identity-review queue', () => {
  let service: UsersService;
  let prisma: ReturnType<typeof mockCorePrisma>;

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma = mockCorePrisma();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: CorePrismaService, useValue: prisma },
        { provide: EmailService, useValue: mockEmailService() },
        { provide: I18nService, useValue: mockI18n() },
        { provide: ConfigService, useValue: mockConfigService() },
        { provide: StorageService, useValue: mockStorageService() },
      ],
    }).compile();
    service = module.get(UsersService);
  });

  /** Calls the queue method without a compile-time dependency on it existing. */
  const callQueue = (
    svc: UsersService,
    query: { page: number; limit: number; sort: string; order: string },
  ): Promise<{ data: Array<Record<string, unknown>>; meta: Record<string, unknown> }> => {
    const fn = (svc as unknown as Record<string, unknown>)['listPendingIdDocuments'];
    if (typeof fn !== 'function') throw new Error('listPendingIdDocuments does not exist');
    return (fn as (q: unknown) => Promise<never>).call(svc, query);
  };

  const arrange = (rows: unknown[], total: number, oldestDaysAgo: number | null) => {
    prisma.$transaction.mockResolvedValue([
      rows,
      total,
      oldestDaysAgo === null ? null : { idSubmittedAt: new Date(Date.now() - oldestDaysAgo * DAY) },
    ]);
  };

  it('exists at all', () => {
    /**
     * Looked up dynamically, not called through the typed method.
     *
     * Written as `service.listPendingIdDocuments` this fails to **compile** when
     * the method is absent, and a suite that does not build has not been run -
     * the mutation proves nothing. Through an index it is an assertion that
     * fails, with an `Expected/Received` to read.
     */
    const svc = service as unknown as Record<string, unknown>;
    expect(typeof svc['listPendingIdDocuments']).toBe('function');
  });

  it('answers how many are waiting', async () => {
    arrange([profile()], 59, 3);

    const res = await callQueue(service, { page: 1, limit: 20, sort: 'createdAt', order: 'desc' });

    expect(res.meta.total).toBe(59);
    expect(res.data).toHaveLength(1);
  });

  it('answers how long the oldest has waited, which a count alone does not', async () => {
    arrange([profile()], 59, 12);

    const res = await callQueue(service, { page: 1, limit: 20, sort: 'createdAt', order: 'desc' });

    expect(res.meta.oldestWaitingDays).toBe(12);
  });

  it('carries the age of each row, not only of the backlog', async () => {
    arrange([profile({ idSubmittedAt: new Date(Date.now() - 5 * DAY) })], 1, 5);

    const res = await callQueue(service, { page: 1, limit: 20, sort: 'createdAt', order: 'desc' });

    expect(res.data[0].waitingDays).toBe(5);
    expect(res.data[0].submittedAt).toBeInstanceOf(Date);
  });

  it('orders oldest first, because newest-first hides the row that matters', async () => {
    arrange([profile()], 1, 1);

    await callQueue(service, { page: 1, limit: 20, sort: 'createdAt', order: 'desc' });

    const findMany = prisma.$transaction.mock.calls.length;
    expect(findMany).toBe(1);
    // The order is expressed in the query the service builds; assert on the
    // service's own call rather than on a value it echoed back.
    expect(JSON.stringify(prisma.userProfile.findMany.mock.calls)).toContain(
      '"idSubmittedAt":"asc"',
    );
  });

  it('is honest about an empty backlog rather than reporting null', async () => {
    arrange([], 0, null);

    const res = await callQueue(service, { page: 1, limit: 20, sort: 'createdAt', order: 'desc' });

    expect(res.meta.total).toBe(0);
    expect(res.meta.oldestWaitingDays).toBeNull();
  });

  it('records when a document was submitted, so the queue can be aged', async () => {
    // Before A10 the profile recorded when a document was VERIFIED and never
    // when it was SUBMITTED, so "how long has this been waiting" had no answer
    // in the data at all.
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      preferredLanguage: 'fr',
      profile: { idVerificationStatus: 'none' },
    });
    prisma.userProfile.upsert.mockResolvedValue({});
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'a@maildrop.cc',
      firstName: 'A',
      lastName: 'B',
      preferredLanguage: 'fr',
      userRoles: [],
      profile: { idVerificationStatus: 'pending' },
    });

    await service
      .submitIdDocument('u1', { idDocumentUrls: ['users/u1/id-documents/1-a.pdf'] })
      .catch(() => undefined);

    const call = prisma.userProfile.upsert.mock.calls[0]?.[0] as
      | { create: Record<string, unknown>; update: Record<string, unknown> }
      | undefined;
    expect(call).toBeDefined();
    expect(call?.create['idSubmittedAt']).toBeInstanceOf(Date);
    expect(call?.update['idSubmittedAt']).toBeInstanceOf(Date);
  });
});
