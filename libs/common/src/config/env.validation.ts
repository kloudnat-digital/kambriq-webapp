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

  // ----- AWS -----
  // AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY are deliberately absent. Nothing
  // reads them: SES and S3 both resolve the ECS task role through the default
  // credential provider chain. Declaring them invited the gates that disabled
  // both subsystems on Fargate for months.
  // eu-central-1 is where every Kambriq resource lives: RDS, ECS, SES, SSM.
  // eu-west-3 was a copy-paste default that never matched any deployment.
  AWS_REGION: z.string().default('eu-central-1'),

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
