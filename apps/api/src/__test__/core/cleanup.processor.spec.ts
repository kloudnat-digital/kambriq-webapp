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
  let prisma: {
    refreshToken: { deleteMany: jest.Mock };
    verificationToken: { deleteMany: jest.Mock };
    user: { findMany: jest.Mock; deleteMany: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      refreshToken: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      verificationToken: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      user: { findMany: jest.fn().mockResolvedValue([]), deleteMany: jest.fn() },
    };
    processor = new CoreCleanupProcessor(prisma as never);
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
