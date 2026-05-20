// @ts-check
import { test, expect } from '../../src/fixtures/playwright-fixtures.js';
import { loadTestAmounts, loadTestCards } from '../../src/utils/data-loader.js';

const amounts = loadTestAmounts();
const cards = loadTestCards();

/**
 * Helper: create + confirm a succeeded PaymentIntent so refund tests
 * each start from a clean known-good payment.
 *
 * @param {import('../../src/api/StripeApiClient.js').StripeApiClient} api
 * @param {Object} [opts]
 * @param {number} [opts.amount]
 * @param {string} [opts.currency]
 * @returns {Promise<{ paymentIntentId: string; amount: number; currency: string }>}
 */
async function createSucceededPayment(api, opts = {}) {
  const amount = opts.amount ?? amounts.medium.amount;
  const currency = opts.currency ?? amounts.medium.currency;

  const pmRes = await api.createCardPaymentMethod(cards.success);
  const pmId = /** @type {any} */ (pmRes.body).id;

  const intentRes = await api.createPaymentIntent({ amount, currency });
  const intentId = /** @type {any} */ (intentRes.body).id;

  const confirmRes = await api.confirmPaymentIntent(intentId, pmId);
  expect(/** @type {any} */ (confirmRes.body).status).toBe('succeeded');

  return { paymentIntentId: intentId, amount, currency };
}

test.describe('Stripe API — Refund lifecycle', () => {
  test.describe('Given a succeeded payment exists', () => {
    test('When a full refund is requested, Then the refund is created with status succeeded', async ({ stripeApi }) => {
      const { paymentIntentId, amount } = await createSucceededPayment(stripeApi);

      const refund = await stripeApi.createRefund({ paymentIntent: paymentIntentId });

      expect(refund.status).toBe(200);
      const body = /** @type {any} */ (refund.body);
      expect(body.id).toMatch(/^re_/);
      expect(body.amount).toBe(amount);
      expect(body.status).toBe('succeeded');
      expect(body.payment_intent).toBe(paymentIntentId);
    });

    test('When a partial refund is requested, Then only the requested amount is refunded', async ({ stripeApi }) => {
      const { paymentIntentId, amount } = await createSucceededPayment(stripeApi);
      const partialAmount = Math.floor(amount / 2);

      const refund = await stripeApi.createRefund({
        paymentIntent: paymentIntentId,
        amount: partialAmount,
      });

      expect(refund.status).toBe(200);
      expect(/** @type {any} */ (refund.body).amount).toBe(partialAmount);
      expect(/** @type {any} */ (refund.body).status).toBe('succeeded');
    });

    test('When a refund includes metadata and reason, Then they are persisted', async ({ stripeApi }) => {
      const { paymentIntentId } = await createSucceededPayment(stripeApi);
      const metadata = { ticket_id: 'CS-12345', operator: 'test-bot' };

      const refund = await stripeApi.createRefund({
        paymentIntent: paymentIntentId,
        reason: 'requested_by_customer',
        metadata,
      });

      expect(refund.status).toBe(200);
      const body = /** @type {any} */ (refund.body);
      expect(body.metadata).toEqual(metadata);
      expect(body.reason).toBe('requested_by_customer');
    });

    test('When a refund is retrieved by ID, Then the same refund record is returned', async ({ stripeApi }) => {
      const { paymentIntentId } = await createSucceededPayment(stripeApi);
      const created = await stripeApi.createRefund({ paymentIntent: paymentIntentId });
      const createdId = /** @type {any} */ (created.body).id;

      const retrieved = await stripeApi.retrieveRefund(createdId);

      expect(retrieved.status).toBe(200);
      expect(/** @type {any} */ (retrieved.body).id).toBe(createdId);
    });

    test('When refunds are listed for a PaymentIntent, Then the refund appears', async ({ stripeApi }) => {
      const { paymentIntentId } = await createSucceededPayment(stripeApi);
      const created = await stripeApi.createRefund({ paymentIntent: paymentIntentId });
      const createdId = /** @type {any} */ (created.body).id;

      const list = await stripeApi.listRefunds({ payment_intent: paymentIntentId });

      expect(list.status).toBe(200);
      const ids = /** @type {any} */ (list.body).data.map(
        /** @param {any} r */ (r) => r.id,
      );
      expect(ids).toContain(createdId);
    });

    test('When refunding more than the original amount, Then the API rejects the request', async ({ stripeApi }) => {
      const { paymentIntentId, amount } = await createSucceededPayment(stripeApi);

      const refund = await stripeApi.createRefund({
        paymentIntent: paymentIntentId,
        amount: amount + 1000,
      });

      // Stripe returns 400 with charge_already_refunded / amount_too_large
      expect([400, 402]).toContain(refund.status);
      const body = /** @type {any} */ (refund.body);
      expect(body.error?.type ?? body.error?.code).toBeTruthy();
    });
  });
});
