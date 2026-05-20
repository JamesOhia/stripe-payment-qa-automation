// @ts-check
import { test as base, expect } from '@playwright/test';
import { StripeApiClient } from '../api/StripeApiClient.js';
import { WebhookVerifier } from '../api/WebhookVerifier.js';
import { LoginPage } from '../pages/LoginPage.js';
import { DashboardPage } from '../pages/DashboardPage.js';
import { PaymentsPage } from '../pages/PaymentsPage.js';

/**
 * @typedef {Object} TestFixtures
 * @property {StripeApiClient} stripeApi
 * @property {WebhookVerifier} webhookVerifier
 * @property {LoginPage} loginPage
 * @property {DashboardPage} dashboardPage
 * @property {PaymentsPage} paymentsPage
 */

/**
 * Centralised Playwright fixtures so every test gets a fresh, properly
 * disposed API client + Page Objects with one import.
 *
 *   import { test, expect } from '../../src/fixtures/playwright-fixtures.js';
 *
 * Keeps spec files clean — no manual `new StripeApiClient()` per test.
 */
export const test = base.extend(
  /** @type {import('@playwright/test').Fixtures<TestFixtures, {}, import('@playwright/test').PlaywrightTestArgs>} */ ({
  stripeApi: async ({}, use) => {
    const client = new StripeApiClient();
    await use(client);
    await client.dispose();
  },

  webhookVerifier: async ({ stripeApi }, use) => {
    await use(new WebhookVerifier(stripeApi));
  },

  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },

  dashboardPage: async ({ page }, use) => {
    await use(new DashboardPage(page));
  },

  paymentsPage: async ({ page }, use) => {
    await use(new PaymentsPage(page));
  },
}),
);

export { expect };
