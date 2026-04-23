// @ts-check
// Production QA config for sales-ops.html — no auth dependency (file:// protocol)
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  testMatch: /qa-sales-ops\.spec\.js/,
  timeout: 30_000,
  expect: { timeout: 8_000 },
  reporter: [['list']],
  outputDir: 'test-results',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'about:blank',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'sales-ops-qa', use: { ...devices['Desktop Chrome'] } }
  ],
});
