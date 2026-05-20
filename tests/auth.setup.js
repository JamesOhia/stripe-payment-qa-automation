// @ts-check
/**
 * Playwright setup project — runs once before all UI/e2e tests.
 *
 * Session strategy (CAPTCHA-proof):
 *
 *   Local dev   → auth/dashboard.json already exists (created by `npm run save-auth`).
 *                 The script verifies the session is still live; if expired it tells
 *                 you to re-run save-auth.
 *
 *   CI (GitHub) → STRIPE_AUTH_STATE secret holds the base64-encoded contents of
 *                 auth/dashboard.json.  This setup step decodes it, writes the file,
 *                 then verifies the session before the real tests run.
 *
 * When a session expires (Stripe sessions last ~weeks):
 *   1. Run `npm run save-auth` locally.
 *   2. Copy the printed base64 string into the STRIPE_AUTH_STATE GitHub Secret.
 *   3. Re-run CI — no code change needed.
 */

import { test as setup, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUTH_FILE = path.resolve(__dirname, '..', '.auth', 'stripe-auth-state.json');
const DASHBOARD_URL = process.env.STRIPE_DASHBOARD_URL ?? 'https://dashboard.stripe.com';

setup('load and verify Stripe dashboard session', async ({ page }) => {
  // ── 1. Decode auth state from CI secret when present ──────────────────────
  const encodedState = process.env.STRIPE_AUTH_STATE;
  if (encodedState) {
    fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });
    fs.writeFileSync(AUTH_FILE, Buffer.from(encodedState, 'base64').toString('utf8'), 'utf8');
  }

  // ── 2. Fail fast if no auth file exists at all ────────────────────────────
  if (!fs.existsSync(AUTH_FILE)) {
    throw new Error(
      '\n\nNo Stripe Dashboard session found.\n' +
        'Run `npm run save-auth` locally: a real browser opens without automation signals,\n' +
        'you log in manually (solving any CAPTCHA), press ENTER, and the script saves\n' +
        '.auth/stripe-auth-state.json.\n' +
        'Then copy the printed base64 string into the STRIPE_AUTH_STATE GitHub Secret.\n'
    );
  }

  // ── 3. Apply the persisted cookies to this browser context ────────────────
  /** @type {{ cookies: import('@playwright/test').Cookie[], origins: Array<{origin: string, localStorage: Array<{name: string, value: string}>}> }} */
  const state = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8'));
  await page.context().addCookies(state.cookies ?? []);

  // Restore localStorage entries so Stripe's SPA state is fully hydrated.
  // We must navigate to the origin first before we can write localStorage.
  await page.goto(DASHBOARD_URL, { waitUntil: 'domcontentloaded' });
  for (const { origin, localStorage } of state.origins ?? []) {
    if (origin.includes('stripe.com') && localStorage.length > 0) {
      await page.evaluate(
        ({ entries }) => {
          for (const { name, value } of entries) {
            try {
              window.localStorage.setItem(name, value);
            } catch (_) {
              // Storage quota exceeded for a single entry — skip it
            }
          }
        },
        { entries: localStorage }
      );
    }
  }

  // ── 4. Navigate to the dashboard and verify the session is still live ─────
  await page.goto(`${DASHBOARD_URL}/dashboard`, { waitUntil: 'domcontentloaded' });

  const currentUrl = page.url();
  if (/\/login/.test(currentUrl)) {
    // Remove the stale file so a re-run gives a clearer error (step 2 above)
    fs.unlinkSync(AUTH_FILE);
    throw new Error(
      '\n\nStripe Dashboard session has expired.\n' +
        'Run `npm run save-auth` locally to capture a fresh session, then:\n' +
        '  • Locally : re-run the tests (auth/dashboard.json is refreshed)\n' +
        '  • CI      : update the STRIPE_AUTH_STATE GitHub Secret with the new base64 value\n'
    );
  }

  await expect(page).not.toHaveURL(/\/login/);
  // auth/dashboard.json is valid — downstream ui/e2e projects load it via storageState config
});
