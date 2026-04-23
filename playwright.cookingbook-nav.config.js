const { defineConfig, devices } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './tests',
  testMatch: /qa-cookingbook-nav\.spec\.js/,
  timeout: 30_000,
  reporter: [['list']],
  use: { ...devices['Desktop Chrome'], baseURL: 'about:blank' },
  projects: [{ name: 'nav', use: { ...devices['Desktop Chrome'] } }],
});
