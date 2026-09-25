import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUES } from '@kambriq/common';

/**
 * Provides observability into job queues.
 * Returns counts of jobs in various states and job payloads for inspection.
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
   * Retrieves job counts for all queues and states in parallel.
   * Individual queue failures do not affect the reporting of others.
   */
  async counts(): Promise<{
    queues: (QueueCounts | { queue: string; error: string })[];
    totalFailed: number;
  }> {
    const results = await Promise.all(
      /**
       * The return type union is explicit to ensure TypeScript correctly discriminates
       * between success and error responses when calculating total failures.
       */
      Object.entries(this.queues).map(
        async ([name, queue]): Promise<QueueCounts | { queue: string; error: string }> => {
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
        },
      ),
    );

    return {
      queues: results,
      // Sums the failed jobs across all readable queues. Unreadable queues are omitted.
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
