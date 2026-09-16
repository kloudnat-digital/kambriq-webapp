import { z } from 'zod';

export const envSchema = z.object({
  // ----- App -----
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000'),
  API_PREFIX: z.string().default('api/v1'),

  // ----- Database URLS (One Per Module) -----
  DATABASE_URL_CORE: z.string().min(1, 'DATABASE_URL_CORE is required'),
  DATABASE_URL_KBS: z.string().min(1, 'DATABASE_URL_KBS is required'),
  DATABASE_URL_KAMNET: z.string().min(1, 'DATABASE_URL_KAMNET is required'),
  DATABASE_URL_LANDS: z.string().min(1, 'DATABASE_URL_LANDS is required'),
  DATABASE_URL_VERIFY: z.string().optional(),
  DATABASE_URL_VALUATION: z.string().optional(),

  // ----- JWT -----
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_ACCESS_EXPIRATION: z.string().default('15m'),
  JWT_REFRESH_EXPIRATION: z.string().default('15d'),

  // ----- CORS -----
  CORS_ORIGINS: z.string().default('http://localhost:3000'),

  // ----- Rate Limiting -----
  THROTTLE_TTL: z.coerce.number().default(60000),
  THROTTLE_LIMIT: z.coerce.number().default(100),

  // ----- Redis -----
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),

  // D20. ElastiCache on dev has no password and no TLS today. AWS will not let
  // AUTH be enabled without in-transit encryption, so the application must be
  // able to speak both BEFORE the cluster demands them - these two are that
  // ability, and both default to off so the local compose Redis and the current
  // dev task keep working unchanged.
  //
  // Optional, not required: the ECS `secrets:` entry appears on the task only
  // once the infrastructure side lands, and an API that refuses to boot without
  // it would turn a one-step rollout into an outage.
  REDIS_PASSWORD: z.string().optional(),

  // A string, deliberately, and read case-insensitively by
  // `redisConnectionOptions`. `z.coerce.boolean()` would turn the string
  // "false" into `true`, which is exactly the value this needs to honour.
  REDIS_TLS: z.string().default('false'),

  // ----- AWS -----
  // AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY are deliberately absent. Nothing
  // reads them: SES and S3 both resolve the ECS task role through the default
  // credential provider chain. Declaring them invited the gates that disabled
  // both subsystems on Fargate for months.
  // eu-central-1 is where every Kambriq resource lives: RDS, ECS, SES, SSM.
  // eu-west-3 was a copy-paste default that never matched any deployment.
  AWS_REGION: z.string().default('eu-central-1'),

  // ----- Bootstrap (prisma/bootstrap-admins.ts) -----
  // The SSM path the super-admin bootstrap reads its two identities from, e.g.
  // '/kambriq/dev/api/bootstrap'. Sits under the prefix the API task role
  // already has ssm:GetParameter on (/kambriq/{env}/api/*), so no IAM change.
  //
  // Optional here and REQUIRED by the script, deliberately. The API never reads
  // it, so making the API refuse to start without it would be a false coupling;
  // the script refuses to run without it, and names it in the error. Declared
  // all the same, because a variable read by this repo and declared nowhere is
  // the defect env-vars-declared.spec.ts exists to catch.
  BOOTSTRAP_SSM_PREFIX: z.string().optional(),

  // ----- Payment channel details (G3) -----
  // The SSM path holding the bank, mobile money and notary details that payment
  // instructions carry, e.g. '/kambriq/dev/api/payment-channels'. Read through
  // the SDK at RUNTIME, deliberately: B3 established that a parameter rendered
  // into the task definition does not change until terraform is applied, and a
  // wrong account number must be correctable without a release.
  //
  // Optional here and required by PaymentChannelsService, which fails at
  // startup when it is set and incomplete, and refuses to build a message when
  // it is absent.
  PAYMENT_CHANNELS_SSM_PREFIX: z.string().optional(),

  // G10: 'ssm' reads the channel details, and the prefix above is then REQUIRED
  // - an absent one fails the boot, exactly as an empty parameter does.
  // 'disabled' runs without them, and every attempt to send instructions throws.
  //
  // The default is 'ssm' on purpose: an environment that forgets to configure
  // payments should not start, and that is the whole point of the pair. Local
  // development and CI set 'disabled' explicitly.
  PAYMENT_CHANNELS_TRANSPORT: z.enum(['ssm', 'disabled']).default('ssm'),

  // How long a payment stays valid once created, in days. G9.
  //
  // It reaches the client as "A regler avant le ..." in the instruction email,
  // and G6 will read it to decide what has gone stale.
  //
  // **30 is a choice, not a specification.** The design says a payment expires
  // "au-dela du delai de validite" and never says what the delay is. 30 days is
  // one month, which is the shape of an international transfer from the diaspora
  // - the client base the design names. It is declared here so that changing it
  // is one variable rather than a search, and it is written down as an open
  // question rather than left to look like a decided fact.
  PAYMENT_VALIDITY_DAYS: z.coerce.number().int().positive().default(30),

  /**
   * G6 - when reminders fire, in days before the deadline. Largest first is not
   * required; the service sorts.
   *
   * `7,1` because `PAYMENT_VALIDITY_DAYS` is 30 and an international transfer
   * takes days to clear: J-7 is the last moment a diaspora transfer can still
   * be started and land, J-1 the last moment anything can be said at all. Two
   * rather than one because a single reminder lost to a spam folder is the
   * seven-months-of-silent-SES failure with better manners; two rather than
   * five because the next step after two is a person, not a third email.
   *
   * A string rather than a number so the schedule can be changed without a
   * deploy, and so a local end-to-end run can compress it.
   */
  PAYMENT_REMINDER_OFFSETS_DAYS: z.string().default('7,1'),

  /** G6 - the dunning sweep's cron pattern. Daily at 06:00 UTC by default. */
  DUNNING_SWEEP_CRON: z.string().default('0 6 * * *'),

  // ----- L1: where an inbound contact request is announced -----
  //
  // The back-office mailbox that receives the "a request arrived" notification
  // and the daily digest. **No default, and deliberately not a real address in
  // this repository**: it is supplied per environment from SSM through the task
  // definition, like every other identity (see BOOTSTRAP_SSM_PREFIX).
  //
  // Optional here rather than required, and that is a decision with a cost.
  // Required would refuse to boot an API that cannot announce a lead - the
  // loudest option - and would also take the deployed API down on the next
  // release, before kambriq-infra has added the parameter, for a form that is
  // strictly better than the one it replaces. So: optional, and
  // `ContactService` logs at `error` and names this variable when it is absent,
  // rather than skipping quietly. The request is still persisted, and the daily
  // digest FAILS LOUDLY onto the queue's failed set rather than resolving.
  //
  // Registre: L1 follow-up, for infra to add /kambriq/{env}/api/CONTACT_INBOX_EMAIL.
  CONTACT_INBOX_EMAIL: z.email().optional(),

  /**
   * L2 - when the daily contact digest runs. 07:00 UTC, before the working day
   * in Douala (08:00 WAT), so an overnight request is on somebody's screen when
   * they sit down.
   */
  CONTACT_DIGEST_CRON: z.string().default('0 7 * * *'),

  /**
   * The language the back office is written to in. Its own setting rather than
   * the prospect's locale: the notification and the digest are read by the
   * team, and the acknowledgement is read by the prospect.
   */
  CONTACT_BACKOFFICE_LOCALE: z.enum(['en', 'fr']).default('fr'),

  // ----- SES Contact Lists -----
  // Must match the aws_sesv2_contact_list resource in kambriq-infra
  // (envs/dev/ses-newsletter.tf). Coupled by convention only.
  AWS_SES_CONTACT_LIST_NAME: z.string().default('kambriq-newsletter'),

  // ----- Storage transport -----
  // 's3' stores for real. 'disabled' turns storage off and makes every storage
  // call throw. Same rule as EMAIL_TRANSPORT: a degraded mode is a choice, not
  // an inference from missing configuration.
  STORAGE_TRANSPORT: z.enum(['s3', 'disabled']).default('s3'),

  // ----- Email transport -----
  // 'ses' sends for real. 'console' logs instead, and must be asked for
  // explicitly: the previous behaviour fell back to logging whenever AWS
  // credentials happened to be absent, which on Fargate is always, so the
  // application silently sent nothing for months while reporting success.
  EMAIL_TRANSPORT: z.enum(['ses', 'console']).default('ses'),

  // ----- S3 bucket -----
  // Read by StorageService, which throws its own error when STORAGE_TRANSPORT
  // is 's3' and either of these is empty. The empty default is deliberate: it
  // keeps STORAGE_TRANSPORT=disabled a valid configuration with no bucket at
  // all, and leaves the "which transport did you ask for" message where it is
  // rather than splitting it across two files.
  AWS_S3_BUCKET: z.string().default(''),
  AWS_S3_REGION: z.string().default(''),

  // ----- Email sender -----
  // Read by EmailProcessor when it hands the message to SES.
  EMAIL_FROM: z.email().default('noreply@kambriq.com'),
  EMAIL_FROM_NAME: z.string().min(1).default('KAMBRIQ Team'),

  // ----- Frontend origin -----
  // Every link in every transactional email is built from this: verification,
  // password reset, email change, client portal invite. A wrong value here is
  // invisible from every side except the recipient's - the send succeeds, SES
  // delivers, and the link points at nothing.
  //
  // Journey 1 cannot catch it. Its regex is
  // `/verify-email\?token=([0-9a-f]{64})/`, which matches the path and the
  // token and never the host, so `http://localhost:3001/verify-email?token=...`
  // passes the journey and fails the user. This is the same shape as A3: the
  // token was `[object Promise]` for months while every shallow check agreed.
  //
  // Validating the format is all this can honestly do. It is NOT a guarantee
  // the value is right for the environment - only the deployed task definition
  // in kambriq-infra knows that, and nothing in this repo can read it.
  FRONTEND_URL: z.url().default('http://localhost:3001'),
});

export type EnvConfig = z.infer<typeof envSchema>;

export const validateEnv = (config: Record<string, unknown>): EnvConfig => {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => {
        const path = issue.path.join('.');
        return `- ${path}: ${issue.message}`;
      })
      .join('\n');

    console.error('\n+==================================================+');
    console.error('|     ENVIRONMENT CONFIGURATION ERROR               |');
    console.error('+--------------------------------------------------+');
    console.error('|  The following variables are invalid:             |');
    console.error('+==================================================+\n');

    console.error(formatted);
    console.error('\n Check your .env file or container environment variables.\n');

    process.exit(1);
  }

  return result.data;
};
