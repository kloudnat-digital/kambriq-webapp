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

  async process(job: Job): Promise<unknown> {
    switch (job.name) {
      case CORE_JOBS.CLEANUP_EXPIRED_TOKENS:
        return this.handleCleanupExpiredTokens();
      case CORE_JOBS.PURGE_DELETED_USERS:
        return this.handlePurgeDeletedUsers();
      default:
        this.logger.warn(`Unknown CORE job: ${job.name}`);
        return null;
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

    this.logger.log('Token cleanup complete', {
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

    this.logger.log('User purge complete', { purgedUsers: result.count });
    return { purgedUsers: result.count };
  }
}
