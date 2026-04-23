// @ts-check
// Standalone config for SOP system QA — no auth required (file:// URLs)
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  testMatch: /qa-sop-system\.spec\.js/,
  fullyParallel: true,
  retries: 0,
  workers: 4,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 10_000,
  },
  projects: [
    {
      name: 'sop-qa',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
