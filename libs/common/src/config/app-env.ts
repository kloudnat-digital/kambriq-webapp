/**
 * A48 - which environment this is, and the behaviour that follows from it.
 *
 * `APP_ENV` says where the code runs; `NODE_ENV` says how it was built, and the
 * dev image runs `NODE_ENV=development` exactly like a laptop. Every decision
 * below used to be taken on `NODE_ENV`, so dev logged every SQL statement and
 * logged at debug level, pretty-printed. They now read `APP_ENV`, and only an
 * explicit `local` turns them on: `APP_ENV` is set nowhere on a deployed
 * environment today, and an environment that has not declared itself gets the
 * quiet behaviour - the safe direction to be wrong in. `pnpm start` declares
 * `local` (A43). `no-node-env-gates.spec.ts` refuses a new gate on `NODE_ENV`.
 */
export const LOCAL_APP_ENV = 'local';

/** `APP_ENV`, normalised; `null` when nothing is declared. */
export const appEnvironment = (env: NodeJS.ProcessEnv = process.env): string | null =>
  env['APP_ENV']?.trim().toLowerCase() || null;

export const isLocalEnvironment = (env: NodeJS.ProcessEnv = process.env): boolean =>
  appEnvironment(env) === LOCAL_APP_ENV;

type PrismaLogLevel = 'query' | 'info' | 'warn' | 'error';

/**
 * Prisma's log levels. `query` prints every SQL statement: on dev that was half
 * of the API's log volume, and it described the schema to anybody who can read
 * the logs. Local only.
 */
export const prismaLogLevels = (env: NodeJS.ProcessEnv = process.env): PrismaLogLevel[] =>
  isLocalEnvironment(env) ? ['query', 'error', 'warn', 'info'] : ['error'];

/** The API's log level: debug on a developer's machine, info everywhere else. */
export const apiLogLevel = (env: NodeJS.ProcessEnv = process.env): 'debug' | 'info' =>
  isLocalEnvironment(env) ? 'debug' : 'info';

/** Pretty-printed logs are for a terminal; a deployed log stays one JSON line per event. */
export const prettyLogs = (env: NodeJS.ProcessEnv = process.env): boolean =>
  isLocalEnvironment(env);
