// @ts-check
import { expect } from '@playwright/test';
import { BasePage } from './BasePage.js';
import { DashboardPage } from './DashboardPage.js';
import { env } from '../utils/env.js';

/**
 * Stripe Dashboard sign-in page.
 *
 * IMPORTANT: For reliable automation against the dashboard, the test
 * Stripe account should have two-step authentication DISABLED.
 * (Profile → Security → Disable.)
 *
 * Locator strategy:
 *  - getByLabel / getByPlaceholder for form fields (Stripe labels are accessible)
 *  - getByRole('button', { name: ... }) for actions
 *  - getByText only as a fallback, never for primary actions
 */
export class LoginPage extends BasePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    super(page, 'LoginPage');

    this.emailInput = page.getByLabel(/Email/i);
    this.passwordInput = page.getByLabel(/Password/i);
    this.continueButton = page.getByRole('button', { name: /continue|next/i });
    this.signInButton = page.getByRole('button', { name: /sign in|log in/i });
    this.errorMessage = page.getByRole('alert');
  }

  /**
   * Navigate to the dashboard login screen.
   * @returns {Promise<this>}
   */
  async goto() {
    await super.goto(`${env.dashboardUrl}/login`);
    await expect(this.emailInput).toBeVisible();
    return this;
  }

  /**
   * Enter credentials and submit.
   * Returns a DashboardPage instance to enable chaining:
   *   `await new LoginPage(page).goto().then(p => p.loginWith(creds))`
   *
   * @param {Object} credentials
   * @param {string} credentials.email
   * @param {string} credentials.password
   * @returns {Promise<DashboardPage>}
   */
  async loginWith({ email, password }) {
    this.logger.info(`Signing in as ${email}`);

    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);

    // Stripe occasionally uses a single Continue button (email-first) vs a
    // single Sign-in button. Click whichever is enabled.
    if (await this.signInButton.isVisible().catch(() => false)) {
      await this.signInButton.click();
    } else {
      await this.continueButton.click();
    }

    await this.page.waitForURL(/dashboard\.stripe\.com\/(test\/)?(dashboard|payments|home)/, {
      timeout: 30_000,
    });

    return new DashboardPage(this.page);
  }

  /**
   * Convenience: log in using the environment-configured account.
   * Requires STRIPE_DASHBOARD_EMAIL and STRIPE_DASHBOARD_PASSWORD to be set.
   * @returns {Promise<DashboardPage>}
   */
  async loginWithEnvCredentials() {
    if (!env.dashboardEmail || !env.dashboardPassword) {
      throw new Error(
        'STRIPE_DASHBOARD_EMAIL and STRIPE_DASHBOARD_PASSWORD must be set to use loginWithEnvCredentials. ' +
          'For bot-detection-safe login, use `npm run save-auth` instead.'
      );
    }
    return this.loginWith({ email: env.dashboardEmail, password: env.dashboardPassword });
  }
}
