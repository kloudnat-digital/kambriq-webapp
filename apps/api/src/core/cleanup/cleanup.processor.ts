import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { CORE_JOBS, QUEUES } from '@kambriq/common';
import { CorePrismaService } from '../prisma/core-prisma.service';

@Processor(QUEUES.CORE)
export class CoreCleanupProcessor extends WorkerHost {
  private readonly logger = new Logger(CoreCleanupProcessor.name);

  constructor(private readonly prisma: CorePrismaService) {
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
