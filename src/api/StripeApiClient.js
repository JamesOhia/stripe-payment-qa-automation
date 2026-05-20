// @ts-check
import { request as playwrightRequest } from '@playwright/test';
import { env } from '../utils/env.js';
import { Logger } from '../utils/logger.js';

/**
 * @typedef {Object} PaymentIntentParams
 * @property {number} amount - Amount in the smallest currency unit (e.g. cents)
 * @property {string} currency - 3-letter ISO currency code
 * @property {string} [customer]
 * @property {string} [paymentMethod]
 * @property {string} [description]
 * @property {Record<string, string>} [metadata]
 * @property {boolean} [confirm]
 * @property {string} [paymentMethodType]
 */

/**
 * @typedef {Object} PaymentMethodCardParams
 * @property {string} [token] - Stripe test token (e.g. tok_visa). Preferred over raw card data.
 * @property {string} [number]
 * @property {number} [expMonth]
 * @property {number} [expYear]
 * @property {string} [cvc]
 * @property {string} [description]
 */

/**
 * @typedef {Object} StripeResponse
 * @property {number} status
 * @property {Record<string, unknown>} body
 * @property {Record<string, string>} headers
 */

/**
 * Strongly-typed client over the Stripe REST API using Playwright's APIRequestContext.
 * Using Playwright's request (rather than fetch / stripe-node) gives us:
 *  - Built-in tracing and HAR capture for Allure attachments
 *  - Consistent timeouts with the rest of the suite
 *  - Auto-retries on network errors
 *
 * Every method returns a structured StripeResponse so test specs can assert
 * on status codes, response shape, and headers without coupling to a SDK.
 */
export class StripeApiClient {
  constructor() {
    this.baseUrl = env.stripeApiBaseUrl;
    this.secretKey = env.stripeSecretKey;
    this.apiVersion = env.stripeApiVersion;
    this.logger = new Logger('StripeApiClient');
    /** @type {import('@playwright/test').APIRequestContext | null} */
    this.context = null;
  }

  /** Lazy-initialise the request context once per client instance. */
  async _ctx() {
    if (!this.context) {
      this.context = await playwrightRequest.newContext({
        // No baseURL — paths are always built as full URLs via _post/_get to
        // avoid Playwright's URL resolution stripping the /v1 path segment when
        // a leading-slash path like /payment_intents is combined with a baseURL
        // of https://api.stripe.com/v1 (no trailing slash).
        extraHTTPHeaders: {
          Authorization: `Bearer ${this.secretKey}`,
          'Stripe-Version': this.apiVersion,
        },
      });
    }
    return this.context;
  }

  /**
   * Stripe expects `application/x-www-form-urlencoded` with bracket notation
   * for nested objects (e.g. `metadata[test_run_id]=abc`).
   *
   * @param {Record<string, unknown>} obj
   * @param {string} [prefix]
   * @returns {Record<string, string>}
   */
  _toFormParams(obj, prefix) {
    /** @type {Record<string, string>} */
    const out = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value === undefined || value === null) continue;
      const k = prefix ? `${prefix}[${key}]` : key;
      if (typeof value === 'object' && !Array.isArray(value)) {
        Object.assign(out, this._toFormParams(/** @type {Record<string, unknown>} */(value), k));
      } else {
        out[k] = String(value);
      }
    }
    return out;
  }

  /**
   * @param {string} path
   * @param {Record<string, unknown>} [form]
   * @returns {Promise<StripeResponse>}
   */
  async _post(path, form = {}) {
    const ctx = await this._ctx();
    const params = this._toFormParams(form);
    this.logger.info(`POST ${path} ${JSON.stringify(params)}`);
    const res = await ctx.post(`${this.baseUrl}${path}`, { form: params });
    return this._unwrap(res);
  }

  /**
   * @param {string} path
   * @param {Record<string, string | number>} [query]
   * @returns {Promise<StripeResponse>}
   */
  async _get(path, query = {}) {
    const ctx = await this._ctx();
    this.logger.info(`GET ${path} ${JSON.stringify(query)}`);
    const res = await ctx.get(`${this.baseUrl}${path}`, { params: query });
    return this._unwrap(res);
  }

  /**
   * @param {import('@playwright/test').APIResponse} res
   * @returns {Promise<StripeResponse>}
   */
  async _unwrap(res) {
    /** @type {Record<string, unknown>} */
    let body = {};
    try {
      body = await res.json();
    } catch {
      body = { raw: await res.text() };
    }
    return {
      status: res.status(),
      body,
      headers: res.headers(),
    };
  }

  // ===============================================================
  // PaymentMethods
  // ===============================================================

  /**
   * Create a card PaymentMethod using raw card data.
   * Note: In production Stripe disallows raw card data on the API; in test mode it works.
   *
   * @param {PaymentMethodCardParams} card
   * @returns {Promise<StripeResponse>}
   */
  async createCardPaymentMethod(card) {
    // Use a test token when available — Stripe requires raw card data APIs to be
    // explicitly enabled on the account, but test tokens work on all test accounts.
    const cardBody = card.token
      ? { token: card.token }
      : {
          number: card.number,
          exp_month: card.expMonth,
          exp_year: card.expYear,
          cvc: card.cvc,
        };
    return this._post('/payment_methods', { type: 'card', card: cardBody });
  }

  // ===============================================================
  // PaymentIntents
  // ===============================================================

  /**
   * @param {PaymentIntentParams} params
   * @returns {Promise<StripeResponse>}
   */
  async createPaymentIntent(params) {
    /** @type {Record<string, unknown>} */
    const body = {
      amount: params.amount,
      currency: params.currency,
    };
    if (params.customer) body.customer = params.customer;
    if (params.description) body.description = params.description;
    if (params.metadata) body.metadata = params.metadata;
    if (params.paymentMethod) body.payment_method = params.paymentMethod;
    if (params.confirm !== undefined) body.confirm = params.confirm;
    if (params.paymentMethodType) {
      body['payment_method_types[]'] = params.paymentMethodType;
    } else {
      body['payment_method_types[]'] = 'card';
    }
    return this._post('/payment_intents', body);
  }

  /**
   * @param {string} paymentIntentId
   * @param {string} paymentMethodId
   * @param {string} [returnUrl]
   * @returns {Promise<StripeResponse>}
   */
  async confirmPaymentIntent(paymentIntentId, paymentMethodId, returnUrl) {
    /** @type {Record<string, unknown>} */
    const body = { payment_method: paymentMethodId };
    if (returnUrl) body.return_url = returnUrl;
    return this._post(`/payment_intents/${paymentIntentId}/confirm`, body);
  }

  /**
   * @param {string} paymentIntentId
   * @returns {Promise<StripeResponse>}
   */
  async retrievePaymentIntent(paymentIntentId) {
    return this._get(`/payment_intents/${paymentIntentId}`);
  }

  /**
   * @param {Record<string, string | number>} [query]
   * @returns {Promise<StripeResponse>}
   */
  async listPaymentIntents(query = {}) {
    return this._get('/payment_intents', query);
  }

  /**
   * @param {string} paymentIntentId
   * @returns {Promise<StripeResponse>}
   */
  async cancelPaymentIntent(paymentIntentId) {
    return this._post(`/payment_intents/${paymentIntentId}/cancel`);
  }

  // ===============================================================
  // Refunds
  // ===============================================================

  /**
   * @param {Object} params
   * @param {string} params.paymentIntent
   * @param {number} [params.amount] - For partial refunds (in smallest currency unit)
   * @param {string} [params.reason]  - 'duplicate' | 'fraudulent' | 'requested_by_customer'
   * @param {Record<string, string>} [params.metadata]
   * @returns {Promise<StripeResponse>}
   */
  async createRefund(params) {
    /** @type {Record<string, unknown>} */
    const body = { payment_intent: params.paymentIntent };
    if (params.amount !== undefined) body.amount = params.amount;
    if (params.reason) body.reason = params.reason;
    if (params.metadata) body.metadata = params.metadata;
    return this._post('/refunds', body);
  }

  /**
   * @param {string} refundId
   * @returns {Promise<StripeResponse>}
   */
  async retrieveRefund(refundId) {
    return this._get(`/refunds/${refundId}`);
  }

  /**
   * @param {Record<string, string | number>} [query]
   * @returns {Promise<StripeResponse>}
   */
  async listRefunds(query = {}) {
    return this._get('/refunds', query);
  }

  // ===============================================================
  // Customers
  // ===============================================================

  /**
   * @param {Object} params
   * @param {string} params.email
   * @param {string} [params.name]
   * @param {string} [params.description]
   * @param {Record<string, string>} [params.metadata]
   * @returns {Promise<StripeResponse>}
   */
  async createCustomer(params) {
    return this._post('/customers', params);
  }

  // ===============================================================
  // Events (used as the webhook verification mechanism)
  // ===============================================================

  /**
   * Stripe records every event triggered by API actions in /v1/events.
   * Polling this endpoint gives us a deterministic, CI-friendly way to
   * verify "the webhook fired" — without needing a public URL.
   *
   * @param {Record<string, string | number>} [query]
   * @returns {Promise<StripeResponse>}
   */
  async listEvents(query = {}) {
    return this._get('/events', query);
  }

  /**
   * @param {string} eventId
   * @returns {Promise<StripeResponse>}
   */
  async retrieveEvent(eventId) {
    return this._get(`/events/${eventId}`);
  }

  /** Cleanup the request context. Call from `afterAll`. */
  async dispose() {
    if (this.context) {
      await this.context.dispose();
      this.context = null;
    }
  }
}
