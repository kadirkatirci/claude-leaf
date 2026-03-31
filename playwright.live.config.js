import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './test/e2e-live',
  fullyParallel: false,
  workers: 1,
  timeout: 180_000,
  expect: {
    timeout: 10_000,
  },
  reporter: [['list']],
  outputDir: '.auth/playwright-live-results',
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
});
