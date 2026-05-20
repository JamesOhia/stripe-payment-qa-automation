// @ts-check
import { expect } from '@playwright/test';
import { BasePage } from './BasePage.js';
import { PaymentDetailPage } from './PaymentDetailPage.js';
import { env } from '../utils/env.js';

/**
 * Stripe Dashboard → Payments list page.
 *
 * Stripe's dashboard markup is heavy and uses internal class names that
 * change frequently, so we prefer:
 *  - getByRole for navigation/buttons
 *  - getByPlaceholder for the search bar
 *  - getByText only for stable, user-visible labels
 *  - direct deep-link to a payment by ID for reliability (instead of fragile row clicks)
 */
export class PaymentsPage extends BasePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    super(page, 'PaymentsPage');

    this.searchInput = page
      .getByRole('combobox', { name: /search/i })
      .or(page.getByPlaceholder(/search/i))
      .first();
    this.tableHeading = page.getByRole('heading', { name: /payments/i });
  }

  /**
   * Navigate to the Payments list and assert we landed there.
   * Always navigates first — the fixture page starts at about:blank.
   * @returns {Promise<this>}
   */
  async assertLoaded() {
    await this.page.goto(`${env.dashboardUrl}/test/payments`, { waitUntil: 'domcontentloaded' });
    await expect(this.page).toHaveURL(/\/(test\/)?payments/);
    return this;
  }

  /**
   * The most reliable way to open a payment detail page is to deep-link
   * directly using the PaymentIntent ID — avoids fragile row-search logic.
   *
   * @param {string} paymentIntentId
   * @returns {Promise<PaymentDetailPage>}
   */
  async openPaymentById(paymentIntentId) {
    this.logger.info(`Opening payment detail for ${paymentIntentId}`);
    // Use 'load' (not 'domcontentloaded') so Stripe's React app has time to
    // execute and issue its first data fetch before assertions start.
    await this.page.goto(`${env.dashboardUrl}/test/payments/${paymentIntentId}`, {
      waitUntil: 'load',
    });
    return new PaymentDetailPage(this.page, paymentIntentId);
  }

  /**
   * Verify a payment with the given ID is searchable in the table.
   * Useful when the assessment asks "payment appears in the payments list".
   *
   * @param {string} paymentIntentId
   * @returns {Promise<this>}
   */
  async assertPaymentVisibleInList(paymentIntentId) {
    await this.searchInput.fill(paymentIntentId);
    // Stripe's search renders matching results asynchronously; we wait on the
    // ID text appearing as a link in the table, which is the user-visible signal.
    await expect(this.page.getByText(paymentIntentId).first()).toBeVisible({ timeout: 15_000 });
    return this;
  }
}
