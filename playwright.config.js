// @ts-check
const { defineConfig, devices } = require('@playwright/test');
const path = require('path');

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['html'], ['github']] : [['list'], ['html']],
  timeout: 30_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: process.env.NNTN_BASE_URL || 'https://ttt3p.github.io/nntn/',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },

  projects: [
    // 1) Public smoke tests — ไม่ต้อง auth
    {
      name: 'public',
      testMatch: /public-pages\.spec\.js/,
      use: { ...devices['Desktop Chrome'] },
    },

    // 2) Auth setup — login แล้วเก็บ storageState
    {
      name: 'setup',
      testMatch: /auth\.setup\.js/,
      use: { ...devices['Desktop Chrome'] },
    },

    // 3) Authenticated tests — ใช้ storageState จาก setup
    {
      name: 'authed',
      testIgnore: [/auth\.setup\.js/, /public-pages\.spec\.js/],
      use: {
        ...devices['Desktop Chrome'],
        storageState: path.join(__dirname, 'playwright', '.auth', 'user.json'),
      },
      dependencies: ['setup'],
    },
  ],
});
