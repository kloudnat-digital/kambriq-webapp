import { defineCliConfig } from 'sanity/cli';

/**
 * Configuration for the Sanity CLI: `sanity dev`, `sanity build`, `sanity deploy`.
 *
 * `studioHost` is read from the environment rather than written here, so the
 * first deploy is not an interactive prompt whose answer nobody can find
 * afterwards. Set it in `.env` from `.env.example`.
 *
 * `autoUpdates` lets Sanity serve a newer Studio runtime to the deployed app
 * without a redeploy from this repository. The schema and the configuration
 * below still come from here; only the framework moves.
 */
export default defineCliConfig({
  api: {
    projectId: process.env['SANITY_STUDIO_PROJECT_ID'],
    dataset: process.env['SANITY_STUDIO_DATASET'],
  },
  studioHost: process.env['SANITY_STUDIO_HOST'],
  deployment: { autoUpdates: true },
});
