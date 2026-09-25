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
   * Schedules the daily contact digest.
   * Uses the existing core queue and its single processor to prevent race conditions.
   */
  private async scheduleContactDigest() {
    const pattern = this.config.get<string>('CONTACT_DIGEST_CRON', '0 7 * * *');

    await this.coreQueue.add(
      CORE_JOBS.CONTACT_DIGEST,
      {},
      {
        // Assign a fixed jobId to prevent duplicate schedules on restart.
        jobId: 'contact-digest-cron',
        repeat: { pattern },
        removeOnComplete: 10,
        /** Keep more failed jobs than completed jobs to preserve error history for health checks. */
        removeOnFail: 200,
      },
    );

    this.logger.log('Contact digest cron scheduled %o', { pattern });
  }
}
