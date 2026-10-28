'use strict';
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {test, expect} = require('@playwright/test');
const {version} = require('../../package.json');
const htmlURL = pathToFileURL(path.resolve(__dirname, '../../dist/index.html')).href;

function observeFailures(page) {
  const errors = [];
  const externalRequests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    if (/^https?:/i.test(request.url())) externalRequests.push(request.url());
  });
  return {errors, externalRequests};
}

test('offline HTML renders in the preferred language and opens a tutorial by keyboard', async ({page}, testInfo) => {
  const {errors, externalRequests} = observeFailures(page);
  const english = testInfo.project.use.locale === 'en-US';
  await page.goto(htmlURL);
  await expect(page.locator('html')).toHaveAttribute('lang', english ? 'en' : 'ja');
  await expect(page.getByRole('heading', {level: 1})).toHaveText(english ? 'Work through your first hunt together' : '最初のハントを一緒に進める');
  await expect(page.getByRole('combobox', {name: 'Language'})).toHaveValue(english ? 'en' : 'ja');
  await expect(page.locator('.release-version')).toHaveText(`v${version}`);
  // A fresh visit starts in the tutorial. Reach the learning map by keyboard.
  const home = page.locator('.brand[data-action="home"]');
  for (let i = 0; i < 10 && !await home.evaluate(el => el === document.activeElement); i++) {
    await page.keyboard.press('Tab');
  }
  await expect(home).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', {level: 1})).toHaveText(english ? 'First time? Start here.' : '初めてなら、ここから。');
  await expect(page.locator('#main .task-row')).toHaveCount(6);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);

  // Follow the actual tab order instead of focusing the button programmatically.
  const start = page.locator('[data-action="tutorial-start"]');
  for (let i = 0; i < 15 && !await start.evaluate(el => el === document.activeElement); i++) {
    await page.keyboard.press('Tab');
  }
  await expect(start).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('.tutorial-coach')).toBeVisible();
  await expect(page.locator('#query')).toBeVisible();
  await page.locator('#query').fill('destination:sync-demo.example');
  await page.locator('#query').press('Enter');
  await expect(page.locator('.result-bar')).toContainText('2 / 4');
  await expect(page.locator('[data-action="log-detail"]')).toHaveCount(2);
  await page.locator('[data-action="log-detail"]').first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  expect(errors).toEqual([]);
  expect(externalRequests).toEqual([]);
});

test.describe('without JavaScript', () => {
  test.use({javaScriptEnabled: false});
  test('shows the course overview and offline instructions', async ({page}) => {
    const {externalRequests} = observeFailures(page);
    await page.goto(htmlURL);
    await expect(page.locator('#main')).toBeVisible();
    await expect(page.locator('#main h1')).toContainText('ThreatHunting-room');
    await expect(page.locator('#main')).toContainText('38');
    await expect(page.locator('#main')).toContainText('5');
    await expect(page.locator('.startup-noscript')).toBeVisible();
    await expect(page.locator('.startup-noscript')).toContainText('JavaScript');
    const downloads = page.locator('.startup-noscript a[download="threathunting-room.html"]');
    await expect(downloads).toHaveCount(2);
    for (const link of await downloads.all()) {
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute('href', 'https://retiacole.github.io/threathunting-room/threathunting-room.html');
    }
    expect(externalRequests).toEqual([]);
  });
});
