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

  // Redis authentication is optional to support both local unauthenticated development
  // clusters and AWS ElastiCache clusters that require AUTH and TLS.
  REDIS_PASSWORD: z.string().optional(),

  // Represents a boolean as a string (e.g., 'true' or 'false').
  REDIS_TLS: z.string().default('false'),

  // ----- AWS -----
  // AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are omitted to rely on the ECS task role
  // via the default credential provider chain.
  AWS_REGION: z.string().default('eu-central-1'),

  // ----- Bootstrap -----
  // The SSM parameter store path for bootstrap administrative identities.
  // It is optional for the API runtime but required by the standalone bootstrap script.
  BOOTSTRAP_SSM_PREFIX: z.string().optional(),

  // ----- Payment channel details -----
  // The SSM path holding the bank, mobile money, and notary details used in
  // payment instructions. Fetched at runtime to allow dynamic updates.
  PAYMENT_CHANNELS_SSM_PREFIX: z.string().optional(),

  // Controls how payment channels are resolved. When set to 'ssm', PAYMENT_CHANNELS_SSM_PREFIX
  // is required. Disabling it is intended primarily for local development and CI.
  PAYMENT_CHANNELS_TRANSPORT: z.enum(['ssm', 'disabled']).default('ssm'),

  // The duration (in days) a payment remains valid after creation before it expires.
  PAYMENT_VALIDITY_DAYS: z.coerce.number().int().positive().default(30),

  /**
   * Comma-separated list of days before the payment deadline when reminders should be sent.
   * Defined as a string to allow configuration updates without deployments.
   */
  PAYMENT_REMINDER_OFFSETS_DAYS: z.string().default('7,1'),

  /** The cron pattern for executing the dunning sweep. Defaults to daily at 06:00 UTC. */
  DUNNING_SWEEP_CRON: z.string().default('0 6 * * *'),

  // ----- Contact Settings -----
  // The destination email address for inbound contact requests and daily digests.
  // Provided via SSM in production environments.
  CONTACT_INBOX_EMAIL: z.email().optional(),

  /** The cron schedule for the daily contact digest. Defaults to 07:00 UTC. */
  CONTACT_DIGEST_CRON: z.string().default('0 7 * * *'),

  /**
   * The language used for back-office notifications, independent of the user's locale.
   */
  CONTACT_BACKOFFICE_LOCALE: z.enum(['en', 'fr']).default('fr'),

  // ----- SES Contact Lists -----
  // The name of the AWS SES contact list.
  AWS_SES_CONTACT_LIST_NAME: z.string().default('kambriq-newsletter'),

  // ----- Storage transport -----
  // Selects the storage backend. Setting this to 'disabled' will cause storage operations to throw.
  STORAGE_TRANSPORT: z.enum(['s3', 'disabled']).default('s3'),

  // ----- Email transport -----
  // Defines the email delivery mechanism. Use 'console' for local development logging.
  EMAIL_TRANSPORT: z.enum(['ses', 'console']).default('ses'),

  // ----- S3 Bucket configuration -----
  // Required when STORAGE_TRANSPORT is 's3'.
  AWS_S3_BUCKET: z.string().default(''),
  AWS_S3_REGION: z.string().default(''),

  // ----- Email sender -----
  // Read by EmailProcessor when it hands the message to SES.
  EMAIL_FROM: z.email().default('noreply@kambriq.com'),
  EMAIL_FROM_NAME: z.string().min(1).default('KAMBRIQ Team'),

  // ----- Frontend origin -----
  // The base URL used for constructing links in transactional emails.
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
