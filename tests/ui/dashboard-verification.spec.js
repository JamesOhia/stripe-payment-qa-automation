// @ts-check
/**
 * UI spec — Stripe Dashboard accessibility verification.
 *
 * Relies on the authenticated storage state produced by `npm run save-auth`
 * (local) or decoded from the STRIPE_AUTH_STATE GitHub Secret (CI).
 * See tests/auth.setup.js for the session-loading logic.
 *
 * These tests do NOT create API resources — they simply verify that the
 * authenticated session grants access to the expected dashboard sections.
 */
import { test, expect } from '../../src/fixtures/playwright-fixtures.js';

test.describe('Stripe Dashboard', () => {
  test.describe('Given an authenticated sandbox session', () => {
    test('When the dashboard loads, Then it is not redirected to the login page', async ({
      dashboardPage,
    }) => {
      await test.step('navigate to dashboard', async () => {
        await dashboardPage.assertLoaded();
      });

      await test.step('verify session is active (not on login page)', async () => {
        await expect(dashboardPage.page).not.toHaveURL(/\/login/);
      });
    });

    test('When the Payments section is opened, Then the payments list is visible', async ({
      dashboardPage,
      paymentsPage,
    }) => {
      await test.step('navigate to dashboard', async () => {
        await dashboardPage.assertLoaded();
      });

      await test.step('open Payments section', async () => {
        await dashboardPage.openPayments();
      });

      await test.step('verify payments list loaded', async () => {
        await paymentsPage.assertLoaded();
      });
    });
  });
});
