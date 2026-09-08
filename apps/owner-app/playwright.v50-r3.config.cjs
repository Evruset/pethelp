const { defineConfig, devices } = require('@playwright/test');

const port = Number(process.env.OWNER_EXPO_WEB_PORT ?? 8081);
const origin = `http://127.0.0.1:${port}`;
const referencePort = Number(process.env.OWNER_V50_REFERENCE_PORT ?? 8093);

module.exports = defineConfig({
  testDir: './tests/e2e',
  testMatch: 'owner-v50-r3.visual.spec.cjs',
  outputDir: './test-results/owner-v50-r3',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: { baseURL: origin, trace: 'on', screenshot: 'only-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [{
    command: `npx expo export --platform web && npx expo serve --port ${port}`,
    url: origin,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      VETHELP_API_BASE_URL: process.env.VETHELP_API_BASE_URL ?? 'http://127.0.0.1:3000',
      OWNER_WEB_ORIGIN: origin,
      OWNER_WEB_BFF_IP_SIGNING_SECRET:
        process.env.OWNER_WEB_BFF_IP_SIGNING_SECRET ?? 'local-owner-web-ip-signing-secret-32-bytes',
      PATH: process.env.PATH ?? '',
    },
  }, {
    command: `python3 -m http.server ${referencePort} --bind 127.0.0.1 --directory ../../docs/ux/v50-reference/owner`,
    url: `http://127.0.0.1:${referencePort}/index.html`,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  }],
});
