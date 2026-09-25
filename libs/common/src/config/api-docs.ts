/**
 * A43 - whether the API serves its own documentation (Swagger).
 *
 * Read from `APP_ENV`, which says which environment this is, never from
 * `NODE_ENV`, which says how the code was built: the dev API runs with
 * `NODE_ENV=development` exactly like a laptop, and served every route and
 * schema to anybody. `APP_ENV` is set nowhere today, on dev or locally, so its
 * absence cannot mean open. Only an explicit `local` does, and the local start
 * scripts declare it; an environment that forgot to declare itself serves
 * nothing, which is the safe direction to be wrong in. Same signal as
 * `isIndexableEnvironment`, the opposite default.
 */
export const LOCAL_APP_ENV = 'local';

export const servesApiDocs = (env: NodeJS.ProcessEnv = process.env): boolean =>
  env['APP_ENV']?.trim().toLowerCase() === LOCAL_APP_ENV;
