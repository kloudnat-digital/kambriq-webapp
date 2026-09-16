/**
 * Kambriq - super-admin bootstrap
 *
 * Run via:  pnpm run db:bootstrap
 *
 * Creates the real administrator accounts that must exist in **every**
 * environment, including production. They have no password: each holder sets
 * their own through the ordinary reset flow, which is also what marks the
 * address verified (see `resetPassword` in `auth.service.ts`).
 *
 * ---------------------------------------------------------------------------
 * Why this is not in `prisma/seed.ts`
 * ---------------------------------------------------------------------------
 * The seed is test data. It is wiped by `db:reset`, it hands every account the
 * same password, and it exists to make a journey runnable. These two accounts
 * are real people who must survive every reset and exist in prd. Putting them in
 * the seed would mean either shipping fixtures to production or losing the
 * administrators every time somebody rebuilds dev.
 *
 * ---------------------------------------------------------------------------
 * Why the identities are not in this file
 * ---------------------------------------------------------------------------
 * They are a home address and two mobile numbers. A git repository is a poor
 * place for personal data and a worse one once the repository is shared, and
 * "where does personal data live" is a question that gets asked of this project
 * by name. So the file holds the **shape** - which parameters are read, and what
 * is done with them - and SSM holds the values.
 *
 * It also makes a typo an operation rather than a deployment: correcting an
 * address is `aws ssm put-parameter --overwrite` plus a re-run, not a commit, a
 * review, a build and a release.
 *
 * Parameters read, one per field, under `$BOOTSTRAP_SSM_PREFIX`:
 *
 *   <prefix>/<slot>/EMAIL
 *   <prefix>/<slot>/FIRST_NAME
 *   <prefix>/<slot>/LAST_NAME
 *   <prefix>/<slot>/PHONE
 *   <prefix>/<slot>/CITY
 *   <prefix>/<slot>/COUNTRY
 *
 * for each slot in ACCOUNT_SLOTS. The prefix sits under `/kambriq/{env}/api/`,
 * which the API task role already holds `ssm:GetParameter` on - no IAM change.
 *
 * **Every parameter is required.** A missing one aborts the whole run before
 * anything is written, and the error names every parameter that was missing
 * rather than the first. Skipping an account because its data was absent would
 * be a mechanism reporting success by saying nothing, and the thing it would
 * silently skip is an administrator.
 *
 * ---------------------------------------------------------------------------
 * Idempotence
 * ---------------------------------------------------------------------------
 * Keyed on email. A second run with unchanged parameters performs **no writes at
 * all** - not `update: {}`, which still touches `updatedAt`, but a comparison
 * that finds nothing to change and says so. Re-running never touches
 * `passwordHash`, `emailVerified` or `isActive`: by the second run the holder
 * may well have set a password, and reconciling that back to the parameter store
 * would lock them out of their own account.
 *
 * The run ends by re-reading what it wrote and checking it, rather than
 * announcing a postcondition it did not verify.
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
 * The two accounts, as opaque slot names.
 *
 * The count is here rather than discovered from SSM on purpose. A run that reads
 * whatever happens to be in the parameter store cannot tell "one account was
 * never configured" from "there is one account", which is the silent skip this
 * script exists not to do.
 */
const ACCOUNT_SLOTS = ['admin1', 'admin2'] as const;

const FIELDS = ['EMAIL', 'FIRST_NAME', 'LAST_NAME', 'PHONE', 'CITY', 'COUNTRY'] as const;

type Field = (typeof FIELDS)[number];
type Identity = Record<Field, string>;

/** Written into `UserRole.grantedBy`, so the origin of the grant is on the row. */
const GRANTED_BY = 'bootstrap';

const REGION = process.env['AWS_REGION'] ?? 'eu-central-1';

// ---------------------------------------------------------------------------
// Parameters
// ---------------------------------------------------------------------------

/**
 * Fetches the whole prefix in one call, then checks what came back against what
 * is required.
 *
 * `GetParametersByPath` rather than one `GetParameter` per field: a partial
 * answer is the point. It lets the run report every missing parameter at once,
 * instead of failing on the first, being fixed, and failing on the second.
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
    // A blank parameter is listed separately because it is a different mistake:
    // the parameter was created and never filled in, which reads as present to
    // anything that only checks existence.
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
 * The fields this script owns and will reconcile with the parameter store.
 *
 * `passwordHash`, `emailVerified` and `isActive` are deliberately absent: they
 * belong to the account holder from the moment they first use the reset link,
 * and a bootstrap that reset them would undo a real person's password on the
 * next deployment.
 */
function userFieldsFrom(identity: Identity) {
  return {
    firstName: identity.FIRST_NAME,
    lastName: identity.LAST_NAME,
    // One `phone` column on `User`. A second number has nowhere to go and is
    // NOT concatenated into this one: `+33 6 ... / +237 6 ...` is not a phone
    // number, and everything downstream that treats it as one - a WhatsApp
    // notification, an SMS, a click-to-call - would be handed something that
    // cannot be dialled while looking populated.
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

  /**
   * The decision is `planBootstrap`, in `libs/common`, where it is covered by
   * `bootstrap-plan.spec.ts` on every branch - including the one that grants the
   * role to an account that already existed. This function does the writing; it
   * does not decide any more.
   */
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
        // No password. The holder sets one through POST /auth/forgot-password
        // followed by POST /auth/reset-password, which is also what flips
        // emailVerified to true.
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
   * The one thing a re-run still does, and the property it costs.
   *
   * H2 proved that a second run issues **no write at all**. That is no longer
   * unconditionally true, and the change is deliberate: an account that was
   * bootstrapped and never verified has nothing in its inbox, and a bootstrap
   * that leaves an administrator with no way in has not finished its job. So a
   * re-run re-sends - but only when the holder is unverified **and** has no live
   * link outstanding.
   *
   * Once both accounts are verified this is permanently false and a re-run is a
   * no-op again. It is self-limiting rather than every-deploy.
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
