/* eslint-disable @nx/enforce-module-boundaries */
import 'dotenv/config';
import { DeleteObjectsCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient as CoreClient } from '../libs/common/src/prisma/core-client/client';

/**
 * Cleans up orphaned user objects in S3 where the user no longer exists in the database.
 *
 * Behavior and safety mechanisms:
 * - Operates from the bucket side, listing all `users/` prefixes and querying the database
 *   to determine if the corresponding user account still exists.
 * - Deletes are executed strictly for prefixes whose owner ID is absent from the database.
 * - Non-UUID folder names are skipped to prevent unintended data loss.
 * - Database lookup failures halt execution immediately.
 * - Dry run is the default mode. The `--apply` flag is explicitly required to execute deletions.
 * - The script is idempotent and resumes processing accurately if interrupted.
 *
 * Usage:
 *   npx tsx prisma/sweep-orphaned-user-objects.ts            # Dry run report
 *   npx tsx prisma/sweep-orphaned-user-objects.ts --apply    # Execute deletions
 */

const BUCKET = process.env['AWS_S3_BUCKET'] ?? '';
const REGION = process.env['AWS_S3_REGION'] || process.env['AWS_REGION'] || 'eu-central-1';
const APPLY = process.argv.includes('--apply');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const s3 = new S3Client({ region: REGION });

/** Retrieves all `users/<id>/` prefixes containing at least one object. */
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

    // Validate existence in a single query; failure safely aborts execution.
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
