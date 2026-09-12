import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { QUEUES } from '@kambriq/common';
import { QueueHealthService } from '../../health/queue-health.service';

/**
 * A18 - the queues have to be observable from outside the VPC.
 *
 * `S9` proved an unknown job lands on the failed set rather than vanishing, and
 * that proof was taken locally. On dev the sets live in ElastiCache on a private
 * endpoint and nothing in the API reported them. A failure nobody can observe is
 * a silent failure whatever the code guarantees - and the case that matters is
 * an agent's commission job failing with nothing to signal it.
 */
const queue = (counts: Record<string, number>, failed: unknown[] = []) => ({
  getJobCounts: jest.fn().mockResolvedValue(counts),
  getFailed: jest.fn().mockResolvedValue(failed),
});

const build = async (over: Partial<Record<string, ReturnType<typeof queue>>> = {}) => {
  const queues = {
    [QUEUES.KBS]:
      over[QUEUES.KBS] ??
      queue({ waiting: 0, active: 0, completed: 5, failed: 0, delayed: 0, paused: 0 }),
    [QUEUES.CORE]:
      over[QUEUES.CORE] ??
      queue({ waiting: 1, active: 0, completed: 2, failed: 0, delayed: 3, paused: 0 }),
    [QUEUES.KAMNET]:
      over[QUEUES.KAMNET] ??
      queue({ waiting: 0, active: 0, completed: 1, failed: 0, delayed: 0, paused: 0 }),
    [QUEUES.NOTIFICATIONS]:
      over[QUEUES.NOTIFICATIONS] ??
      queue({ waiting: 0, active: 1, completed: 9, failed: 2, delayed: 0, paused: 0 }),
    [QUEUES.DUNNING]:
      over[QUEUES.DUNNING] ??
      queue({ waiting: 0, active: 0, completed: 0, failed: 0, delayed: 1, paused: 0 }),
  };

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      QueueHealthService,
      ...Object.entries(queues).map(([name, q]) => ({
        provide: getQueueToken(name),
        useValue: q,
      })),
    ],
  }).compile();

  return { service: module.get(QueueHealthService), queues };
};

describe('A18 - queue state is observable', () => {
  it('reports every state of every queue', async () => {
    const { service } = await build();
    const res = await service.counts();

    // Derived, not spelled. The literal 4 sat here while QueueModule registered
    // five, so the suite agreed with the omission instead of catching it.
    expect(res.queues).toHaveLength(Object.keys(QUEUES).length);
    const names = res.queues.map((q) => q.queue).sort();
    expect(names).toEqual(Object.values(QUEUES).sort());

    const notifications = res.queues.find((q) => q.queue === 'notifications');
    expect(notifications).toMatchObject({
      waiting: 0,
      active: 1,
      completed: 9,
      failed: 2,
      delayed: 0,
      paused: 0,
    });
  });

  it('totals the failures, which is the number somebody watches', async () => {
    const { service } = await build();
    expect((await service.counts()).totalFailed).toBe(2);
  });

  it('reports `paused`, so a paused queue is not read as a quiet one', async () => {
    const { service } = await build({
      [QUEUES.KAMNET]: queue({
        waiting: 7,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
        paused: 7,
      }),
    });
    const kamnet = (await service.counts()).queues.find((q) => q.queue === 'kamnet');
    expect(kamnet).toMatchObject({ paused: 7, waiting: 7 });
  });

  // ----- ONE UNREACHABLE QUEUE MUST NOT HIDE THE OTHERS ----- //

  it('names a queue it could not read, and still reports the rest', async () => {
    /**
     * Collapsing the whole response on one Redis error would turn "one queue is
     * unreachable" into "queues are unobservable" - the exact condition this
     * endpoint exists to end.
     */
    const broken = {
      getJobCounts: jest.fn().mockRejectedValue(new Error('ECONNREFUSED 10.0.1.5:6379')),
      getFailed: jest.fn(),
    };
    const { service } = await build({ [QUEUES.KAMNET]: broken as never });

    const res = await service.counts();

    // Derived, not spelled. The literal 4 sat here while QueueModule registered
    // five, so the suite agreed with the omission instead of catching it.
    expect(res.queues).toHaveLength(Object.keys(QUEUES).length);
    const kamnet = res.queues.find((q) => q.queue === 'kamnet');
    expect(kamnet).toMatchObject({ error: expect.stringContaining('ECONNREFUSED') });
    // The others are intact.
    expect(res.queues.find((q) => q.queue === 'notifications')).toMatchObject({ failed: 2 });
  });

  it('a queue that could not be read counts as no failures, not as zero', async () => {
    // Silently adding 0 for an unreadable queue would make `totalFailed` a
    // number that looks reassuring and means nothing.
    const broken = {
      getJobCounts: jest.fn().mockRejectedValue(new Error('unreachable')),
      getFailed: jest.fn(),
    };
    const { service } = await build({ [QUEUES.NOTIFICATIONS]: broken as never });

    const res = await service.counts();
    expect(res.totalFailed).toBe(0);
    // …and the reader can see why, rather than being told everything is fine.
    expect(res.queues.some((q) => 'error' in q)).toBe(true);
  });

  // ----- THE PAYLOAD IS THE POINT ----- //

  it('returns failed jobs with their payload intact', async () => {
    const failedJob = {
      id: 42,
      name: 'kamnet.sale-completed',
      data: { reservationId: 'res-1', agentUserId: 'agent-gone', landId: 'land-1' },
      failedReason: 'Sale completed but the agent user does not exist in core',
      attemptsMade: 3,
      timestamp: Date.parse('2026-09-07T10:00:00Z'),
      finishedOn: Date.parse('2026-09-07T10:00:20Z'),
    };
    const { service } = await build({
      [QUEUES.KAMNET]: queue({ failed: 1 } as never, [failedJob]),
    });

    const [job] = await service.failed(QUEUES.KAMNET);

    // A count says something failed. This says what, for whom, and whether it
    // can be replayed.
    expect(job.data).toEqual(failedJob.data);
    expect(job.failedReason).toContain('does not exist in core');
    expect(job.attemptsMade).toBe(3);
    expect(job.enqueuedAt).toBe('2026-09-07T10:00:00.000Z');
    expect(job.failedAt).toBe('2026-09-07T10:00:20.000Z');
  });

  it('refuses an unknown queue by name, listing the ones that exist', async () => {
    // A typo must not read as "nothing has failed".
    const { service } = await build();
    await expect(service.failed('kamnett')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.failed('kamnett')).rejects.toThrow(/kbs, core, kamnet, notifications/);
  });

  it('the limit reaches the queue as an inclusive range', async () => {
    const { service, queues } = await build();
    await service.failed(QUEUES.KBS, 5);
    // BullMQ's getFailed(start, end) is inclusive, so a limit of 5 is 0..4.
    expect(queues[QUEUES.KBS].getFailed).toHaveBeenCalledWith(0, 4);
  });

  // ----- THE ROUTES ARE NOT PUBLIC ----- //

  it('both routes require ADMIN_GLOBAL, unlike the health routes beside them', () => {
    /**
     * The counts expose operational internals and the failed route exposes
     * payloads, which carry personal data - a notification job holds a
     * recipient's address. The three health routes above them are `@Public()`;
     * these two must not be.
     */
    const src = readFileSync(join(__dirname, '..', '..', 'health', 'health.controller.ts'), 'utf8');
    const queuesRoute = src.slice(src.indexOf("@Get('queues')"));

    expect(queuesRoute.slice(0, 200)).toContain('@Roles(RoleCode.ADMIN_GLOBAL)');
    const failedRoute = src.slice(src.indexOf("@Get('queues/:name/failed')"));
    expect(failedRoute.slice(0, 200)).toContain('@Roles(RoleCode.ADMIN_GLOBAL)');
    // And neither carries the decorator that would open it.
    expect(queuesRoute.slice(0, src.indexOf("@Get('queues/:name/failed')"))).not.toMatch(
      /^[ \t]*@Public\(\)/m,
    );
  });
});
