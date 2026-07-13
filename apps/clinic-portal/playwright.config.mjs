import { defineConfig, devices } from '@playwright/test';

const port = 3211;
const mockBackendPort = 3212;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  globalSetup: './tests/e2e/support/allure-global-setup.ts',
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['allure-playwright', { resultsDir: 'allure-results' }],
  ],
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: 'on',
    screenshot: 'on',
    video: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: `npm run start -- -H 127.0.0.1 -p ${port}`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      VETHELP_API_BASE_URL: `http://127.0.0.1:${mockBackendPort}`,
      VETHELP_CLINIC_JWT_SECRET: 'clinic-e2e-secret-at-least-32-bytes',
      NEXT_TELEMETRY_DISABLED: '1',
      PORTAL_V51_SHELL: 'true',
    },
  },
});
