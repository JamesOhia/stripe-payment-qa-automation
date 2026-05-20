// @ts-check
import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env') });

/**
 * Playwright configuration for Stripe Payment E2E suite.
 *
 * Projects:
 *  - setup   : authenticates against the Stripe Dashboard once and persists storage state.
 *  - api     : API-only specs (no browser) — fast, runs first.
 *  - ui      : UI-only specs (browser) — depend on setup.
 *  - e2e     : Full API + UI journeys — depend on setup.
 *
 * Reporting: Allure (for GitHub Pages + artifacts) + HTML (for local debugging).
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    [
      'allure-playwright',
      {
        detail: true,
        outputFolder: 'allure-results',
        suiteTitle: false,
        environmentInfo: {
          framework: 'Playwright',
          language: 'JavaScript',
          node_version: process.version,
          os: process.platform,
        },
      },
    ],
  ],
  use: {
    baseURL: process.env.STRIPE_DASHBOARD_URL ?? 'https://dashboard.stripe.com',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.js/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'api',
      testMatch: /tests\/api\/.*\.spec\.js/,
    },
    {
      name: 'ui',
      testMatch: /tests\/ui\/.*\.spec\.js/,
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: '.auth/stripe-auth-state.json',
      },
    },
    {
      name: 'e2e',
      testMatch: /tests\/e2e\/.*\.spec\.js/,
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: '.auth/stripe-auth-state.json',
      },
    },
  ],
});
