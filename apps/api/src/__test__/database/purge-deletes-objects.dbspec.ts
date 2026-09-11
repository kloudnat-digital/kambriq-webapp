import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { CORE_JOBS, StorageService } from '@kambriq/common';
import { ContactService } from '../../core/contact/contact.service';
import { CoreCleanupProcessor } from '../../core/cleanup/cleanup.processor';
import { CorePrismaService } from '../../core/prisma/core-prisma.service';
import { openCoreTestDatabase, type TestDatabase } from './core-test-db';

/**
 * C4c - the purge deletes the files as well as the rows.
 *
 * ---------------------------------------------------------------------------
 * What this exists to prevent
 * ---------------------------------------------------------------------------
 * The purge used to be one `deleteMany`. It erased accounts and left every
 * identity document they had uploaded in the bucket for ever - and because
 * `deleteMany` returns a count rather than ids, the information needed to
 * clean up was gone the instant it ran. 79 documents were found that way,
 * belonging to accounts that no longer existed.
 *
 * **Asserting only that the row is gone is the bug this file exists to catch.**
 * That assertion passed throughout.
 *
 * ---------------------------------------------------------------------------
 * Real database, test-double object store, and why that split
 * ---------------------------------------------------------------------------
 * The rows are real: created in `kambriq_core_test`, read back through a second
 * client. The object store is a double, deliberately. A test that deleted from
 * a real bucket on every run is a test that eventually deletes something real,
 * and the processor's contract here is "ask storage to clear this prefix, and
 * do not delete the row unless it did" - which is exactly what the double can
 * hold to account. `storage.service.ts`'s own paging and error handling are its
 * to prove.
 */

/** An object store that remembers, and can be told to refuse. */
class FakeStorage {
  readonly objects = new Map<string, string>();
  refuseFor: string | null = null;
  readonly prefixesAsked: string[] = [];

  put(key: string) {
    this.objects.set(key, 'x');
  }

  keysUnder(prefix: string): string[] {
    return [...this.objects.keys()].filter((k) => k.startsWith(prefix));
  }

  async listKeys(prefix: string): Promise<string[]> {
    return this.keysUnder(prefix);
  }

  async deletePrefix(prefix: string): Promise<number> {
    this.prefixesAsked.push(prefix);
    if (this.refuseFor && prefix.includes(this.refuseFor)) {
      throw new Error('AccessDenied: the bucket refused (simulated)');
    }
    const keys = this.keysUnder(prefix);
    for (const k of keys) this.objects.delete(k);
    return keys.length;
  }
}

describe('C4c - purging an account removes its files too', () => {
  let db: TestDatabase;
  let core: CorePrismaService;
  let storage: FakeStorage;
  let processor: CoreCleanupProcessor;

  const job = { name: CORE_JOBS.PURGE_DELETED_USERS } as Job;
  const LONG_AGO = new Date(Date.now() - 40 * 86_400_000);
  const RECENTLY = new Date(Date.now() - 2 * 86_400_000);

  beforeAll(async () => {
    db = openCoreTestDatabase();
    core = new CorePrismaService({
      get: (key: string) => (key === 'DATABASE_URL_CORE' ? db.url : undefined),
    } as unknown as ConfigService);
    await core.onModuleInit();
  });

  afterAll(async () => {
    await core.onModuleDestroy();
    await db.close();
  });

  beforeEach(() => {
    storage = new FakeStorage();
    // The digest is L1/L2's and is not exercised here; it only has to be
    // injectable, and the purge never reaches it.
    const contact = { sendDailyDigest: jest.fn() } as unknown as ContactService;
    processor = new CoreCleanupProcessor(core, contact, storage as unknown as StorageService);
  });

  /** A user, with one document under their prefix. */
  const seed = async (
    over: { deletedAt?: Date | null; isActive?: boolean; deactivatedBy?: string | null } = {},
  ) => {
    const id = randomUUID();
    await core.user.create({
      data: {
        id,
        email: `c4c-${id}@example.test`,
        firstName: 'Purge',
        lastName: 'Fixture',
        isActive: over.isActive ?? false,
        deletedAt: over.deletedAt === undefined ? LONG_AGO : over.deletedAt,
        deactivatedBy: over.deactivatedBy ?? null,
      },
    });
    const key = `users/${id}/id-documents/${Date.now()}-cni.pdf`;
    storage.put(key);
    return { id, key, prefix: `users/${id}/` };
  };

  const rowExists = async (id: string) => (await core.user.count({ where: { id } })) === 1;

  it('deletes BOTH the row and the object', async () => {
    const u = await seed();

    // Both present before.
    expect(await rowExists(u.id)).toBe(true);
    expect(storage.keysUnder(u.prefix)).toHaveLength(1);

    await processor.process(job);

    // The assertion the old code passed.
    expect(await rowExists(u.id)).toBe(false);

    // The assertion it did not, and the whole reason this file exists.
    expect(storage.keysUnder(u.prefix)).toHaveLength(0);
    expect(storage.prefixesAsked).toContain(u.prefix);
  });

  it('removes every object under the prefix, not just the first', async () => {
    const u = await seed();
    storage.put(`users/${u.id}/id-documents/${Date.now()}-second.pdf`);
    storage.put(`users/${u.id}/avatar/${Date.now()}-photo.jpg`);
    expect(storage.keysUnder(u.prefix)).toHaveLength(3);

    await processor.process(job);

    // Including the avatar: erasing an account erases what it uploaded, and a
    // sweep that cleared only id-documents would leave the rest behind.
    expect(storage.keysUnder(u.prefix)).toHaveLength(0);
  });

  describe('a user who is still here keeps everything', () => {
    it('an active account is untouched', async () => {
      // A sweep that deletes everything passes the first test in this file and
      // destroys the data. This is the test that stops it.
      const live = await seed({ isActive: true, deletedAt: null });

      await processor.process(job);

      expect(await rowExists(live.id)).toBe(true);
      expect(storage.keysUnder(live.prefix)).toHaveLength(1);
      expect(storage.prefixesAsked).not.toContain(live.prefix);
    });

    it('an account still inside its grace period is untouched', async () => {
      const recent = await seed({ deletedAt: RECENTLY });

      await processor.process(job);

      expect(await rowExists(recent.id)).toBe(true);
      expect(storage.keysUnder(recent.prefix)).toHaveLength(1);
    });

    it('an admin-suspended account is untouched', async () => {
      const suspended = await seed({ deactivatedBy: 'an-admin' });

      await processor.process(job);

      expect(await rowExists(suspended.id)).toBe(true);
      expect(storage.keysUnder(suspended.prefix)).toHaveLength(1);
    });

    it('purges the expired one and leaves the live one, in the same run', async () => {
      const doomed = await seed();
      const live = await seed({ isActive: true, deletedAt: null });

      await processor.process(job);

      expect(await rowExists(doomed.id)).toBe(false);
      expect(storage.keysUnder(doomed.prefix)).toHaveLength(0);
      expect(await rowExists(live.id)).toBe(true);
      expect(storage.keysUnder(live.prefix)).toHaveLength(1);
    });
  });

  describe('when S3 refuses', () => {
    it('the row survives, so no NEW orphan is made', async () => {
      /**
       * The shape of the original defect, in reverse. Deleting the row anyway
       * would manufacture an orphan at the exact moment something is already
       * going wrong - and that orphan would be unrecoverable, because the id
       * goes with the row.
       */
      const u = await seed();
      storage.refuseFor = u.id;

      await expect(processor.process(job)).rejects.toThrow(/purge incomplete/i);

      expect(await rowExists(u.id)).toBe(true);
      expect(storage.keysUnder(u.prefix)).toHaveLength(1);
    });

    it('the failure is loud, and names the account', async () => {
      // A purge that half-worked must not complete green.
      const u = await seed();
      storage.refuseFor = u.id;

      await expect(processor.process(job)).rejects.toThrow(u.id);
    });

    it('one refusal does not stop the others being purged', async () => {
      const blocked = await seed();
      const fine = await seed();
      storage.refuseFor = blocked.id;

      await expect(processor.process(job)).rejects.toThrow(/purge incomplete/i);

      expect(await rowExists(blocked.id)).toBe(true);
      expect(await rowExists(fine.id)).toBe(false);
      expect(storage.keysUnder(fine.prefix)).toHaveLength(0);
    });

    it('the retry is the ordinary path: a second run clears what the first could not', async () => {
      const u = await seed();
      storage.refuseFor = u.id;
      await expect(processor.process(job)).rejects.toThrow();

      storage.refuseFor = null;
      await expect(processor.process(job)).resolves.toMatchObject({ purgedUsers: 1 });

      expect(await rowExists(u.id)).toBe(false);
      expect(storage.keysUnder(u.prefix)).toHaveLength(0);
    });
  });

  it('is idempotent: a second run finds nothing and does nothing', async () => {
    const u = await seed();
    await processor.process(job);

    const second = (await processor.process(job)) as { candidates: number; purgedUsers: number };
    expect(second.candidates).toBe(0);
    expect(second.purgedUsers).toBe(0);
    expect(await rowExists(u.id)).toBe(false);
  });

  it('a user with no files at all is purged without a special case', async () => {
    const id = randomUUID();
    await core.user.create({
      data: {
        id,
        email: `c4c-nofiles-${id}@example.test`,
        firstName: 'No',
        lastName: 'Files',
        isActive: false,
        deletedAt: LONG_AGO,
      },
    });

    await expect(processor.process(job)).resolves.toMatchObject({ purgedUsers: 1 });
    expect(await rowExists(id)).toBe(false);
  });
});
