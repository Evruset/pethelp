const { defineConfig, devices } = require('@playwright/test');
const { dirname, delimiter } = require('node:path');

const port=Number(process.env.OWNER_EXPO_WEB_PORT??8081);
const origin=`http://127.0.0.1:${port}`;
const clinicPort=Number(process.env.CLINIC_PORTAL_LOCAL_STACK_PORT??3213);
const clinicOrigin=`http://127.0.0.1:${clinicPort}`;
const toolPath=`${dirname(process.execPath)}${delimiter}${process.env.PATH??''}`;

module.exports=defineConfig({
  testDir:'./tests/e2e',
  outputDir:'./test-results/wave4-owner-discovery',
  fullyParallel:false,
  workers:1,
  retries:0,
  reporter:[['list']],
  use:{baseURL:origin,trace:'on',screenshot:'only-on-failure'},
  projects:[{name:'chromium',use:{...devices['Desktop Chrome']}}],
  webServer:[
    {command:`npx expo export --platform web && npx expo serve --port ${port}`,url:origin,reuseExistingServer:!process.env.CI,timeout:120_000,env:{VETHELP_API_BASE_URL:process.env.VETHELP_API_BASE_URL??'http://127.0.0.1:3000',OWNER_WEB_ORIGIN:origin,OWNER_WEB_BFF_IP_SIGNING_SECRET:process.env.OWNER_WEB_BFF_IP_SIGNING_SECRET??'local-owner-web-ip-signing-secret-32-bytes',PATH:toolPath}},
    {command:`cd ../clinic-portal && npm run build && npm run start -- -H 127.0.0.1 -p ${clinicPort}`,url:clinicOrigin,reuseExistingServer:!process.env.CI,timeout:180_000,env:{VETHELP_API_BASE_URL:process.env.VETHELP_API_BASE_URL??'http://127.0.0.1:3000',VETHELP_CLINIC_JWT_SECRET:process.env.VETHELP_CLINIC_JWT_SECRET??'local-development-jwt-signing-key-not-for-shared-use',NEXT_TELEMETRY_DISABLED:'1',PATH:toolPath}},
  ],
});
