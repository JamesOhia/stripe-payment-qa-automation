// @ts-check
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../data');

/**
 * Generic JSON loader that fails loudly with a clear message if a file is missing
 * or malformed. Keeps all test data in /data and out of test code.
 *
 * @template T
 * @param {string} fileName - Name of the JSON file inside /data (e.g. "test-cards.json")
 * @returns {T}
 */
export function loadJson(fileName) {
  const filePath = path.join(DATA_DIR, fileName);
  try {
    const raw = readFileSync(filePath, 'utf-8');
    return /** @type {T} */ (JSON.parse(raw));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to load test data from ${filePath}: ${message}`);
  }
}

/**
 * @typedef {Object} TestCard
 * @property {string} [token] - Stripe test token (e.g. tok_visa); preferred over raw card fields
 * @property {string} [number]
 * @property {number} [expMonth]
 * @property {number} [expYear]
 * @property {string} [cvc]
 * @property {string} description
 */

/**
 * @typedef {Object} TestAmount
 * @property {number} amount
 * @property {string} currency
 * @property {string} display
 */

/**
 * @typedef {Object} TestCustomer
 * @property {string} email
 * @property {string} name
 * @property {string} description
 * @property {Object} [address]
 * @property {Record<string, string>} [metadata]
 */

/** @returns {Record<string, TestCard>} */
export const loadTestCards = () => loadJson('test-cards.json');

/** @returns {Record<string, TestAmount>} */
export const loadTestAmounts = () => loadJson('test-amounts.json');

/** @returns {Record<string, TestCustomer>} */
export const loadTestCustomers = () => loadJson('test-customers.json');
