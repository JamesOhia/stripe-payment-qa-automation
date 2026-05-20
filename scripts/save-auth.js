// scripts/save-auth.js
// @ts-check
/**
 * Captures an authenticated Stripe Dashboard session without triggering bot detection.
 *
 * How it works:
 *  1. Launches Google Chrome as a NORMAL OS process — no Playwright involvement,
 *     no --enable-automation flag, no CDP injected.  Stripe sees a real user.
 *  2. You log in manually in that window (solve any CAPTCHA, 2FA, etc.).
 *  3. Press ENTER here when you reach the dashboard.
 *  4. The script connects to the already-running Chrome via CDP (read-only)
 *     purely to extract the session cookies — no page interaction occurs.
 *  5. Saves .auth/stripe-auth-state.json and prints the base64 GitHub Secret.
 *
 * Usage:
 *   npm run save-auth
 *
 * Re-run when:
 *  - First-time setup
 *  - auth.setup.js reports "session expired"
 *  - You rotate your Stripe password
 */

import { chromium } from '@playwright/test';
import { exec } from 'child_process';
import { createInterface } from 'readline';
import path from 'path';
import fs from 'fs';
import process from 'process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const authDir = path.resolve(__dirname, '../.auth');
const authFile = path.join(authDir, 'stripe-auth-state.json');
const DEBUG_PORT = 9222;
// Use a dedicated temp profile so this never conflicts with your normal Chrome.
const TEMP_PROFILE = '/tmp/stripe-auth-capture';

if (!fs.existsSync(authDir)) {
  fs.mkdirSync(authDir, { recursive: true });
}

// ── 1. Launch Chrome as a plain OS process ────────────────────────────────────
// exec() fires Chrome and returns immediately — Playwright is NOT controlling it.
// Chrome starts with zero automation signals; Stripe cannot detect it as a bot.
const chromeArgs = [
  `--remote-debugging-port=${DEBUG_PORT}`,
  `--user-data-dir=${TEMP_PROFILE}`,
  'https://dashboard.stripe.com/login',
].join(' ');

const chromeBin =
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

console.log('\n[save-auth] Opening a clean Chrome window (no automation flags)...');
exec(`"${chromeBin}" ${chromeArgs}`, (err) => {
  // Chrome exits when the window is closed — this callback fires then, not now.
  if (err && !err.killed) console.error('[save-auth] Chrome exited:', err.message);
});

// Give Chrome ~2 s to start and open the debug port before we try to connect.
await new Promise((r) => setTimeout(r, 2000));

// ── 2. Wait for you to log in ─────────────────────────────────────────────────
console.log('[save-auth] Chrome is open on the Stripe login page.');
console.log('[save-auth] Log in manually — fill in your email, password,');
console.log('[save-auth] solve the CAPTCHA and any 2FA — then come back here.\n');

const rl = createInterface({ input: process.stdin, output: process.stdout });
await new Promise((resolve) =>
  rl.question('Press ENTER once you can see the Stripe sandbox dashboard: ', resolve)
);
rl.close();

// ── 3. Connect to the running Chrome via CDP (read-only) ──────────────────────
// Playwright connects as a DevTools client — it doesn't control or automate
// anything, it just reads the cookies from the already-authenticated session.
console.log('\n[save-auth] Connecting to Chrome to read session cookies...');
let browser;
try {
  browser = await chromium.connectOverCDP(`http://localhost:${DEBUG_PORT}`);
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(
    `\n[save-auth] ERROR: Could not connect to Chrome on port ${DEBUG_PORT}.\n` +
      `  Make sure the Chrome window opened by this script is still open.\n` +
      `  Details: ${message}\n`
  );
  process.exit(1);
}

const [context] = browser.contexts();
if (!context) {
  console.error('[save-auth] ERROR: No browser context found. Is Chrome still open?');
  await browser.close();
  process.exit(1);
}

// ── 4. Save the session state (Stripe cookies only) ──────────────────────────
// storageState() captures cookies from every open tab in the browser context.
// We filter to stripe.com domains so the base64 stays within GitHub Secrets'
// ~65 KB limit even when the user has other tabs open.
await context.storageState({ path: authFile });
await browser.close();

const raw = fs.readFileSync(authFile, 'utf8');
/** @type {{ cookies: Array<{ domain: string }>, origins: unknown[] }} */
const state = JSON.parse(raw);

const STRIPE_DOMAIN = /stripe\.com$/;
const allCookies = state.cookies ?? [];
state.cookies = allCookies.filter((c) => STRIPE_DOMAIN.test(c.domain));
const cookieCount = state.cookies.length;

if (cookieCount === 0) {
  console.error(
    '\n[save-auth] ERROR: No Stripe cookies captured — you may not be fully logged in.\n' +
      '  Re-run `npm run save-auth` and make sure you reach the dashboard before pressing ENTER.\n'
  );
  fs.unlinkSync(authFile);
  process.exit(1);
}

const trimmed = JSON.stringify(state);
fs.writeFileSync(authFile, trimmed, 'utf8');

const encoded = Buffer.from(trimmed).toString('base64');

console.log(`\n✓ Session saved to: ${authFile} (${cookieCount} Stripe cookies, ${allCookies.length - cookieCount} non-Stripe filtered out)`);
console.log('\n=== GitHub Secret (copy everything between the lines) ===');
process.stdout.write('------------------------------------------------------------\n');
process.stdout.write(encoded + '\n');
process.stdout.write('------------------------------------------------------------\n');
console.log('\nPaste the value above as the STRIPE_AUTH_STATE GitHub Secret:');
console.log('  GitHub repo → Settings → Secrets and variables → Actions → New repository secret');
console.log('  Name : STRIPE_AUTH_STATE');
console.log('  Value: <paste the base64 string above>\n');
