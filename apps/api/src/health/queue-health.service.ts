import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUES } from '@kambriq/common';

/**
 * A18 - what the queues are actually doing, from outside the VPC.
 *
 * ---------------------------------------------------------------------------
 * Why this exists
 * ---------------------------------------------------------------------------
 * `S9` proved that an unknown job lands on the failed set rather than
 * disappearing - `failed=1, completed=0`. That proof was taken **locally**. On
 * dev the same failure is invisible: BullMQ keeps its sets in ElastiCache, on a
 * private VPC endpoint, and nothing in the API reported them. `/health` answered
 * about databases, memory and disk, and said nothing about the queues.
 *
 * **A failure nobody can observe is a silent failure whatever the code
 * guarantees.** The KAMNET commission is the case that matters: an agent not
 * being paid, with a job sitting in a set nobody can read, is where this whole
 * line of work started.
 *
 * ---------------------------------------------------------------------------
 * Counts and payloads, not counts alone
 * ---------------------------------------------------------------------------
 * A count says *something* failed. It does not say what, for whom, or whether it
 * can be replayed. `removeOnFailed: 200` already keeps the last two hundred
 * failures with their data; this reads them back.
 */
export type QueueCounts = {
  queue: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  /** Present so a paused queue is not read as a quiet one. */
  paused: number;
};

export type FailedJob = {
  id: string;
  name: string;
  /** The payload, intact. This is what makes a failure actionable. */
  data: unknown;
  failedReason: string | null;
  attemptsMade: number;
  /** When it was enqueued, and when it last failed. */
  enqueuedAt: string | null;
  failedAt: string | null;
};

@Injectable()
export class QueueHealthService {
  private readonly logger = new Logger(QueueHealthService.name);
  private readonly queues: Record<string, Queue>;

  constructor(
    @InjectQueue(QUEUES.KBS) kbs: Queue,
    @InjectQueue(QUEUES.CORE) core: Queue,
    @InjectQueue(QUEUES.KAMNET) kamnet: Queue,
    @InjectQueue(QUEUES.NOTIFICATIONS) notifications: Queue,
    @InjectQueue(QUEUES.DUNNING) dunning: Queue,
  ) {
    this.queues = {
      [QUEUES.KBS]: kbs,
      [QUEUES.CORE]: core,
      [QUEUES.KAMNET]: kamnet,
      [QUEUES.NOTIFICATIONS]: notifications,
      [QUEUES.DUNNING]: dunning,
    };
  }

  /**
   * Every queue, every state.
   *
   * All five are read in parallel and **one failing does not hide the others**:
   * a queue whose Redis call throws comes back named, with its error, rather
   * than collapsing the whole response - which would turn "one queue is
   * unreachable" into "queues are unobservable", the exact thing this fixes.
   */
  async counts(): Promise<{
    queues: (QueueCounts | { queue: string; error: string })[];
    totalFailed: number;
  }> {
    const results = await Promise.all(
      Object.entries(this.queues).map(async ([name, queue]) => {
        try {
          const c = await queue.getJobCounts(
            'waiting',
            'active',
            'completed',
            'failed',
            'delayed',
            'paused',
          );
          return {
            queue: name,
            waiting: c['waiting'] ?? 0,
            active: c['active'] ?? 0,
            completed: c['completed'] ?? 0,
            failed: c['failed'] ?? 0,
            delayed: c['delayed'] ?? 0,
            paused: c['paused'] ?? 0,
          };
        } catch (error) {
          this.logger.error('Could not read queue counts %o', {
            queue: name,
            error: error instanceof Error ? error.message : String(error),
          });
          return {
            queue: name,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      }),
    );

    return {
      queues: results,
      // The number somebody watches. Queues that could not be read contribute
      // nothing to it, which is why they are returned individually above rather
      // than silently counted as zero.
      totalFailed: results.reduce((sum, r) => sum + ('failed' in r ? r.failed : 0), 0),
    };
  }

  /** The failed jobs of one queue, newest first, with their payloads. */
  async failed(queueName: string, limit = 20): Promise<FailedJob[]> {
    const queue = this.queues[queueName];
    if (!queue) {
      // Named, with what is available: a typo should not read as "nothing has
      // failed".
      throw new NotFoundException(
        `No queue named "${queueName}". Queues: ${Object.keys(this.queues).join(', ')}.`,
      );
    }

    const jobs = await queue.getFailed(0, Math.max(0, limit - 1));

    return jobs.map((job) => ({
      id: String(job.id),
      name: job.name,
      data: job.data,
      failedReason: job.failedReason ?? null,
      attemptsMade: job.attemptsMade,
      enqueuedAt: job.timestamp ? new Date(job.timestamp).toISOString() : null,
      failedAt: job.finishedOn ? new Date(job.finishedOn).toISOString() : null,
    }));
  }
}
