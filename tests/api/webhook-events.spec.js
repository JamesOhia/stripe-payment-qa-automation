// @ts-check
import { test, expect } from '../../src/fixtures/playwright-fixtures.js';
import { loadTestAmounts, loadTestCards } from '../../src/utils/data-loader.js';

const amounts = loadTestAmounts();
const cards = loadTestCards();

test.describe('Stripe API — Webhook event verification (via /v1/events polling)', () => {
  test.describe('Given a successful payment flow', () => {
    test('When a PaymentIntent succeeds, Then payment_intent.succeeded event is emitted', async ({
      stripeApi,
      webhookVerifier,
    }) => {
      const pm = await stripeApi.createCardPaymentMethod(cards.success);
      const intent = await stripeApi.createPaymentIntent({
        amount: amounts.small.amount,
        currency: amounts.small.currency,
      });
      const intentId = /** @type {any} */ (intent.body).id;
      const pmId = /** @type {any} */ (pm.body).id;
      await stripeApi.confirmPaymentIntent(intentId, pmId);

      const event = await webhookVerifier.waitForEvent('payment_intent.succeeded', {
        objectId: intentId,
      });

      expect(/** @type {any} */ (event).type).toBe('payment_intent.succeeded');
      expect(/** @type {any} */ (event).data.object.id).toBe(intentId);
      expect(/** @type {any} */ (event).data.object.status).toBe('succeeded');
    });

    test('When a charge is created, Then charge.succeeded event references the same PaymentIntent', async ({
      stripeApi,
      webhookVerifier,
    }) => {
      const pm = await stripeApi.createCardPaymentMethod(cards.success);
      const intent = await stripeApi.createPaymentIntent({
        amount: amounts.medium.amount,
        currency: amounts.medium.currency,
      });
      const intentId = /** @type {any} */ (intent.body).id;
      const pmId = /** @type {any} */ (pm.body).id;
      await stripeApi.confirmPaymentIntent(intentId, pmId);

      const event = await webhookVerifier.waitForEvent('charge.succeeded', {
        objectId: intentId,
      });

      expect(/** @type {any} */ (event).type).toBe('charge.succeeded');
      expect(/** @type {any} */ (event).data.object.payment_intent).toBe(intentId);
    });
  });

  test.describe('Given a refund is issued', () => {
    test('When a refund completes, Then charge.refunded event is emitted', async ({
      stripeApi,
      webhookVerifier,
    }) => {
      const pm = await stripeApi.createCardPaymentMethod(cards.success);
      const intent = await stripeApi.createPaymentIntent({
        amount: amounts.medium.amount,
        currency: amounts.medium.currency,
      });
      const intentId = /** @type {any} */ (intent.body).id;
      const pmId = /** @type {any} */ (pm.body).id;
      await stripeApi.confirmPaymentIntent(intentId, pmId);
      await stripeApi.createRefund({ paymentIntent: intentId });

      const event = await webhookVerifier.waitForEvent('charge.refunded', {
        objectId: intentId,
      });

      expect(/** @type {any} */ (event).type).toBe('charge.refunded');
      expect(/** @type {any} */ (event).data.object.payment_intent).toBe(intentId);
      expect(/** @type {any} */ (event).data.object.refunded).toBe(true);
    });
  });
});
