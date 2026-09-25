/**
 * Bootstraps super-admin accounts required in all environments, including production.
 *
 * Execution:
 *   pnpm run db:bootstrap
 *
 * Behavior and requirements:
 * - Bootstrapped accounts are created without a password. The account holder sets
 *   their password via the password reset flow, which also verifies the email.
 * - Identity data (email, name, phone, etc.) is securely fetched from AWS SSM under
 *   `$BOOTSTRAP_SSM_PREFIX`. Expected parameters: `EMAIL`, `FIRST_NAME`, `LAST_NAME`,
 *   `PHONE`, `CITY`, `COUNTRY`.
 * - All parameters are mandatory. Missing parameters abort execution prior to writes.
 * - Idempotency: Execution relies on email as a primary key. Repeated executions with
 *   unchanged SSM parameters perform no write operations. Passwords, `emailVerified`,
 *   and `isActive` states are never modified to avoid disrupting existing users.
 * - Post-execution verification ensures the created roles exist and are correctly assigned.
 */

/* eslint-disable @nx/enforce-module-boundaries */
import 'dotenv/config';
import { GetParametersByPathCommand, SSMClient } from '@aws-sdk/client-ssm';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient as CoreClient } from '../libs/common/src/prisma/core-client/client';
import { SUPER_ADMIN_ROLE } from '../libs/common/src/types/role-hierarchy';
import { planBootstrap } from '../libs/common/src/bootstrap/bootstrap-plan';
import { issueVerificationToken } from '../libs/common/src/auth/verification-token';
import { VerificationTokenType } from '../libs/common/src/constants/core';
import { QUEUES } from '../libs/common/src/constants/queue';
import { redisConnectionOptions } from '../libs/common/src/redis/redis-connection';
import { EmailService } from '../libs/common/src/email/email.service';
import { Queue } from 'bullmq';

/**
 * Target account slot identifiers. The fixed array ensures both accounts are consistently expected,
 * preventing silent failures if one configuration slot is missing from the parameter store.
 */
const ACCOUNT_SLOTS = ['admin1', 'admin2'] as const;

const FIELDS = ['EMAIL', 'FIRST_NAME', 'LAST_NAME', 'PHONE', 'CITY', 'COUNTRY'] as const;

type Field = (typeof FIELDS)[number];
type Identity = Record<Field, string>;

/** Records the origin of the role grant on the user role. */
const GRANTED_BY = 'bootstrap';

const REGION = process.env['AWS_REGION'] ?? 'eu-central-1';

// ---------------------------------------------------------------------------
// Parameters
// ---------------------------------------------------------------------------

/**
 * Retrieves the required SSM parameters for the specified prefix.
 * Utilizes `GetParametersByPath` to fetch parameters comprehensively and effectively batch error reporting.
 */
async function readIdentities(prefix: string): Promise<Record<string, Identity>> {
  const ssm = new SSMClient({ region: REGION });
  const found = new Map<string, string>();

  let nextToken: string | undefined;
  do {
    const page = await ssm.send(
      new GetParametersByPathCommand({
        Path: prefix,
        Recursive: true,
        WithDecryption: true,
        NextToken: nextToken,
      }),
    );
    for (const p of page.Parameters ?? []) {
      if (p.Name && p.Value !== undefined) found.set(p.Name, p.Value);
    }
    nextToken = page.NextToken;
  } while (nextToken);

  const missing: string[] = [];
  const blank: string[] = [];
  const identities: Record<string, Identity> = {};

  for (const slot of ACCOUNT_SLOTS) {
    const identity: Partial<Identity> = {};
    for (const field of FIELDS) {
      const name = `${prefix}/${slot}/${field}`;
      const value = found.get(name);
      if (value === undefined) missing.push(name);
      else if (value.trim() === '') blank.push(name);
      else identity[field] = value.trim();
    }
    if (Object.keys(identity).length === FIELDS.length) {
      identities[slot] = identity as Identity;
    }
  }

  if (missing.length > 0 || blank.length > 0) {
    // Distinguish between missing and blank parameters for accurate error reporting.
    const lines = [
      `Bootstrap aborted. ${missing.length + blank.length} parameter(s) unusable under ${prefix}:`,
      ...missing.map((n) => `  MISSING  ${n}`),
      ...blank.map((n) => `  EMPTY    ${n}`),
      '',
      'Nothing was written. Create or fill every parameter above, then re-run:',
      `  aws ssm put-parameter --region ${REGION} --type String --overwrite \\`,
      `    --name "${prefix}/admin1/EMAIL" --value "..."`,
    ];
    throw new Error(lines.join('\n'));
  }

  return identities;
}

// ---------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------

const core = new CoreClient({
  adapter: new PrismaPg(new Pool({ connectionString: process.env['DATABASE_URL_CORE'] })),
});

type Outcome = 'created' | 'updated' | 'unchanged';

/**
 * The fields managed by this script and reconciled with the parameter store.
 * `passwordHash`, `emailVerified`, and `isActive` are excluded to prevent overwriting user-configured values.
 */
function userFieldsFrom(identity: Identity) {
  return {
    firstName: identity.FIRST_NAME,
    lastName: identity.LAST_NAME,
    // The `User` model supports a single phone number. Additional numbers are discarded
    // to maintain a valid, dialable format for downstream services (e.g., SMS, WhatsApp).
    phone: identity.PHONE,
  };
}

function profileFieldsFrom(identity: Identity) {
  return { city: identity.CITY, country: identity.COUNTRY };
}

async function bootstrapAccount(slot: string, identity: Identity): Promise<Outcome> {
  const email = identity.EMAIL.trim().toLowerCase();
  const user = userFieldsFrom(identity);
  const profile = profileFieldsFrom(identity);

  const existing = await core.user.findUnique({
    where: { email },
    include: { profile: true, userRoles: { include: { role: true } } },
  });

  /** Determines the bootstrap action via `planBootstrap`. */
  const plan = planBootstrap(
    existing && {
      firstName: existing.firstName,
      lastName: existing.lastName,
      phone: existing.phone,
      profile: existing.profile && {
        city: existing.profile.city,
        country: existing.profile.country,
      },
      roleCodes: existing.userRoles.map((ur) => ur.role.code),
    },
    { ...user, ...profile },
  );

  if (plan.action === 'create') {
    const created = await core.user.create({
      data: {
        email,
        ...user,
        // The password is unset by default. The user establishes their password and
        // verifies their email via the standard password reset flow.
        passwordHash: null,
        emailVerified: false,
        preferredLanguage: 'fr',
        profile: { create: profile },
      },
    });

    if (plan.grantRole) await grantSuperAdmin(created.id);
    await sendVerificationEmail(created.id, email, user.firstName);
    console.log(
      `  [${slot}] created  ${email}  role=${SUPER_ADMIN_ROLE} grantedBy=${GRANTED_BY} verification-email=queued`,
    );
    return 'created';
  }

  if (!existing) throw new Error(`plan said ${plan.action} but no row was read for ${email}`);

  /**
   * Resend the verification email on subsequent runs only if the user remains
   * unverified and possesses no active reset link. This ensures the account
   * holder eventually receives a valid entry path without spamming.
   */
  if (await needsVerificationEmail(existing.id, existing.emailVerified)) {
    await sendVerificationEmail(existing.id, email, user.firstName);
    // Says what it did, not what the plan called it. An "unchanged" line next to
    // a queued email is two statements that contradict each other.
    console.log(`  [${slot}] re-sent  ${email}  verification-email=queued`);
    if (plan.action === 'unchanged') return 'updated';
  }

  if (plan.action === 'unchanged') {
    console.log(`  [${slot}] unchanged ${email}  (no write issued)`);
    return 'unchanged';
  }

  const identityChanged = plan.changedFields.filter((f) => !f.startsWith('role:'));
  if (identityChanged.length > 0) {
    await core.user.update({
      where: { id: existing.id },
      data: { ...user, profile: { upsert: { create: profile, update: profile } } },
    });
  }

  if (plan.grantRole) await grantSuperAdmin(existing.id);

  console.log(`  [${slot}] updated  ${email}  fields=${plan.changedFields.join(',')}`);
  return 'updated';
}

/**
 * The same `EmailService` the API uses, constructed by hand.
 *
 * Not a second sender. `EmailService` is a Nest `@Injectable()` whose
 * constructor takes exactly **one** argument - a BullMQ `Queue` - so it can be
 * instantiated directly outside the Nest container. From `send()` onward this is
 * byte-for-byte the path a registration takes: the same validations
 * (`assertNoUnresolvedArgs`, `assertNoIdentifiersInNames`), the same job name,
 * the same queue, and the same processor rendering the same template.
 *
 * **A direct SES call here would have been the mistake.** Two ways of sending
 * one mail is how the two drift, and the drift surfaces months later as a
 * template fixed on one side only - which is a defect this repository already
 * has an entry for, arriving from the other direction.
 *
 * The job is consumed by the API service, not by this task: this process
 * enqueues and exits. **Enqueued is not sent**, which is why the proof for this
 * reads the destination mailbox rather than this script's output.
 */
let emailQueue: Queue | null = null;

function emailService(): EmailService {
  if (!emailQueue) {
    if (!process.env['REDIS_HOST']) {
      throw new Error(
        'REDIS_HOST is not set, so no email can be enqueued. Nothing further will be written.',
      );
    }
    // D20 - the same connection helper the API uses, so this task speaks TLS
    // and sends the AUTH token exactly when the API does. It runs as a one-off
    // ECS task on every deploy, on the API's own task definition, so it
    // receives REDIS_PASSWORD and REDIS_TLS without any further wiring - and if
    // it were left on a plain connection it would be the one client that breaks
    // when the cluster starts requiring them.
    const connection = redisConnectionOptions((key) => process.env[key]);
    emailQueue = new Queue(QUEUES.NOTIFICATIONS, { connection });
  }
  return new EmailService(emailQueue);
}

/**
 * Enqueues the verification email a registration would send.
 *
 * Same template (`verification`), same token type, same URL shape. The token is
 * minted by `issueVerificationToken` in `libs/common` - the function
 * `AuthService.createVerificationToken` now delegates to - so there is one
 * implementation and two callers rather than two implementations.
 */
async function needsVerificationEmail(userId: string, emailVerified: boolean): Promise<boolean> {
  // Already verified: the holder has been through the flow. Nothing to send, on
  // this run or any future one.
  if (emailVerified) return false;

  // Unverified, but a live link is already in their inbox. Sending another would
  // invalidate the one they may be about to click - `issueVerificationToken`
  // marks previous unused tokens used - so the second email would break the
  // first. Re-sending only once the outstanding link has expired keeps a deploy
  // from quietly turning a working link into a dead one.
  const live = await core.verificationToken.count({
    where: {
      userId,
      type: VerificationTokenType.EMAIL_VERIFICATION,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
  });
  return live === 0;
}

async function sendVerificationEmail(
  userId: string,
  email: string,
  firstName: string,
): Promise<void> {
  const frontendUrl = process.env['FRONTEND_URL']?.replace(/\/+$/, '');
  if (!frontendUrl) {
    throw new Error(
      'FRONTEND_URL is not set, so any verification link would be dead. Refusing to send one.',
    );
  }

  const token = await issueVerificationToken(
    core,
    userId,
    VerificationTokenType.EMAIL_VERIFICATION,
  );

  await emailService().send({
    to: email,
    template: 'verification',
    lang: 'fr',
    args: { firstName, verificationUrl: `${frontendUrl}/verify-email?token=${token}` },
  });
}

async function grantSuperAdmin(userId: string): Promise<void> {
  const role = await core.role.findUnique({ where: { code: SUPER_ADMIN_ROLE } });
  if (!role) {
    // The role row is created by the migrations+seed path. Its absence means the
    // database is not in a state this script can safely write to, and creating
    // the row here would paper over that.
    throw new Error(
      `Role ${SUPER_ADMIN_ROLE} has no row in the core database. ` +
        `Run the migrations and the seed first; this script does not create roles.`,
    );
  }
  await core.userRole.upsert({
    where: { userId_roleId: { userId, roleId: role.id } },
    create: { userId, roleId: role.id, grantedBy: GRANTED_BY },
    update: {},
  });
}

/**
 * Reads back what the run claims to have done.
 *
 * Every assertion here has been true of code that did not work: the account
 * exists but holds no role, the role is there but `grantedBy` is null, the
 * password was filled in by a copy-paste. A postcondition that is announced
 * rather than checked is the defect this repository has met most often.
 *
 * The password assertion is scoped to accounts **this run created**. Written
 * unconditionally it passed the first two runs and would have failed the third -
 * the one after somebody actually used their reset link. A guard that breaks on
 * the outcome it exists to protect is worse than no guard, because it breaks
 * later, in an environment, on a day when nothing else changed.
 */
async function verify(created: Set<string>, emails: string[]): Promise<void> {
  const problems: string[] = [];

  for (const email of emails) {
    const user = await core.user.findUnique({
      where: { email },
      include: { profile: true, userRoles: { include: { role: true } } },
    });

    if (!user) {
      problems.push(`${email}: no row after the run`);
      continue;
    }
    const grant = user.userRoles.find((ur) => ur.role.code === SUPER_ADMIN_ROLE);

    /**
     * The postcondition is that the account **holds** the role. Not who last
     * granted it.
     *
     * `grantedBy` used to be asserted unconditionally, and it failed a deploy.
     * The role had been revoked by a mis-aimed test and restored through the
     * ordinary admin route, which records the acting administrator's id -
     * correctly; that is what the column is for. The next bootstrap run refused
     * the whole environment because the provenance was not the string
     * `bootstrap`, and would have refused every run for ever after.
     *
     * **A postcondition asserted the history of a fact rather than the fact.**
     * The account was in exactly the state the bootstrap exists to produce, and
     * the check called it a failure - so the remediation for a missing role was
     * also the thing that permanently broke the mechanism that maintains it.
     *
     * `grantedBy` is still checked, but only for a grant **this run wrote**,
     * where it is an assertion about this run's own behaviour rather than about
     * everything that has happened to the row since.
     */
    if (!grant) {
      problems.push(`${email}: does not hold ${SUPER_ADMIN_ROLE}`);
    } else if (created.has(email) && grant.grantedBy !== GRANTED_BY) {
      problems.push(
        `${email}: this run created the account but grantedBy is ` +
          `${String(grant.grantedBy)}, expected ${GRANTED_BY}`,
      );
    }
    // Only for an account this run created. On any later run the holder may
    // have set their own password through the reset flow, and asserting the
    // column is still null would turn a working account into a failed
    // bootstrap - the guard breaking on exactly the outcome it wants.
    if (created.has(email) && user.passwordHash !== null) {
      problems.push(`${email}: passwordHash is not null on a freshly created account`);
    }
    if (!user.profile) problems.push(`${email}: has no profile row`);
  }

  if (problems.length > 0) {
    throw new Error(
      ['Bootstrap postcondition failed:', ...problems.map((p) => `  ${p}`)].join('\n'),
    );
  }

  console.log(`  postcondition verified for ${emails.length} account(s)`);
}

// ---------------------------------------------------------------------------

async function main() {
  console.log('Kambriq super-admin bootstrap starting');

  const prefix = process.env['BOOTSTRAP_SSM_PREFIX']?.replace(/\/+$/, '');
  if (!prefix) {
    throw new Error(
      'BOOTSTRAP_SSM_PREFIX is not set. Nothing was read and nothing was written.\n' +
        '  Expected something like /kambriq/dev/api/bootstrap',
    );
  }

  console.log(`  region ${REGION}, prefix ${prefix}, slots ${ACCOUNT_SLOTS.join(', ')}`);

  const identities = await readIdentities(prefix);

  const outcomes: Outcome[] = [];
  const created = new Set<string>();
  // Sequential on purpose. Two accounts, and `await` inside a `for` is the only
  // shape where a failure on the first stops the second from running against a
  // database the first has already half-changed.
  for (const slot of ACCOUNT_SLOTS) {
    const email = identities[slot].EMAIL.trim().toLowerCase();
    const outcome = await bootstrapAccount(slot, identities[slot]);
    if (outcome === 'created') created.add(email);
    outcomes.push(outcome);
  }

  await verify(
    created,
    ACCOUNT_SLOTS.map((s) => identities[s].EMAIL.trim().toLowerCase()),
  );

  const tally = (o: Outcome) => outcomes.filter((x) => x === o).length;
  console.log(
    `Kambriq super-admin bootstrap complete: ` +
      `${tally('created')} created, ${tally('updated')} updated, ${tally('unchanged')} unchanged`,
  );
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    // Non-zero, and the message above it. A bootstrap that fails quietly leaves
    // an environment with no administrator and a green deployment.
    process.exitCode = 1;
  })
  .finally(async () => {
    // The queue holds an open ioredis connection; without closing it the task
    // never exits and the deploy step waits on a task that has finished its work.
    if (emailQueue) await emailQueue.close();
    await core.$disconnect();
  });
