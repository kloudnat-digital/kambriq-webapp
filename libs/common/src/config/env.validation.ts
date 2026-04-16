import { z } from 'zod';

export const envSchema = z.object({
  // ----- App -----
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000'),
  API_PREFIX: z.string().default('api/v1'),

  // ----- Database URLS (One Per Module) -----
  DATABASE_URL_CORE: z.string().min(1, 'DATABASE_URL_CORE is required'),
  DATABASE_URL_KBS: z.string().optional(),
  DATABASE_URL_KAMNET: z.string().optional(),
  DATABASE_URL_LANDS: z.string().optional(),
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
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_REGION: z.string().default('eu-west-3'),

  // ----- SES Contact Lists -----
  AWS_SES_CONTACT_LIST_NAME: z.string().default('kambriq-newsletter'),
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
