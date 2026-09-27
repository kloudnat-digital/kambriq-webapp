import { isLocalEnvironment, LOCAL_APP_ENV } from './app-env';

/**
 * A43 - whether the API serves its own documentation (Swagger): only where
 * `APP_ENV=local` is declared. The rule, and why it reads `APP_ENV` rather than
 * `NODE_ENV`, is in `app-env.ts` (A48), which every such decision now shares.
 */
export { LOCAL_APP_ENV };

export const servesApiDocs = (env: NodeJS.ProcessEnv = process.env): boolean =>
  isLocalEnvironment(env);
