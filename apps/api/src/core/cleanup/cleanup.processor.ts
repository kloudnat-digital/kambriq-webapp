import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { CORE_JOBS, QUEUES } from '@kambriq/common';
import { CorePrismaService } from '../prisma/core-prisma.service';
import { ContactService } from '../contact/contact.service';
import { StorageService } from '@kambriq/common';

@Processor(QUEUES.CORE)
export class CoreCleanupProcessor extends WorkerHost {
  private readonly logger = new Logger(CoreCleanupProcessor.name);

  constructor(
    private readonly prisma: CorePrismaService,
    private readonly contact: ContactService,
    private readonly storage: StorageService,
  ) {
    super();
  }

  /**
   * Processes core background jobs.
   * Throws on unknown job names to ensure failures are correctly tracked by BullMQ.
   */
  async process(job: Job): Promise<unknown> {
    switch (job.name) {
      case CORE_JOBS.CLEANUP_EXPIRED_TOKENS:
        return this.handleCleanupExpiredTokens();
      case CORE_JOBS.PURGE_DELETED_USERS:
        return this.handlePurgeDeletedUsers();
      /**
       * Handled here to avoid multiple `@Processor` decorators on the same queue,
       * which would cause unpredictable job distribution. Unhandled exceptions are correctly
       * propagated to the queue's failed set.
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
   * Purges soft-deleted users past their grace period.
   *
   * Deletion order is critical to prevent orphaned objects in S3:
   * 1. Resolve user IDs to delete.
   * 2. Delete the user's files from S3.
   * 3. Delete the user record from the database.
   *
   * If S3 deletion fails for a user, their database record is preserved to allow
   * subsequent retries, maintaining data consistency. The process throws an error
   * at the end if any deletions failed, ensuring partial success is flagged.
   */
  private async handlePurgeDeletedUsers() {
    const GRACE_PERIOD_DAYS = 30;
    const cutoff = new Date(Date.now() - GRACE_PERIOD_DAYS * 86_400_000);

    // Ids first. `deleteMany` would give a count and lose the one thing the
    // S3 side needs.
    const candidates = await this.prisma.user.findMany({
      where: {
        isActive: false,
        deletedAt: { lt: cutoff },
        deactivatedBy: null, // Do NOT purge admin-suspended accounts
      },
      select: { id: true },
    });

    let purgedUsers = 0;
    let deletedObjects = 0;
    const failures: Array<{ userId: string; reason: string }> = [];

    for (const { id } of candidates) {
      const prefix = `users/${id}/`;
      try {
        deletedObjects += await this.storage.deletePrefix(prefix);
      } catch (error) {
        // The row survives on purpose. See the note above.
        failures.push({
          userId: id,
          reason: error instanceof Error ? error.message : String(error),
        });
        continue;
      }

      await this.prisma.user.delete({ where: { id } });
      purgedUsers += 1;
    }

    this.logger.log('User purge complete %o', {
      candidates: candidates.length,
      purgedUsers,
      deletedObjects,
      failures: failures.length,
    });

    if (failures.length > 0) {
      throw new Error(
        `User purge incomplete: ${failures.length} of ${candidates.length} account(s) kept ` +
          `their database row because their files could not be deleted. Their data is intact ` +
          `and the next run retries them. First failure - ${failures[0].userId}: ` +
          `${failures[0].reason}`,
      );
    }

    return { candidates: candidates.length, purgedUsers, deletedObjects };
  }
}
