// @ts-check
import { Logger } from '../utils/logger.js';

/**
 * Base class for every Page Object.
 * Holds the Page instance, exposes a logger, and provides shared
 * helpers that every page may use (navigation, screenshotting, etc.).
 *
 * Subclasses should:
 *  - declare their own selectors as readonly locator getters in the constructor
 *  - expose verbs (loginWith, openPayment, refund) — not implementation details
 *  - return `this` (or the next Page Object) to enable method chaining
 */
export class BasePage {
  /**
   * @param {import('@playwright/test').Page} page
   * @param {string} [pageName]
   */
  constructor(page, pageName) {
    /** @type {import('@playwright/test').Page} */
    this.page = page;
    this.logger = new Logger(pageName ?? this.constructor.name);
  }

  /**
   * Navigate to a path relative to the base URL.
   * @param {string} url
   * @returns {Promise<this>}
   */
  async goto(url) {
    this.logger.info(`Navigating to ${url}`);
    await this.page.goto(url, { waitUntil: 'domcontentloaded' });
    return this;
  }

  /**
   * Take a screenshot and attach it to the Allure report.
   * @param {string} name
   * @returns {Promise<Buffer>}
   */
  async takeScreenshot(name) {
    return this.page.screenshot({ fullPage: true, path: undefined }).then((buffer) => {
      this.logger.info(`Screenshot taken: ${name}`);
      return buffer;
    });
  }

  /**
   * @returns {Promise<string>}
   */
  async currentUrl() {
    return this.page.url();
  }
}
