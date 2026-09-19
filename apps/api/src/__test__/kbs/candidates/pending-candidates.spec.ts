import { Test, TestingModule } from '@nestjs/testing';
import { I18nService } from 'nestjs-i18n';
import { EmailService, StorageService } from '@kambriq/common';
import { KbsCandidatesService } from '../../../kbs/candidates/candidates.service';
import { KbsPrismaService } from '../../../kbs/prisma/kbs-prisma.service';
import { CorePrismaService } from '../../../core/prisma/core-prisma.service';
import { UsersService } from '../../../core/users/users.service';
import {
  mockCorePrisma,
  mockEmailService,
  mockI18n,
  mockKbsPrisma,
  mockStorageService,
} from '../../utils';

/**
 * I39 - the activation existed; the backlog was invisible.
 *
 * The brief for this said "no endpoint exists to move a candidate to
 * IN_TRAINING". **That was wrong, and checking it first is why this file is
 * small.** `PATCH /kbs/admin/candidates/:id/status` exists with a full state
 * machine, `adminUpdateCandidateStatus` calls it, and `CandidateDetailContent`
 * puts it on screen. A candidate is one click from activation - for an
 * administrator who already knows to go and look at that candidate.
 *
 * Nothing told them to look. `/admin/kbs` is a bare redirect, the candidates
 * list is sorted by nothing in particular, and no count or age exists anywhere.
 * That is A10 exactly: the reviewer route and the reviewer role both existed and
 * had never been called once, because the QUEUE did not exist.
 *
 * So this is the same fix as A10, on `enrolledAt`, which the model already
 * carries - unlike A10, which had to add `idSubmittedAt` to be able to age
 * anything at all.
 *
 * **A count answers "how many". It does not answer "how long has somebody been
 * waiting", and that is the question a backlog exists to answer.**
 */
const DAY = 86_400_000;

const candidateRow = (over: Record<string, unknown> = {}) => ({
  id: 'c1',
  userId: 'u1',
  status: 'CANDIDATE',
  sponsorCode: null,
  enrolledAt: new Date(Date.now() - 3 * DAY),
  certifiedAt: null,
  progress: [],
  certificates: [],
  ...over,
});

describe('the KBS activation queue', () => {
  let service: KbsCandidatesService;
  let prisma: ReturnType<typeof mockKbsPrisma>;
  let usersService: { addRole: jest.Mock; findManyByIds: jest.Mock };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma = mockKbsPrisma();
    usersService = {
      addRole: jest.fn(),
      findManyByIds: jest
        .fn()
        .mockResolvedValue([{ id: 'u1', email: 'a@maildrop.cc', firstName: 'A', lastName: 'B' }]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KbsCandidatesService,
        { provide: KbsPrismaService, useValue: prisma },
        { provide: CorePrismaService, useValue: mockCorePrisma() },
        { provide: I18nService, useValue: mockI18n() },
        { provide: UsersService, useValue: usersService },
        { provide: StorageService, useValue: mockStorageService() },
        { provide: EmailService, useValue: mockEmailService() },
      ],
    }).compile();

    service = module.get(KbsCandidatesService);
  });

  /**
   * Looked up through an index rather than called as a typed method.
   *
   * Written `service.listPendingCandidates(...)` this file would fail to
   * COMPILE while the method is absent, and a suite that does not build has not
   * been run - the red would prove nothing. Through an index it is an assertion
   * with an Expected/Received to read. Same device as the A10 queue spec.
   */
  const callQueue = (
    query: { page: number; limit: number; sort: string; order: string } = {
      page: 1,
      limit: 20,
      sort: 'enrolledAt',
      order: 'asc',
    },
  ): Promise<{ data: Array<Record<string, unknown>>; meta: Record<string, unknown> }> => {
    const fn = (service as unknown as Record<string, unknown>)['listPendingCandidates'];
    if (typeof fn !== 'function') throw new Error('listPendingCandidates does not exist');
    return (fn as (q: unknown) => Promise<never>).call(service, query);
  };

  const arrange = (rows: unknown[], total: number, oldestDaysAgo: number | null) => {
    prisma.$transaction.mockResolvedValue([
      rows,
      total,
      oldestDaysAgo === null ? null : { enrolledAt: new Date(Date.now() - oldestDaysAgo * DAY) },
    ]);
  };

  it('exists at all', () => {
    const svc = service as unknown as Record<string, unknown>;
    expect(typeof svc['listPendingCandidates']).toBe('function');
  });

  it('answers how many are waiting to be activated', async () => {
    arrange([candidateRow()], 7, 3);

    const res = await callQueue();

    expect(res.meta.total).toBe(7);
    expect(res.data).toHaveLength(1);
  });

  it('answers how long the oldest has waited, which a count alone does not', async () => {
    arrange([candidateRow()], 7, 12);

    const res = await callQueue();

    expect(res.meta.oldestWaitingDays).toBe(12);
  });

  it('carries the age of each row, not only of the backlog', async () => {
    arrange([candidateRow({ enrolledAt: new Date(Date.now() - 5 * DAY) })], 1, 5);

    const res = await callQueue();

    expect(res.data[0].waitingDays).toBe(5);
    expect(res.data[0].enrolledAt).toBeInstanceOf(Date);
  });

  /**
   * Oldest first, deliberately. A queue sorted newest-first hides the person who
   * has been waiting longest, which is the only row that really matters.
   * Asserted on the query the service builds, not on a value it echoed back.
   */
  it('orders oldest first', async () => {
    arrange([candidateRow()], 1, 1);

    await callQueue();

    expect(JSON.stringify(prisma.kbsCandidate.findMany.mock.calls)).toContain('"enrolledAt":"asc"');
  });

  /** Only those actually waiting. An IN_TRAINING candidate is not a backlog. */
  it('asks only for candidates still at CANDIDATE', async () => {
    arrange([candidateRow()], 1, 1);

    await callQueue();

    expect(JSON.stringify(prisma.kbsCandidate.findMany.mock.calls)).toContain('"CANDIDATE"');
  });

  /**
   * `null` on an empty backlog, never `0`. They are different claims: `0` says
   * the oldest has waited less than a day, `null` says there is nobody waiting.
   */
  it('is honest about an empty backlog rather than reporting zero', async () => {
    arrange([], 0, null);

    const res = await callQueue();

    expect(res.meta.total).toBe(0);
    expect(res.meta.oldestWaitingDays).toBeNull();
  });

  /** The name and email come from core, as they do for the candidates list. */
  it('names the people waiting, so the queue is actionable', async () => {
    arrange([candidateRow()], 1, 3);

    const res = await callQueue();

    expect(res.data[0].email).toBe('a@maildrop.cc');
    expect(usersService.findManyByIds).toHaveBeenCalled();
  });
});
