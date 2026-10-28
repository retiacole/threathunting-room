'use strict';
const {defineConfig} = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/browser',
  testMatch: '**/*.spec.cjs',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 30_000,
  reporter: 'list',
  use: {
    browserName: 'chromium',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {name: 'desktop-ja', use: {locale: 'ja-JP', viewport: {width: 1280, height: 900}}},
    {name: 'desktop-en', use: {locale: 'en-US', viewport: {width: 1280, height: 900}}},
    {name: 'narrow-ja', use: {locale: 'ja-JP', viewport: {width: 390, height: 844}}},
  ],
});
