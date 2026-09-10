import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { CORE_JOBS, QUEUES } from '@kambriq/common';

@Injectable()
export class CleanupScheduler implements OnModuleInit {
  private readonly logger = new Logger(CleanupScheduler.name);

  constructor(
    @InjectQueue(QUEUES.CORE) private readonly coreQueue: Queue,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    await this.scheduleTokenCleanup();
    await this.scheduleUserPurge();
    await this.scheduleContactDigest();
  }

  private async scheduleTokenCleanup() {
    await this.coreQueue.add(
      CORE_JOBS.CLEANUP_EXPIRED_TOKENS,
      {},
      {
        jobId: 'cleanup-expired-tokens-cron',
        repeat: { pattern: '0 3 * * *' }, // Every day at 03:00 UTC
        removeOnComplete: 5,
        removeOnFail: 10,
      },
    );
    this.logger.log('Token cleanup cron scheduled (daily 03:00 UTC)');
  }

  private async scheduleUserPurge() {
    await this.coreQueue.add(
      CORE_JOBS.PURGE_DELETED_USERS,
      {},
      {
        jobId: 'purge-deleted-users-cron',
        repeat: { pattern: '0 4 * * *' }, // Every day at 04:00 UTC
        removeOnComplete: 5,
        removeOnFail: 10,
      },
    );
    this.logger.log('User purge cron scheduled (daily 04:00 UTC)');
  }

  /**
   * L2 - the daily contact digest.
   *
   * On the queue that already exists, handled by the processor that already
   * owns it. **No second `@Processor(QUEUES.CORE)`**: BullMQ gives a job to one
   * worker, and a second one on the same queue is how G6 silently ate a payment
   * reminder. No new queue either - nothing here provisions infrastructure.
   */
  private async scheduleContactDigest() {
    const pattern = this.config.get<string>('CONTACT_DIGEST_CRON', '0 7 * * *');

    await this.coreQueue.add(
      CORE_JOBS.CONTACT_DIGEST,
      {},
      {
        // A fixed id, so a restart re-registers the same schedule rather than
        // accumulating one more digest per deploy.
        jobId: 'contact-digest-cron',
        repeat: { pattern },
        removeOnComplete: 10,
        /**
         * Larger than `removeOnComplete`, like the dunning sweep's. A digest
         * that succeeded is a heartbeat and one is as good as another; a digest
         * that failed is the record that nobody was told what came in, and it
         * is what `/health/queues/failed` exists to surface.
         */
        removeOnFail: 200,
      },
    );

    this.logger.log('Contact digest cron scheduled %o', { pattern });
  }
}
