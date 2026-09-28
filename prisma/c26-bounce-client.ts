/**
 * C26 - one verified client at the SES mailbox simulator's bounce address.
 *
 * It exists so the payment screen's bounce warning can be proven on dev through
 * product flows: the client signs in, an agent reserves for it, it requests a
 * payment, and every email to it bounces for real. The account is created the
 * way the seed creates test accounts - verified, with the fixture password.
 *
 * It writes exactly one row: an upsert of one core `User`, keyed on its address,
 * whose update clause is empty, so a second run changes nothing. It deletes
 * nothing and touches no other table. Run as a one-off task:
 *   npx tsx --tsconfig tsconfig.base.json prisma/c26-bounce-client.ts
 */
/* eslint-disable @nx/enforce-module-boundaries */
import 'dotenv/config';
import * as bcrypt from 'bcryptjs';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient as CoreClient } from '../libs/common/src/prisma/core-client/client';

const C26_EMAIL = 'bounce+c26@simulator.amazonses.com';

const core = new CoreClient({
  adapter: new PrismaPg(new Pool({ connectionString: process.env['DATABASE_URL_CORE'] })),
});

async function main() {
  const user = await core.user.upsert({
    where: { email: C26_EMAIL },
    create: {
      email: C26_EMAIL,
      firstName: 'C26',
      lastName: 'Bounce proof',
      passwordHash: bcrypt.hashSync('Test1234!', 12),
      emailVerified: true,
      preferredLanguage: 'fr',
    },
    update: {},
  });
  console.log(`C26 client ${user.email} id=${user.id} verified=${user.emailVerified}`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await core.$disconnect();
  });
