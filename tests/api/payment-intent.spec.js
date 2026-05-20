// @ts-check
import { test, expect } from '../../src/fixtures/playwright-fixtures.js';
import { loadTestAmounts, loadTestCards } from '../../src/utils/data-loader.js';

const amounts = loadTestAmounts();
const cards = loadTestCards();

test.describe('Stripe API — PaymentIntent lifecycle', () => {
  test.describe('Given a merchant needs to charge a customer', () => {
    test('When a PaymentIntent is created with a valid amount and currency, Then it is returned with status requires_payment_method', async ({ stripeApi }) => {
      const { amount, currency } = amounts.medium;

      const response = await stripeApi.createPaymentIntent({ amount, currency });

      expect(response.status).toBe(200);
      const body = /** @type {Record<string, any>} */ (response.body);
      expect(body.id).toMatch(/^pi_/);
      expect(body.amount).toBe(amount);
      expect(body.currency).toBe(currency);
      expect(body.status).toBe('requires_payment_method');
      expect(body.client_secret).toBeTruthy();
    });

    test('When a PaymentIntent is created with metadata, Then the metadata is persisted', async ({ stripeApi }) => {
      const { amount, currency } = amounts.small;
      const metadata = { test_run_id: `run_${Date.now()}`, scenario: 'metadata-persistence' };

      const response = await stripeApi.createPaymentIntent({ amount, currency, metadata });

      expect(response.status).toBe(200);
      const body = /** @type {Record<string, any>} */ (response.body);
      expect(body.metadata).toEqual(metadata);
    });

    test('When a PaymentIntent is created in EUR, Then the currency is preserved', async ({ stripeApi }) => {
      const { amount, currency } = amounts.eurMedium;

      const response = await stripeApi.createPaymentIntent({ amount, currency });

      expect(response.status).toBe(200);
      expect(/** @type {any} */ (response.body).currency).toBe('eur');
    });

    test('When a PaymentIntent is retrieved by ID, Then it returns the same intent', async ({ stripeApi }) => {
      const { amount, currency } = amounts.medium;
      const created = await stripeApi.createPaymentIntent({ amount, currency });
      const createdId = /** @type {any} */ (created.body).id;

      const retrieved = await stripeApi.retrievePaymentIntent(createdId);

      expect(retrieved.status).toBe(200);
      expect(/** @type {any} */ (retrieved.body).id).toBe(createdId);
      expect(/** @type {any} */ (retrieved.body).amount).toBe(amount);
    });

    test('When PaymentIntents are listed, Then a newly created PaymentIntent appears', async ({ stripeApi }) => {
      const created = await stripeApi.createPaymentIntent({
        amount: amounts.small.amount,
        currency: amounts.small.currency,
      });
      const createdId = /** @type {any} */ (created.body).id;

      const list = await stripeApi.listPaymentIntents({ limit: 10 });

      expect(list.status).toBe(200);
      const ids = /** @type {any} */ (list.body).data.map(
        /** @param {any} pi */ (pi) => pi.id,
      );
      expect(ids).toContain(createdId);
    });
  });

  test.describe('Given a PaymentIntent has been confirmed with a successful test card', () => {
    test('When the payment is confirmed, Then the status becomes succeeded', async ({ stripeApi }) => {
      const pmResponse = await stripeApi.createCardPaymentMethod(cards.success);
      const pmId = /** @type {any} */ (pmResponse.body).id;
      expect(pmId).toMatch(/^pm_/);

      const intent = await stripeApi.createPaymentIntent({
        amount: amounts.medium.amount,
        currency: amounts.medium.currency,
      });
      const intentId = /** @type {any} */ (intent.body).id;

      const confirmed = await stripeApi.confirmPaymentIntent(intentId, pmId);

      expect(confirmed.status).toBe(200);
      expect(/** @type {any} */ (confirmed.body).status).toBe('succeeded');
    });

    test('When confirming with a declined card, Then the API surfaces a card_declined error', async ({ stripeApi }) => {
      const pmResponse = await stripeApi.createCardPaymentMethod(cards.declinedGeneric);
      const pmId = /** @type {any} */ (pmResponse.body).id;

      const intent = await stripeApi.createPaymentIntent({
        amount: amounts.small.amount,
        currency: amounts.small.currency,
      });
      const intentId = /** @type {any} */ (intent.body).id;

      const confirmed = await stripeApi.confirmPaymentIntent(intentId, pmId);

      const body = /** @type {any} */ (confirmed.body);
      // Stripe returns 402 with last_payment_error populated on decline.
      expect([200, 402]).toContain(confirmed.status);
      const errorCode = body.error?.code ?? body.last_payment_error?.code;
      expect(errorCode).toBe('card_declined');
    });

    test('When confirming with insufficient funds, Then decline reason is insufficient_funds', async ({ stripeApi }) => {
      const pmResponse = await stripeApi.createCardPaymentMethod(cards.declinedInsufficientFunds);
      const pmId = /** @type {any} */ (pmResponse.body).id;

      const intent = await stripeApi.createPaymentIntent({
        amount: amounts.medium.amount,
        currency: amounts.medium.currency,
      });
      const intentId = /** @type {any} */ (intent.body).id;

      const confirmed = await stripeApi.confirmPaymentIntent(intentId, pmId);

      const body = /** @type {any} */ (confirmed.body);
      const declineCode = body.error?.decline_code ?? body.last_payment_error?.decline_code;
      expect(declineCode).toBe('insufficient_funds');
    });
  });
});
