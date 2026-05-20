// @ts-check
import { expect } from '@playwright/test';
import { BasePage } from './BasePage.js';

/**
 * Stripe Dashboard → Payment Detail page.
 *
 * This is the page where we verify:
 *  - Amount displayed
 *  - Payment status (Succeeded / Refunded / etc.)
 *  - Refund visibility in the timeline / refunds section
 */
export class PaymentDetailPage extends BasePage {
  /**
   * @param {import('@playwright/test').Page} page
   * @param {string} paymentIntentId
   */
  constructor(page, paymentIntentId) {
    super(page, 'PaymentDetailPage');
    this.paymentIntentId = paymentIntentId;

    // User-first locators
    this.amountHeading = page.getByRole('heading').first();
    this.statusBadge = page
      .getByText(/^(Succeeded|Refunded|Partial refund|Failed|Pending)$/i)
      .first();
    this.refundedBadge = page.getByText(/^(Refunded|Partial refund)$/i).first();
    this.timelineRefundEntry = page.getByText(/refund(ed)?/i).first();
  }

  /**
   * Assert we are on the right payment detail page.
   * @returns {Promise<this>}
   */
  async assertLoaded() {
    await expect(this.page).toHaveURL(new RegExp(`/payments/${this.paymentIntentId}`));
    return this;
  }

  /**
   * Verify the payment displays the expected amount as a formatted currency string.
   * Stripe formats amounts like "$50.00" — we match by visible text.
   *
   * @param {string} displayAmount - e.g. "$50.00"
   * @returns {Promise<this>}
   */
  async assertAmountIs(displayAmount) {
    this.logger.info(`Asserting amount is ${displayAmount}`);
    await expect(this.page.getByText(displayAmount).first()).toBeVisible({ timeout: 30_000 });
    return this;
  }

  /**
   * Verify the payment status badge matches the expected status.
   *
   * @param {'Succeeded'|'Refunded'|'Partial refund'|'Failed'|'Pending'} expected
   * @returns {Promise<this>}
   */
  async assertStatusIs(expected) {
    this.logger.info(`Asserting status is ${expected}`);
    await expect(
      this.page.getByText(new RegExp(`^${expected}$`, 'i')).first(),
    ).toBeVisible({ timeout: 30_000 });
    return this;
  }

  /**
   * Verify a refund is visible in the payment timeline or refunds section.
   * @returns {Promise<this>}
   */
  async assertRefundVisible() {
    this.logger.info('Asserting refund is visible on payment detail');
    await expect(this.timelineRefundEntry).toBeVisible({ timeout: 30_000 });
    return this;
  }
}
