// @ts-check
import { test, expect } from '../../src/fixtures/playwright-fixtures.js';
import { loadTestAmounts, loadTestCards } from '../../src/utils/data-loader.js';

const amounts = loadTestAmounts();
const cards = loadTestCards();

test.describe('Stripe E2E — Full payment journey (API + Dashboard UI)', () => {
  test.describe('Given a customer pays for a product and the merchant later refunds them', () => {
    test('When the payment is processed, the webhook fires, and a full refund is issued — Then the dashboard reflects the complete journey', async ({
      stripeApi,
      webhookVerifier,
      paymentsPage,
    }) => {
      // ============ ARRANGE — API ============
      const { amount, currency, display } = amounts.medium;

      // 1. Create payment method with a successful test card
      const pmRes = await stripeApi.createCardPaymentMethod(cards.success);
      expect(pmRes.status).toBe(200);
      const pmId = /** @type {any} */ (pmRes.body).id;

      // 2. Create the PaymentIntent
      const intentRes = await stripeApi.createPaymentIntent({
        amount,
        currency,
        description: 'E2E test: full payment journey',
        metadata: { test_run: `journey_${Date.now()}` },
      });
      expect(intentRes.status).toBe(200);
      const intentId = /** @type {any} */ (intentRes.body).id;

      // 3. Confirm the PaymentIntent
      const confirmRes = await stripeApi.confirmPaymentIntent(intentId, pmId);
      expect(/** @type {any} */ (confirmRes.body).status).toBe('succeeded');

      // 4. Retrieve to verify final status
      const retrieved = await stripeApi.retrievePaymentIntent(intentId);
      expect(/** @type {any} */ (retrieved.body).status).toBe('succeeded');
      expect(/** @type {any} */ (retrieved.body).amount).toBe(amount);

      // 5. Verify webhook events were emitted (via /v1/events polling)
      const succeededEvent = await webhookVerifier.waitForEvent('payment_intent.succeeded', {
        objectId: intentId,
      });
      expect(/** @type {any} */ (succeededEvent).data.object.id).toBe(intentId);

      // 6. Issue a full refund
      const refundRes = await stripeApi.createRefund({ paymentIntent: intentId });
      expect(refundRes.status).toBe(200);
      expect(/** @type {any} */ (refundRes.body).status).toBe('succeeded');
      expect(/** @type {any} */ (refundRes.body).amount).toBe(amount);

      // 7. Verify the refund event fired
      const refundEvent = await webhookVerifier.waitForEvent('charge.refunded', {
        objectId: intentId,
      });
      expect(/** @type {any} */ (refundEvent).data.object.refunded).toBe(true);

      // ============ ACT + ASSERT — UI ============
      // Open the Payments dashboard, deep-link to this PaymentIntent,
      // and verify amount + status + refund are all reflected.
      const paymentDetail = await paymentsPage
        .assertLoaded()
        .then(() => paymentsPage.openPaymentById(intentId));

      await paymentDetail.assertLoaded();
      await paymentDetail.assertAmountIs(display);
      await paymentDetail.assertStatusIs('Refunded');
      await paymentDetail.assertRefundVisible();
    });

    test('When a partial refund is issued — Then the dashboard shows Partially refunded status', async ({
      stripeApi,
      webhookVerifier,
      paymentsPage,
    }) => {
      const { amount, currency, display } = amounts.large;
      const partial = Math.floor(amount / 2);

      const pmRes = await stripeApi.createCardPaymentMethod(cards.success);
      const pmId = /** @type {any} */ (pmRes.body).id;
      const intentRes = await stripeApi.createPaymentIntent({ amount, currency });
      const intentId = /** @type {any} */ (intentRes.body).id;
      await stripeApi.confirmPaymentIntent(intentId, pmId);

      await stripeApi.createRefund({ paymentIntent: intentId, amount: partial });
      await webhookVerifier.waitForEvent('charge.refunded', { objectId: intentId });

      const detail = await paymentsPage.openPaymentById(intentId);
      await detail.assertLoaded();
      await detail.assertAmountIs(display);
      await detail.assertStatusIs('Partial refund');
      await detail.assertRefundVisible();
    });
  });
});
