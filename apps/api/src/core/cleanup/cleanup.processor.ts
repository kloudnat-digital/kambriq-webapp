import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { CORE_JOBS, QUEUES } from '@kambriq/common';
import { CorePrismaService } from '../prisma/core-prisma.service';
import { ContactService } from '../contact/contact.service';

@Processor(QUEUES.CORE)
export class CoreCleanupProcessor extends WorkerHost {
  private readonly logger = new Logger(CoreCleanupProcessor.name);

  constructor(
    private readonly prisma: CorePrismaService,
    private readonly contact: ContactService,
  ) {
    super();
  }

  /**
   * An unknown job name is a defect, not a no-op.
   *
   * A resolved promise marks a BullMQ job **completed**. Returning `null` for a
   * name this processor does not recognise therefore reports success for work
   * that was never done: rename a constant, deploy, and every job of that kind
   * drains from the queue with a green tick and a `warn` nobody is reading.
   * Throwing puts the job on the failed set, where it is countable and
   * retryable.
   */
  async process(job: Job): Promise<unknown> {
    switch (job.name) {
      case CORE_JOBS.CLEANUP_EXPIRED_TOKENS:
        return this.handleCleanupExpiredTokens();
      case CORE_JOBS.PURGE_DELETED_USERS:
        return this.handlePurgeDeletedUsers();
      /**
       * L2 - a case in this switch rather than a processor of its own.
       *
       * A second `@Processor(QUEUES.CORE)` would be a second worker on one
       * queue, and BullMQ hands a job to exactly one of them - so whichever won
       * a token-cleanup job would run its own switch, not find the name, and
       * (before this file threw) discard it. That is precisely the defect G6
       * introduced and `one-processor-per-queue.spec.ts` now forbids.
       *
       * It deliberately does not catch: `sendDailyDigest` throws when it has
       * nowhere to send, and that belongs on the failed set.
       */
      case CORE_JOBS.CONTACT_DIGEST:
        return this.contact.sendDailyDigest();
      default:
        throw new Error(`Unknown CORE job: ${job.name}`);
    }
  }

  /**
   * Deletes expired and revoked refresh tokens, and used/expired verification tokens.
   * Runs daily. Prevents unbounded table growth.
   */
  private async handleCleanupExpiredTokens() {
    const now = new Date();

    const [deletedRefresh, deletedVerification] = await Promise.all([
      this.prisma.refreshToken.deleteMany({
        where: {
          OR: [{ revokedAt: { not: null } }, { expiresAt: { lt: now } }],
        },
      }),
      this.prisma.verificationToken.deleteMany({
        where: {
          OR: [{ usedAt: { not: null } }, { expiresAt: { lt: now } }],
        },
      }),
    ]);

    this.logger.log('Token cleanup complete %o', {
      deletedRefreshTokens: deletedRefresh.count,
      deletedVerificationTokens: deletedVerification.count,
    });

    return {
      deletedRefreshTokens: deletedRefresh.count,
      deletedVerificationTokens: deletedVerification.count,
    };
  }

  /**
   * Hard-deletes user accounts whose soft-delete grace period has expired (30 days).
   * Runs daily. Fulfills GDPR data retention obligations.
   */
  private async handlePurgeDeletedUsers() {
    const GRACE_PERIOD_DAYS = 30;
    const cutoff = new Date(Date.now() - GRACE_PERIOD_DAYS * 86_400_000);

    const result = await this.prisma.user.deleteMany({
      where: {
        isActive: false,
        deletedAt: { lt: cutoff },
        deactivatedBy: null, // Do NOT purge admin-suspended accounts
      },
    });

    this.logger.log('User purge complete %o', { purgedUsers: result.count });
    return { purgedUsers: result.count };
  }
}
