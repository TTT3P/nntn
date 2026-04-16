// @ts-check
const { test: setup, expect } = require('@playwright/test');
const path = require('path');

const authFile = path.join(__dirname, '..', 'playwright', '.auth', 'user.json');

setup('authenticate', async ({ page }) => {
  await page.goto('login.html');
  const pwd = process.env.NNTN_PWD;
  if (!pwd) {
    throw new Error('NNTN_PWD env var is required (set locally or via GitHub Secret)');
  }
  await page.locator('#usr').fill('staff');
  await page.locator('#pwd').fill(pwd);
  await page.click('#btn');

  // รอ redirect ออกจาก login.html (→ index.html)
  await page.waitForURL(url => !url.pathname.endsWith('login.html'), { timeout: 15_000 });

  // verify token ถูก set
  const token = await page.evaluate(() => localStorage.getItem('nntn_sb_token'));
  expect(token).toBeTruthy();

  await page.context().storageState({ path: authFile });
});
