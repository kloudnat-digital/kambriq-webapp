import { OnWorkerEvent, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';

/**
 * Base class for every BullMQ processor: a job that fails writes an
 * error-level line naming its queue, job name, id and attempt.
 *
 * BullMQ records a failed job in Redis and logs nothing, so a job that fails
 * every run is visible only to somebody reading `/health/queues` (A18). The
 * payload is deliberately left out of the line: it can carry personal data,
 * which is why A18 keeps it behind ADMIN_GLOBAL.
 */
export abstract class LoudWorkerHost extends WorkerHost {
  protected readonly failureLogger = new Logger(this.constructor.name);

  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, error: Error): void {
    this.failureLogger.error('Queue job failed %o', {
      queue: job?.queueName,
      job: job?.name,
      id: job?.id,
      attempt: job?.attemptsMade,
      maxAttempts: job?.opts?.attempts ?? 1,
      error: error?.message,
    });
  }
}
