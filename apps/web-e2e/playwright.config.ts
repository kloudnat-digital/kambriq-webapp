import { defineConfig, devices } from '@playwright/test';
import { nxE2EPreset } from '@nx/playwright/preset';
import { workspaceRoot } from '@nx/devkit';

// In CI, point to the deployed URL via BASE_URL. Locally, default to port 3001.
const baseURL = process.env['BASE_URL'] || 'http://localhost:3001';

// Only start the local dev server when we are NOT pointing at a remote deployment.
// When BASE_URL is set (CI post-deploy run), the server is already live.
const webServer = process.env['BASE_URL']
  ? undefined
  : {
      command: 'npx nx run web:dev',
      url: 'http://localhost:3001',
      reuseExistingServer: !process.env['CI'],
      cwd: workspaceRoot,
    };

// Where Playwright writes its report and its per-test artifacts.
//
// nxE2EPreset derives these paths from the workspace layout and from whether the
// repo uses the TS solution setup, so the effective location is neither visible
// in this file nor stable across an nx upgrade. CI has to name the path in its
// upload-artifact step, so it is pinned here rather than inferred.
// Keep in sync with .github/workflows/ci.yml.
const artifactRoot = '../../dist/.playwright/apps/web-e2e';

export default defineConfig({
  ...nxE2EPreset(__filename, { testDir: './src' }),

  // Same values the preset resolves to today, stated explicitly so they cannot drift.
  outputDir: `${artifactRoot}/test-output`,
  reporter: [
    [
      'html',
      {
        outputFolder: `${artifactRoot}/playwright-report`,
        // Never try to open a browser on a CI runner.
        open: process.env['CI'] ? 'never' : 'on-failure',
      },
    ],
    // Readable progress in the CI log, alongside the HTML report.
    ['list'],
  ],

  // Global timeout for each test
  timeout: 30_000,

  // Retry once on CI to handle transient flakiness
  retries: process.env['CI'] ? 1 : 0,

  // Run tests in parallel (disabled locally for easier debugging)
  workers: process.env['CI'] ? 2 : 1,

  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  ...(webServer ? { webServer } : {}),

  projects: [
    // Chromium (always on, local + CI)
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    // Firefox runs in CI only (set CI=true to enable).
    //
    // WebKit is NOT in this matrix, deliberately, and that means Safari is not
    // tested (A33, register). Its successful-login test failed on 4 of the 8
    // develop runs that ran E2E since A28, and a fifth passed only on its retry -
    // each failure the same way: the click sent no request at all,
    // so it was neither a slow server nor a wait that was too short. The cause
    // was not established in the time bounded for it - 20 local WebKit runs all
    // passed - and a test that lies every other run and is retried into green
    // claims coverage it does not give. Safari is the default browser on the
    // iPhone the diaspora uses, so putting it back is owed, with the cause.
    ...(process.env['CI'] ? [{ name: 'firefox', use: { ...devices['Desktop Firefox'] } }] : []),
  ],
});
