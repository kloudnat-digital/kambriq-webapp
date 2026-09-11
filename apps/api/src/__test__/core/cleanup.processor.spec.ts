import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';

import { CoreCleanupProcessor } from '../../core/cleanup/cleanup.processor';
import { CORE_JOBS } from '@kambriq/common';

/**
 * The cleanup queue deletes expired tokens and purges soft-deleted users.
 *
 * Returning `null` for an unrecognised job name marked it completed, so a
 * renamed constant would have silently stopped both — and the symptom of
 * cleanup not running is a table growing slowly, which nobody notices for
 * months.
 */
const makeJob = (name: string) => ({ name, data: {} }) as unknown as Job;

describe('CoreCleanupProcessor: unknown job names', () => {
  let processor: CoreCleanupProcessor;
  let contact: { sendDailyDigest: jest.Mock };
  let storage: { deletePrefix: jest.Mock; listKeys: jest.Mock };
  let prisma: {
    refreshToken: { deleteMany: jest.Mock };
    verificationToken: { deleteMany: jest.Mock };
    user: { findMany: jest.Mock; deleteMany: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      refreshToken: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      verificationToken: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      user: { findMany: jest.fn().mockResolvedValue([]), delete: jest.fn(), deleteMany: jest.fn() },
    };
    // L2 put the contact digest on this processor's switch rather than on a
    // second `@Processor(QUEUES.CORE)`. Its own behaviour is covered in
    // `contact.service.spec.ts`; here it only has to be injectable.
    contact = { sendDailyDigest: jest.fn().mockResolvedValue({ count: 0, pending: 0 }) };
    // C4c: the purge now clears the user's S3 prefix before deleting the row.
    storage = {
      deletePrefix: jest.fn().mockResolvedValue(0),
      listKeys: jest.fn().mockResolvedValue([]),
    };
    processor = new CoreCleanupProcessor(prisma as never, contact as never, storage as never);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('throws rather than completing the job', async () => {
    await expect(processor.process(makeJob('core.tidy-up'))).rejects.toThrow(
      /Unknown CORE job: core\.tidy-up/,
    );
  });

  it('deletes nothing when the name is unknown', async () => {
    await processor.process(makeJob('core.tidy-up')).catch(() => undefined);

    expect(prisma.refreshToken.deleteMany).not.toHaveBeenCalled();
    expect(prisma.verificationToken.deleteMany).not.toHaveBeenCalled();
  });

  it('still runs the job it does recognise', async () => {
    await expect(
      processor.process(makeJob(CORE_JOBS.CLEANUP_EXPIRED_TOKENS)),
    ).resolves.toBeDefined();
    expect(prisma.refreshToken.deleteMany).toHaveBeenCalled();
  });
});
