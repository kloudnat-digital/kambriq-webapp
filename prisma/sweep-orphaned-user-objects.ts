/* eslint-disable @nx/enforce-module-boundaries */
import 'dotenv/config';
import { DeleteObjectsCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient as CoreClient } from '../libs/common/src/prisma/core-client/client';

/**
 * C4c - the orphans that already exist.
 *
 * ---------------------------------------------------------------------------
 * Why a one-off script and not a migration
 * ---------------------------------------------------------------------------
 * The fix in `cleanup.processor.ts` stops new orphans being made. It cannot
 * touch the ones already there: the accounts are gone, so nothing in the
 * database points at those prefixes any more. The only way back to them is
 * from the bucket side - list what is under `users/`, ask the database whether
 * each owner still exists, and remove the prefixes whose owner does not.
 *
 * ---------------------------------------------------------------------------
 * It reports before it deletes, and it is safe to run twice
 * ---------------------------------------------------------------------------
 * **Dry run is the default.** `--apply` is required to delete anything, so the
 * first run of a script that removes people's files is always a list somebody
 * can read. A second run finds nothing left to do and says so; a run
 * interrupted half way leaves the remainder for the next one, because the
 * decision is taken per prefix from current state rather than from a plan made
 * at the start.
 *
 * ---------------------------------------------------------------------------
 * The direction that would be a disaster
 * ---------------------------------------------------------------------------
 * A sweep that deletes everything passes every "did the orphan go" check and
 * destroys live users' documents. So:
 *
 * - a prefix is deleted **only** when the database says that id is absent;
 * - an id that does not parse as a UUID is **skipped**, never deleted, because
 *   an unrecognised shape is something this script does not understand rather
 *   than something it may remove;
 * - if the database lookup fails, the run aborts before deleting anything.
 *
 * Usage:
 *   npx tsx prisma/sweep-orphaned-user-objects.ts            # report only
 *   npx tsx prisma/sweep-orphaned-user-objects.ts --apply    # delete
 */

const BUCKET = process.env['AWS_S3_BUCKET'] ?? '';
const REGION = process.env['AWS_S3_REGION'] || process.env['AWS_REGION'] || 'eu-central-1';
const APPLY = process.argv.includes('--apply');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const s3 = new S3Client({ region: REGION });

/** Every `users/<id>/` prefix that currently holds at least one object. */
const listUserPrefixes = async (): Promise<Map<string, string[]>> => {
  const byOwner = new Map<string, string[]>();
  let token: string | undefined;

  do {
    const page = await s3.send(
      new ListObjectsV2Command({ Bucket: BUCKET, Prefix: 'users/', ContinuationToken: token }),
    );
    for (const o of page.Contents ?? []) {
      if (!o.Key) continue;
      const owner = o.Key.split('/')[1];
      if (!owner) continue;
      byOwner.set(owner, [...(byOwner.get(owner) ?? []), o.Key]);
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);

  return byOwner;
};

const main = async () => {
  if (!BUCKET) throw new Error('AWS_S3_BUCKET is not set. Refusing to sweep an unnamed bucket.');

  const pool = new Pool({ connectionString: process.env['DATABASE_URL_CORE'] });
  const prisma = new CoreClient({ adapter: new PrismaPg(pool) });

  try {
    const byOwner = await listUserPrefixes();
    const owners = [...byOwner.keys()];
    console.log(`Bucket ${BUCKET}: ${owners.length} user prefix(es) hold objects.`);

    const malformed = owners.filter((o) => !UUID.test(o));
    const candidates = owners.filter((o) => UUID.test(o));

    // One query. If it throws, nothing below runs and nothing is deleted.
    const alive = await prisma.user.findMany({
      where: { id: { in: candidates } },
      select: { id: true },
    });
    const aliveIds = new Set(alive.map((u) => u.id));

    const orphans = candidates.filter((o) => !aliveIds.has(o));
    const kept = candidates.filter((o) => aliveIds.has(o));

    console.log(`  owners with a live account : ${kept.length}`);
    console.log(`  owners with no account     : ${orphans.length}`);
    if (malformed.length > 0) {
      console.log(`  SKIPPED, not a user id     : ${malformed.length} (${malformed.join(', ')})`);
    }

    let objectCount = 0;
    for (const o of orphans) objectCount += (byOwner.get(o) ?? []).length;
    console.log(`\n${orphans.length} orphaned prefix(es), ${objectCount} object(s):`);
    for (const o of orphans) {
      console.log(`  users/${o}/  (${(byOwner.get(o) ?? []).length} object(s))`);
    }

    if (orphans.length === 0) {
      console.log('\nNothing to do.');
      return;
    }

    if (!APPLY) {
      console.log('\nDRY RUN. Nothing was deleted. Re-run with --apply to remove them.');
      return;
    }

    let deleted = 0;
    for (const o of orphans) {
      const keys = byOwner.get(o) ?? [];
      for (let i = 0; i < keys.length; i += 1000) {
        const batch = keys.slice(i, i + 1000);
        const res = await s3.send(
          new DeleteObjectsCommand({
            Bucket: BUCKET,
            Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: false },
          }),
        );
        const errors = res.Errors ?? [];
        if (errors.length > 0) {
          throw new Error(
            `users/${o}/: ${errors.length} object(s) could not be deleted ` +
              `(${errors[0]?.Code}: ${errors[0]?.Message}). Stopping - the rest are ` +
              `untouched and a re-run resumes from current state.`,
          );
        }
        deleted += res.Deleted?.length ?? 0;
      }
    }

    console.log(`\nDeleted ${deleted} object(s) across ${orphans.length} prefix(es).`);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
