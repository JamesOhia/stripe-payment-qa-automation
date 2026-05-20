// @ts-check
/* eslint-disable no-console */

/**
 * Minimal logger that prefixes messages with a tag and timestamp.
 * Avoid pulling in winston/pino for an assessment — keep it lean.
 */
export class Logger {
  /** @param {string} tag */
  constructor(tag) {
    this.tag = tag;
  }

  /** @param {string} message */
  info(message) {
    console.log(`[${new Date().toISOString()}] [INFO] [${this.tag}] ${message}`);
  }

  /** @param {string} message */
  warn(message) {
    console.warn(`[${new Date().toISOString()}] [WARN] [${this.tag}] ${message}`);
  }

  /** @param {string} message @param {unknown} [error] */
  error(message, error) {
    console.error(`[${new Date().toISOString()}] [ERROR] [${this.tag}] ${message}`);
    if (error) {
      console.error(error);
    }
  }
}
