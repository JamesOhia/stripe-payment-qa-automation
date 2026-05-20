// @ts-check
import dotenv from 'dotenv';
dotenv.config();

/**
 * Strongly-typed access to required environment variables.
 * Throws at startup if any required variable is missing — fail loud, fail early.
 *
 * @param {string} name
 * @returns {string}
 */
function required(name) {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Copy .env.example to .env (locally) or configure GitHub Secrets (in CI).`,
    );
  }
  return value;
}

/**
 * @typedef {Object} EnvConfig
 * @property {string} stripeSecretKey
 * @property {string} stripePublishableKey
 * @property {string} stripeApiBaseUrl
 * @property {string} stripeApiVersion
 * @property {string} dashboardUrl
 * @property {string|undefined} dashboardEmail
 * @property {string|undefined} dashboardPassword
 */

/** @type {EnvConfig} */
export const env = {
  stripeSecretKey: required('STRIPE_SECRET_KEY'),
  stripePublishableKey: required('STRIPE_PUBLISHABLE_KEY'),
  stripeApiBaseUrl: process.env.STRIPE_API_BASE_URL ?? 'https://api.stripe.com/v1',
  stripeApiVersion: process.env.STRIPE_API_VERSION ?? '2024-12-18.acacia',
  dashboardUrl: process.env.STRIPE_DASHBOARD_URL ?? 'https://dashboard.stripe.com',
  // Optional: only needed if using the LoginPage automated-login path.
  // Normal test runs use storage state (auth.setup.js) — no credentials required.
  dashboardEmail: process.env.STRIPE_DASHBOARD_EMAIL || undefined,
  dashboardPassword: process.env.STRIPE_DASHBOARD_PASSWORD || undefined,
};
