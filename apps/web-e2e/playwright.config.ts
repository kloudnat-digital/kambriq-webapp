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

export default defineConfig({
  ...nxE2EPreset(__filename, { testDir: './src' }),

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

    // Firefox and WebKit run in CI only (set CI=true to enable)
    ...(process.env['CI']
      ? [
          { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
          { name: 'webkit', use: { ...devices['Desktop Safari'] } },
        ]
      : []),
  ],
});
