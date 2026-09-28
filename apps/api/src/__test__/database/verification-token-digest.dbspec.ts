import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { hashToken } from '@kambriq/common';
import { openCoreTestDatabase, type TestDatabase } from './core-test-db';

const MIGRATION = join(
  __dirname,
  '../../../../../prisma/core/migrations/20260928130000_c27_verification_token_digest/migration.sql',
);
const SQL_DIGEST = `encode(sha256(convert_to($1, 'UTF8')), 'hex')`;

/**
 * C27 - the migration hashes the tokens already stored with the digest the API
 * computes, so a link sent before it keeps working after it.
 */
describe('C27 - Postgres and the API compute the same token digest', () => {
  let db: TestDatabase;

  beforeAll(() => {
    db = openCoreTestDatabase();
  });

  afterAll(async () => {
    await db.close();
  });

  it('gives Node digest for tokens of the shape the API issues', async () => {
    for (let i = 0; i < 20; i++) {
      const token = randomBytes(32).toString('hex');
      const { rows } = await db.pool.query<{ digest: string }>(`select ${SQL_DIGEST} as digest`, [
        token,
      ]);
      expect(rows[0].digest).toBe(hashToken(token));
    }
  });

  it('is the expression the migration runs', () => {
    expect(readFileSync(MIGRATION, 'utf8')).toContain(
      `encode(sha256(convert_to("token", 'UTF8')), 'hex')`,
    );
  });

  it('turns a stored value into the row the API finds with the value a link carries', async () => {
    const user = await db.prisma.user.create({
      data: {
        email: `c27-${randomBytes(6).toString('hex')}@example.test`,
        firstName: 'C27',
        lastName: 'Digest',
      },
    });
    const sent = randomBytes(32).toString('hex');
    const row = await db.prisma.verificationToken.create({
      data: {
        userId: user.id,
        token: sent,
        type: 'password_reset',
        expiresAt: new Date(Date.now() + 3_600_000),
      },
    });

    await db.pool.query(
      `update "VerificationToken" set "token" = encode(sha256(convert_to("token", 'UTF8')), 'hex') where id = $1`,
      [row.id],
    );

    const found = await db.prisma.verificationToken.findUnique({
      where: { token: hashToken(sent) },
    });
    expect(found?.id).toBe(row.id);
    expect(found?.token).not.toBe(sent);
  });
});
