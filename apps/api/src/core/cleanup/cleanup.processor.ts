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
   * C4c - hard-deletes accounts past their grace period, **and their files**.
   *
   * ---------------------------------------------------------------------------
   * What this used to do, and why the bucket filled with orphans
   * ---------------------------------------------------------------------------
   * One `deleteMany`. It erased the rows and touched S3 not at all, so every
   * account it purged left its identity documents behind for ever - and
   * `deleteMany` returns only a **count**, so the ids were gone the instant it
   * ran and nothing could say afterwards which prefixes to clean.
   *
   * That is how 79 documents came to sit under `users/` for accounts that no
   * longer existed, including real ones. The log line said
   * `purgedUsers: N`, which reads exactly like success.
   *
   * ---------------------------------------------------------------------------
   * The order is the fix
   * ---------------------------------------------------------------------------
   * Select the ids first, then **per user: delete the objects, then the row.**
   *
   * If S3 refuses, the row is **not** deleted. Both halves stay, the pair stays
   * consistent, and the next run retries. The alternative - delete the row
   * anyway - is the shape that created this defect: it manufactures a fresh
   * orphan at the exact moment something is already going wrong.
   *
   * The run then **throws** with a tally rather than returning a number that
   * looks fine. A purge that half-worked must not complete green.
   *
   * ---------------------------------------------------------------------------
   * Idempotence
   * ---------------------------------------------------------------------------
   * Safe to run twice. A second run matches no rows and does nothing; a run
   * that failed on S3 for one user leaves that user selectable again, so the
   * retry is the ordinary path rather than a repair procedure.
   *
   * The retention period itself is `C4b`, still with the lawyer. It changes
   * `GRACE_PERIOD_DAYS` - when this runs - not what it must delete.
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
