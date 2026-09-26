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
  /**
   * Shared secret between web and API.
   * Authenticates client IP addresses forwarded by the web layer.
   * Unauthenticated calls are rate-limited against the web task itself.
   */
  WEB_CALLER_SECRET: z.string().optional(),

  // ----- Redis -----
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),

  // Optional Redis authentication. Supports unauthenticated local clusters and authenticated AWS ElastiCache clusters.
  REDIS_PASSWORD: z.string().optional(),

  // Boolean represented as string ('true' or 'false').
  REDIS_TLS: z.string().default('false'),

  // ----- AWS -----
  // AWS credentials omitted to force default credential provider chain (e.g., ECS task role).
  AWS_REGION: z.string().default('eu-central-1'),

  // ----- Bootstrap -----
  // SSM parameter store path for bootstrap administrative identities.
  // Optional in API runtime; required by standalone bootstrap script.
  BOOTSTRAP_SSM_PREFIX: z.string().optional(),

  // ----- Payment channel details -----
  // SSM path for payment channel details (bank, mobile money, notary). Fetched at runtime.
  PAYMENT_CHANNELS_SSM_PREFIX: z.string().optional(),

  // Payment channel resolution strategy. 'ssm' requires PAYMENT_CHANNELS_SSM_PREFIX. 'disabled' intended for local/CI.
  PAYMENT_CHANNELS_TRANSPORT: z.enum(['ssm', 'disabled']).default('ssm'),

  // Validity duration (in days) for a payment before expiration.
  PAYMENT_VALIDITY_DAYS: z.coerce.number().int().positive().default(30),

  /**
   * Comma-separated days before deadline to send payment reminders.
   * String format permits runtime configuration updates.
   */
  PAYMENT_REMINDER_OFFSETS_DAYS: z.string().default('7,1'),

  /** The cron pattern for executing the dunning sweep. Defaults to daily at 06:00 UTC. */
  DUNNING_SWEEP_CRON: z.string().default('0 6 * * *'),

  // ----- Contact Settings -----
  // Destination email for inbound contact requests and daily digests. Required:
  // without it every contact request is stored unannounced and the daily digest
  // fails at 07:00, so the process refuses to start instead.
  CONTACT_INBOX_EMAIL: z.email('CONTACT_INBOX_EMAIL is required (the contact inbox)'),

  /** The cron schedule for the daily contact digest. Defaults to 07:00 UTC. */
  CONTACT_DIGEST_CRON: z.string().default('0 7 * * *'),

  /** Back-office notification language, independent of user locale. */
  CONTACT_BACKOFFICE_LOCALE: z.enum(['en', 'fr']).default('fr'),

  // ----- SES Contact Lists -----
  // AWS SES contact list name.
  AWS_SES_CONTACT_LIST_NAME: z.string().default('kambriq-newsletter'),

  // ----- Storage transport -----
  // Storage backend selection. 'disabled' causes storage operations to throw.
  STORAGE_TRANSPORT: z.enum(['s3', 'disabled']).default('s3'),

  // ----- Email transport -----
  // Email delivery mechanism. 'console' routes to stdout for local development.
  EMAIL_TRANSPORT: z.enum(['ses', 'console']).default('ses'),

  // ----- S3 Bucket configuration -----
  // Required if STORAGE_TRANSPORT='s3'.
  AWS_S3_BUCKET: z.string().default(''),
  AWS_S3_REGION: z.string().default(''),

  // ----- Email sender -----
  // Sender identity injected by EmailProcessor for SES delivery.
  EMAIL_FROM: z.email().default('noreply@kambriq.com'),
  EMAIL_FROM_NAME: z.string().min(1).default('KAMBRIQ Team'),

  // ----- Frontend origin -----
  // Base URL for transactional email links.
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
