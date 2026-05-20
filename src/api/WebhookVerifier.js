// @ts-check
import { Logger } from '../utils/logger.js';

/**
 * Verifies "webhook" delivery by polling Stripe's /v1/events endpoint.
 *
 * Why this approach for CI:
 *  - No public URL needed (no ngrok, no Stripe CLI)
 *  - Deterministic — every action you take produces an event record
 *  - Same data Stripe would deliver to a real webhook handler
 *
 * Usage:
 *   const verifier = new WebhookVerifier(apiClient);
 *   const event = await verifier.waitForEvent('payment_intent.succeeded', { paymentIntentId });
 */
export class WebhookVerifier {
  /**
   * @param {import('./StripeApiClient.js').StripeApiClient} apiClient
   */
  constructor(apiClient) {
    this.api = apiClient;
    this.logger = new Logger('WebhookVerifier');
  }

  /**
   * Poll /v1/events until an event of the given type associated with the
   * given object ID is found, or the timeout elapses.
   *
   * @param {string} eventType - e.g. 'payment_intent.succeeded'
   * @param {Object} options
   * @param {string} options.objectId - Stripe ID of the object the event should reference
   * @param {number} [options.timeoutMs] - Max wait in ms (default 30s)
   * @param {number} [options.pollIntervalMs] - Poll cadence (default 1s)
   * @returns {Promise<Record<string, unknown>>}
   */
  async waitForEvent(eventType, { objectId, timeoutMs = 30_000, pollIntervalMs = 1_000 }) {
    const start = Date.now();
    let attempts = 0;

    while (Date.now() - start < timeoutMs) {
      attempts += 1;
      const res = await this.api.listEvents({ type: eventType, limit: 20 });

      if (res.status === 200 && Array.isArray(/** @type {any} */ (res.body).data)) {
        const events = /** @type {Array<Record<string, any>>} */ (
          /** @type {any} */ (res.body).data
        );
        const match = events.find(
          (evt) => evt?.data?.object?.id === objectId || evt?.data?.object?.payment_intent === objectId,
        );
        if (match) {
          this.logger.info(`Found event ${eventType} for ${objectId} after ${attempts} polls`);
          return match;
        }
      }

      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    throw new Error(
      `Timed out after ${timeoutMs}ms waiting for event "${eventType}" on object ${objectId}`,
    );
  }

  /**
   * Convenience: wait for multiple event types for the same object.
   *
   * @param {string[]} eventTypes
   * @param {Object} options
   * @param {string} options.objectId
   * @param {number} [options.timeoutMs]
   * @returns {Promise<Record<string, Record<string, unknown>>>}
   */
  async waitForEvents(eventTypes, { objectId, timeoutMs = 30_000 }) {
    /** @type {Record<string, Record<string, unknown>>} */
    const result = {};
    for (const type of eventTypes) {
      result[type] = await this.waitForEvent(type, { objectId, timeoutMs });
    }
    return result;
  }
}
