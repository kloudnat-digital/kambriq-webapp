/**
 * Kambriq - bootstrap of the permanent administrator accounts
 *
 * Run via:  npm run db:bootstrap:admins
 *
 * This is NOT the seed. `prisma/seed.ts` creates disposable test data with a
 * published password and is wiped by `db:reset`. These accounts are real people
 * and must exist in every environment, production included, where no seed ever
 * runs.
 *
 * The identities are not in this repository. Real home addresses and phone
 * numbers do not belong in git: the history is permanent, the repo is shared,
 * and a data inventory that has to answer "where does personal data live?"
 * should not have to answer "in the source tree, since 2026". Every field is
 * read from its own SSM parameter under the same prefix as the rest of the
 * app's parameters, so a correction is a parameter update rather than a commit
 * and a deployment.
 *
 * Required parameters, all of them, no defaults:
 *
 *   /kambriq/<env>/api/BOOTSTRAP_ADMIN_<n>_EMAIL
 *   /kambriq/<env>/api/BOOTSTRAP_ADMIN_<n>_FIRST_NAME
 *   /kambriq/<env>/api/BOOTSTRAP_ADMIN_<n>_LAST_NAME
 *   /kambriq/<env>/api/BOOTSTRAP_ADMIN_<n>_PHONE
 *   /kambriq/<env>/api/BOOTSTRAP_ADMIN_<n>_ADDRESS
 *   /kambriq/<env>/api/BOOTSTRAP_ADMIN_<n>_CITY
 *   /kambriq/<env>/api/BOOTSTRAP_ADMIN_<n>_COUNTRY
 *
 * for n in 1..BOOTSTRAP_ADMIN_COUNT. A missing or blank parameter aborts the
 * run and names every one that is missing. It never falls back to a default and
 * it never skips an account quietly: an administrator that silently failed to
 * be created is indistinguishable from one that was never asked for, and is
 * discovered when somebody needs to log in.
 */

/* eslint-disable @nx/enforce-module-boundaries */
import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { GetParametersByPathCommand, SSMClient } from '@aws-sdk/client-ssm';
import { PrismaClient as CoreClient } from '../libs/common/src/prisma/core-client/client';
import { RoleCode } from '../libs/common/src/types/roles.enum';
import { BootstrapError, NO_PASSWORD, collectAdmins } from './bootstrap-admins.identities';

/**
 * Reads the whole prefix in one paginated call rather than one call per
 * parameter, so a missing parameter is reported as part of a complete picture:
 * all of them at once, not the first one to fail.
 */
async function readParameters(prefix: string): Promise<Map<string, string>> {
  const client = new SSMClient({});
  const values = new Map<string, string>();
  let nextToken: string | undefined;

  do {
    const page = await client.send(
      new GetParametersByPathCommand({
        Path: prefix,
        WithDecryption: true,
        MaxResults: 10,
        NextToken: nextToken,
      }),
    );
    for (const parameter of page.Parameters ?? []) {
      if (parameter.Name && parameter.Value !== undefined) {
        values.set(parameter.Name.slice(prefix.length), parameter.Value);
      }
    }
    nextToken = page.NextToken;
  } while (nextToken);

  return values;
}

const pool = new Pool({ connectionString: process.env['DATABASE_URL_CORE'] });
const core = new CoreClient({ adapter: new PrismaPg(pool) });

async function main() {
  const env = process.env['BOOTSTRAP_ENV'] ?? process.env['NODE_ENV'] ?? 'dev';
  const prefix = `/kambriq/${env}/api/`;

  console.log(`\n[bootstrap] reading identities from SSM ${prefix}`);
  const admins = collectAdmins(await readParameters(prefix));
  console.log(`[bootstrap] ${admins.length} account(s) declared\n`);

  const role = await core.role.findUnique({ where: { code: RoleCode.ADMIN_GLOBAL } });
  if (!role) {
    throw new BootstrapError(
      `Role ${RoleCode.ADMIN_GLOBAL} does not exist in this database. Run the ` +
        'migrations and the role seed first - creating the accounts without the ' +
        'role would leave two administrators who cannot administer anything.',
    );
  }

  let created = 0;
  let unchanged = 0;

  for (const admin of admins) {
    const email = admin.EMAIL.toLowerCase();
    const existing = await core.user.findUnique({ where: { email } });

    if (existing) {
      // Deliberately not an update. Re-running must not reset a password the
      // holder has since chosen, nor undo emailVerified. The row exists;
      // that is the whole contract.
      const holdsRole = await core.userRole.findFirst({
        where: { userId: existing.id, roleId: role.id },
      });
      if (!holdsRole) {
        await core.userRole.create({
          data: { userId: existing.id, roleId: role.id, grantedBy: 'bootstrap' },
        });
        console.log(`[bootstrap] ${email} existed without ${RoleCode.ADMIN_GLOBAL} - role granted`);
      } else {
        console.log(`[bootstrap] ${email} already present - no change`);
        unchanged++;
      }
      continue;
    }

    await core.user.create({
      data: {
        email,
        passwordHash: NO_PASSWORD,
        firstName: admin.FIRST_NAME,
        lastName: admin.LAST_NAME,
        // One phone column. An account with two numbers loses one of them here.
        phone: admin.PHONE,
        emailVerified: false,
        preferredLanguage: 'fr',
        profile: {
          create: { address: admin.ADDRESS, city: admin.CITY, country: admin.COUNTRY },
        },
        userRoles: { create: { roleId: role.id, grantedBy: 'bootstrap' } },
      },
    });
    created++;
    console.log(`[bootstrap] ${email} created, ${RoleCode.ADMIN_GLOBAL} granted, no password set`);
  }

  // Counted back from the database rather than from the loop: the loop knows
  // what it tried to do, the database knows what happened.
  const holders = await core.userRole.count({ where: { roleId: role.id } });
  console.log(
    `\n[bootstrap] done - ${created} created, ${unchanged} unchanged, ` +
      `${holders} ${RoleCode.ADMIN_GLOBAL} holder(s) in total`,
  );
  if (created > 0) {
    console.log(
      '[bootstrap] the new accounts have no password. Each holder sets one via ' +
        'POST /auth/forgot-password, which also verifies their address.',
    );
  }
}

main()
  .catch((err) => {
    console.error(err instanceof BootstrapError ? `\n[bootstrap] ABORTED\n${err.message}\n` : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await core.$disconnect();
    await pool.end();
  });
