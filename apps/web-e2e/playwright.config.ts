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

    // Firefox and WebKit run in CI only (set CI=true to enable).
    //
    // WebKit is back (A33). Its sign-in test failed on 4 of 8 develop runs, the
    // click sending no request: the fields were controlled inputs, and text
    // typed before hydration was overwritten by React's empty state, so
    // validation refused. WebKit on the runner was the engine slow enough to
    // hydrate after the typing. The fields are uncontrolled now, and
    // `auth.spec.ts` holds the scripts to test that order in every engine.
    // Safari is the default browser on the iPhone the diaspora uses.
    ...(process.env['CI']
      ? [
          { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
          { name: 'webkit', use: { ...devices['Desktop Safari'] } },
        ]
      : []),
  ],
});
