// @ts-check
const { test: setup, expect } = require('@playwright/test');
const path = require('path');

const authFile = path.join(__dirname, '..', 'playwright', '.auth', 'user.json');

setup('authenticate', async ({ page }) => {
  const usr = process.env.NNTN_USR;
  const pwd = process.env.NNTN_PWD;
  if (!usr) {
    throw new Error('NNTN_USR env var is required — use full email e.g. platformci@staffnntn.co (set locally or via GitHub Secret)');
  }
  if (!pwd) {
    throw new Error('NNTN_PWD env var is required (set locally or via GitHub Secret)');
  }

  // Capture the login response so we can surface the real auth error instead of
  // failing 30s later on waitForURL with no useful context.
  let loginResponse = null;
  page.on('response', (r) => {
    if (r.url().includes('/auth/v1/token')) loginResponse = r;
  });

  await page.goto('login.html');
  await page.locator('#usr').fill(usr);
  await page.locator('#pwd').fill(pwd);
  await page.click('#btn');

  try {
    await page.waitForURL((url) => !url.pathname.endsWith('login.html'), { timeout: 15_000 });
  } catch (e) {
    if (loginResponse && !loginResponse.ok()) {
      const body = await loginResponse.text().catch(() => '<unreadable>');
      throw new Error(
        `Login failed: ${loginResponse.status()} ${loginResponse.statusText()} · ${body.slice(0, 200)} · ` +
        `usr "${usr}" — verify GitHub Secret NNTN_USR is full email (login.html appends @nntn.internal if no @ in input)`
      );
    }
    throw e;
  }

  const token = await page.evaluate(() => localStorage.getItem('nntn_sb_token'));
  expect(token).toBeTruthy();

  await page.context().storageState({ path: authFile });
});
