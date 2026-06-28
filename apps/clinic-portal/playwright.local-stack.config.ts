import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.CLINIC_PORTAL_LOCAL_STACK_PORT ?? 3213);
const backendBaseUrl = process.env.VETHELP_API_BASE_URL ?? 'http://127.0.0.1:3000';
const clinicJwtSecret = process.env.VETHELP_CLINIC_JWT_SECRET
  ?? 'local-development-jwt-signing-key-not-for-shared-use';

export default defineConfig({
  testDir: './tests/local-stack',
  outputDir: './test-results/local-stack',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: 'on',
    screenshot: 'only-on-failure',
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
      VETHELP_API_BASE_URL: backendBaseUrl,
      VETHELP_CLINIC_JWT_SECRET: clinicJwtSecret,
      NEXT_TELEMETRY_DISABLED: '1',
    },
  },
});
