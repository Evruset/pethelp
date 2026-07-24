import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.CLINIC_PORTAL_E2E_PORT ?? 3211);
const mockBackendPort = Number(process.env.CLINIC_PORTAL_MOCK_PORT ?? 3212);

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
    command: `npx -y node@22 node_modules/next/dist/bin/next start -H 127.0.0.1 -p ${port}`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      VETHELP_API_BASE_URL: `http://127.0.0.1:${mockBackendPort}`,
      VETHELP_CLINIC_JWT_SECRET: 'clinic-e2e-secret-at-least-32-bytes',
      NEXT_TELEMETRY_DISABLED: '1',
      PORTAL_V50_SHELL: 'true',
      PORTAL_V51_SHELL: 'true',
      VETHELP_CLINIC_APPOINTMENTS_REGISTRY: process.env.VETHELP_CLINIC_APPOINTMENTS_REGISTRY ?? 'false',
      VETHELP_CLINIC_PATIENTS_REGISTRY: process.env.VETHELP_CLINIC_PATIENTS_REGISTRY ?? 'false',
    },
  },
});
