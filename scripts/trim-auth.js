// scripts/trim-auth.js
// @ts-check
/**
 * One-shot utility: strips non-Stripe cookies from an oversized
 * .auth/stripe-auth-state.json and re-encodes it for GitHub Secrets.
 *
 * Run this if `npm run save-auth` produced a base64 that GitHub rejects
 * with "Value is too large" (happens when other tabs were open in Chrome).
 *
 * Usage:
 *   node scripts/trim-auth.js
 */

import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const authFile = path.resolve(__dirname, '../.auth/stripe-auth-state.json');

/** Keep only cookies that belong to Stripe's domains. */
const STRIPE_DOMAIN_PATTERN = /stripe\.com$/;

let raw;
try {
  raw = readFileSync(authFile, 'utf8');
} catch {
  console.error(`[trim-auth] ERROR: Cannot read ${authFile}`);
  console.error('  Run `npm run save-auth` first to capture a session.');
  process.exit(1);
}

/** @type {{ cookies: Array<{ domain: string }>, origins: unknown[] }} */
const state = JSON.parse(raw);

const before = state.cookies.length;
state.cookies = state.cookies.filter((c) => STRIPE_DOMAIN_PATTERN.test(c.domain));
const after = state.cookies.length;

if (after === 0) {
  console.error('[trim-auth] ERROR: No Stripe cookies found after filtering.');
  console.error('  The session may have expired — re-run `npm run save-auth`.');
  process.exit(1);
}

const trimmed = JSON.stringify(state);
writeFileSync(authFile, trimmed, 'utf8');

const encoded = Buffer.from(trimmed).toString('base64');

console.log(`\n✓ Trimmed: ${before} cookies → ${after} Stripe cookies`);
console.log(`  File updated: ${authFile}`);
console.log(`  Encoded size: ${encoded.length} chars (GitHub limit: ~65 000)\n`);
console.log('=== GitHub Secret (copy everything between the lines) ===');
process.stdout.write('------------------------------------------------------------\n');
process.stdout.write(encoded + '\n');
process.stdout.write('------------------------------------------------------------\n');
console.log('\nPaste the value above as the STRIPE_AUTH_STATE GitHub Secret:');
console.log('  GitHub repo → Settings → Secrets and variables → Actions → New repository secret');
console.log('  Name : STRIPE_AUTH_STATE');
console.log('  Value: <paste the base64 string above>\n');
