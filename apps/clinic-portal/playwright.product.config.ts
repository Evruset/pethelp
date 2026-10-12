import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
 testDir:'./tests/product',workers:1,fullyParallel:false,timeout:90_000,retries:0,
 reporter:[['list']],outputDir:'../../dev/product-batch01/test-results',
 use:{...devices['Desktop Chrome'],baseURL:'http://127.0.0.1:3318',trace:'retain-on-failure',screenshot:'only-on-failure'},
});
