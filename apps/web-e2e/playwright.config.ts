import { defineConfig, devices } from '@playwright/test';
import { nxE2EPreset } from '@nx/playwright/preset';
import { workspaceRoot } from '@nx/devkit';

// In CI, point to the deployed URL. Locally, always port 3001 (3000 = backend).
const baseURL = process.env['BASE_URL'] || 'http://localhost:3001';

export default defineConfig({
  ...nxE2EPreset(__filename, { testDir: './src' }),

  use: {
    baseURL,
    // Capture a trace on the first retry of a failed test — viewable in Playwright UI
    trace: 'on-first-retry',
    // Screenshot only on failure
    screenshot: 'only-on-failure',
    // Video only on failure
    video: 'retain-on-failure',
  },

  /* Start the Next.js dev server before running tests.
   * reuseExistingServer: in local dev we reuse a running server if one exists.
   * In CI we always start fresh. */
  webServer: {
    command: 'npx nx run web:dev',
    url: 'http://localhost:3001',
    reuseExistingServer: !process.env['CI'],
    cwd: workspaceRoot,
  },

  projects: [
    // ── Local development: Chromium only (fast feedback) ──────────
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    // ── CI: full cross-browser suite ──────────────────────────────
    // Uncomment or enable via CI config when needed:
    // { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    // { name: 'webkit',  use: { ...devices['Desktop Safari'] } },
    // { name: 'mobile-chrome', use: { ...devices['Pixel 5'] } },
    // { name: 'mobile-safari', use: { ...devices['iPhone 12'] } },
  ],
});
