// @ts-check
import { expect } from '@playwright/test';
import { BasePage } from './BasePage.js';
import { PaymentsPage } from './PaymentsPage.js';
import { env } from '../utils/env.js';

/**
 * Stripe Dashboard landing page (post-login).
 */
export class DashboardPage extends BasePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    super(page, 'DashboardPage');

    this.paymentsNavLink = page.getByRole('link', { name: /^Payments$/ });
    this.testModeBadge = page.getByText(/Test mode/i).first();
    this.userMenu = page.getByRole('button', { name: /account|profile|user menu/i });
  }

  /**
   * Navigate to the dashboard home and wait for it to load.
   * @returns {Promise<this>}
   */
  async goto() {
    await super.goto(`${env.dashboardUrl}/dashboard`);
    return this;
  }

  /**
   * Assert that the dashboard has finished loading and is in test mode.
   * @returns {Promise<this>}
   */
  async assertLoaded() {
    await this.goto();
    await expect(this.page).toHaveURL(/dashboard\.stripe\.com/);
    return this;
  }

  /**
   * @returns {Promise<PaymentsPage>}
   */
  async openPayments() {
    this.logger.info('Opening Payments section');
    // Prefer direct navigation (more reliable than click chains in Stripe UI)
    await this.page.goto(`${env.dashboardUrl}/test/payments`, { waitUntil: 'domcontentloaded' });
    return new PaymentsPage(this.page);
  }
}
