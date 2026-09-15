import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { KBS_JOBS, QUEUES } from '@kambriq/common';

/**
 * I15 - registers the daily sweep that withdraws KCA_CERTIFIED from holders
 * whose certificate has expired (`KbsCertificatesService.withdrawExpiredCertifications`).
 *
 * A BullMQ repeatable job, like the dunning sweep and the contact digest, so a
 * sweep that throws lands in the queue's `failed` set, which `/health/queues`
 * surfaces, instead of a log line nobody reads. It is handled by the KBS
 * queue's existing processor: a second `@Processor(QUEUES.KBS)` would race the
 * first for every job on the queue.
 */
@Injectable()
export class KbsCertificateExpiryScheduler implements OnModuleInit {
  private readonly logger = new Logger(KbsCertificateExpiryScheduler.name);

  constructor(@InjectQueue(QUEUES.KBS) private readonly kbsQueue: Queue) {}

  async onModuleInit() {
    const pattern = '30 2 * * *'; // every day at 02:30 UTC

    await this.kbsQueue.add(
      KBS_JOBS.WITHDRAW_EXPIRED_CERTIFICATIONS,
      {},
      {
        // A fixed id, so a restart re-registers the same schedule rather than
        // adding one more sweep per deploy.
        jobId: 'withdraw-expired-certifications-cron',
        repeat: { pattern },
        removeOnComplete: 10,
        removeOnFail: 200,
      },
    );

    this.logger.log('Certificate expiry sweep scheduled %o', { pattern });
  }
}
