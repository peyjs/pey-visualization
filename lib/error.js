// Creates safe Bonyan errors at the pey.visualization plugin boundary.
// Raw chart-library errors never cross: they ride only in detail.cause.

import { ERROR_CODES, PLUGIN_NAME } from './constants.js';

const ERROR_TYPES = new Set(['startup', 'operational', 'critical']);
const ERROR_CODE_PATTERN = /^[A-Z][A-Z0-9_]*$/;

/**
 * Creates a standard Bonyan error owned by this plugin.
 *
 * @param {string} code Stable machine-readable error code.
 * @param {string} message Safe human-readable message.
 * @param {object} [detail] Machine-readable detail (cause keeps the original failure).
 * @param {'startup'|'operational'|'critical'} [type='operational'] Error category.
 * @returns {{code: string, message: string, source: string, type: string, timestamp: string, detail: object}}
 * @throws {TypeError} When the error type is unsupported.
 */
export function createVisualizationError(code, message, detail = {}, type = 'operational') {
  if (!ERROR_CODE_PATTERN.test(code)) {
    throw new TypeError(`Unsupported error code: ${code}`);
  }
  if (!ERROR_TYPES.has(type)) {
    throw new TypeError(`Unsupported Bonyan error type: ${type}`);
  }

  return {
    code,
    message,
    source: PLUGIN_NAME,
    type,
    timestamp: new Date().toISOString(),
    detail,
  };
}

/**
 * Builds a safe cause string for error details: chart-library messages are
 * kept for diagnosis, never shown to users.
 * @param {unknown} error Caught error.
 * @returns {string|undefined} Cause description, or undefined when absent.
 */
export function describeCause(error) {
  if (error === undefined || error === null) {
    return undefined;
  }
  if (typeof error?.message === 'string' && error.message.length > 0) {
    return error.message;
  }
  return String(error);
}

/**
 * Builds a structured error carrying the original failure in its detail.
 * @param {string} code Stable error code.
 * @param {string} message Log-safe message.
 * @param {unknown} cause Original error.
 * @returns {object} Structured error with `detail.cause`.
 */
export function mapWithCause(code, message, cause) {
  return createVisualizationError(code, message, { cause: describeCause(cause) });
}
