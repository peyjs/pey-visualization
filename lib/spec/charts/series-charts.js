// Validation for the series family: line, timeSeries, area, stackedArea.
// Normalized output rows carry canonical fields (x, y, series) regardless
// of the host's field names.

import { createVisualizationError } from '../../error.js';

/**
 * Reads an optional series membership value: a row may carry it or not.
 * An absent field AND an explicit null both mean "no series" — the two
 * spellings of the same intent must not diverge, and the validator's own
 * normalized output uses `series: null` for exactly this shape.
 * @param {object} row Row.
 * @param {string} field Host field name.
 * @param {number} index Row position.
 * @param {string} type Chart type.
 * @returns {string|null} Series id, or null when the row has none.
 * @throws {object} VIS_INVALID_DATA.
 */
export function readOptionalSeries(row, field, index, type) {
  const value = row[field];
  if (value === undefined || value === null) {
    return null;
  }
  return readScalar(row, field, index, type);
}

/**
 * Validates series-family data into canonical rows.
 * @param {unknown} data Host data (array or { rows }).
 * @param {object} channels Resolved channel field names ({ x, y, series }).
 * @param {string} type Chart type (for error detail).
 * @returns {{rows: Array, seriesIds: Array|null}} Normalized spec data.
 * @throws {object} VIS_INVALID_DATA.
 */
export function validateSeriesData(data, channels, type) {
  const rows = requireRows(data, type);
  const seriesRequired = type === 'stackedArea';
  const seen = new Map();
  const normalized = [];
  rows.forEach((row, index) => {
    requireRowObject(row, index, type);
    // The ONLY temporal channel of the whole contract: the series family's
    // x (docs grant dates there). Category, key and series-id reads stay
    // scalar-only — a Date there is an object identity, and series
    // identity keyed on it breaks on every update with fresh instances.
    const x = readChannel(row, channels.x, index, type, true);
    const y = readFinite(row, channels.y, index, type);
    const seriesId = seriesRequired
      ? readScalar(row, channels.series, index, type)
      : readOptionalSeries(row, channels.series, index, type);
    if (seriesId !== null && !seen.has(seriesId)) {
      seen.set(seriesId, seen.size);
    }
    normalized.push({ x, y, series: seriesId });
  });
  return { rows: normalized, seriesIds: seen.size > 0 ? [...seen.keys()] : null };
}

// --- shared row helpers (exported for the other family validators) -------

/**
 * Unwraps the host data into the flat row array.
 * @param {unknown} data Host data.
 * @param {string} type Chart type.
 * @returns {Array} Rows.
 * @throws {object} VIS_INVALID_DATA.
 */
export function requireRows(data, type) {
  const rows = Array.isArray(data) ? data : data?.rows;
  if (!Array.isArray(rows)) {
    throw createVisualizationError(
      'VIS_INVALID_DATA',
      'Chart data must be a row array or an object with a rows array',
      { type, reason: 'not-a-row-list' },
    );
  }
  return rows;
}

/**
 * Requires one row to be a plain object.
 * @param {unknown} row Candidate row.
 * @param {number} index Row position.
 * @param {string} type Chart type.
 * @throws {object} VIS_INVALID_DATA.
 */
export function requireRowObject(row, index, type) {
  if (row === null || typeof row !== 'object' || Array.isArray(row)) {
    throw createVisualizationError(
      'VIS_INVALID_DATA',
      'Every row must be an object',
      { type, reason: 'row-not-an-object', index },
    );
  }
}

/**
 * Reads a channel value (any scalar the host prepared). The accepted set
 * is a WHITELIST — number, string, plus a Date on TEMPORAL channels
 * (`allowDate`; the documented contract grants dates to the series
 * family's x). Everything else — boolean, object (a non-temporal Date
 * included), function, bigint, symbol — is present but unusable and must
 * be reported as `unsupported-channel-type`, NOT as an absent channel:
 * a blacklist of rejected types let function/bigint/symbol values slip
 * through to the renderer, where some rendered silently wrong and one
 * died inside Plot.plot as a raw VIS_RENDER_FAILED cause.
 * @param {object} row Row.
 * @param {string} field Host field name.
 * @param {number} index Row position.
 * @param {string} type Chart type.
 * @param {boolean} [allowDate] Whether this channel may carry a Date.
 * @returns {string|number|Date} Channel value.
 * @throws {object} VIS_INVALID_DATA.
 */
export function readChannel(row, field, index, type, allowDate = false) {
  const value = row[field];
  if (value === undefined || value === null) {
    throw createVisualizationError(
      'VIS_INVALID_DATA',
      `Row is missing the "${field}" channel`,
      { type, reason: 'missing-channel', field, index },
    );
  }
  const dateOk = allowDate && value instanceof Date;
  if (dateOk || typeof value === 'number' || typeof value === 'string') {
    return value;
  }
  throw createVisualizationError(
    'VIS_INVALID_DATA',
    `Row's "${field}" channel must be a scalar${allowDate ? ' or a Date' : ''}`,
    { type, reason: 'unsupported-channel-type', field, index },
  );
}

/**
 * Reads a numeric channel value.
 * @param {object} row Row.
 * @param {string} field Host field name.
 * @param {number} index Row position.
 * @param {string} type Chart type.
 * @returns {number} Finite number.
 * @throws {object} VIS_INVALID_DATA.
 */
export function readFinite(row, field, index, type) {
  const value = readChannel(row, field, index, type);
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw createVisualizationError(
      'VIS_INVALID_DATA',
      `The "${field}" channel must be a finite number`,
      { type, reason: 'channel-not-finite', field, index },
    );
  }
  return value;
}

/**
 * Reads a series membership value (string or number).
 * @param {object} row Row.
 * @param {string} field Host field name.
 * @param {number} index Row position.
 * @param {string} type Chart type.
 * @returns {string} Series id.
 * @throws {object} VIS_INVALID_DATA.
 */
export function readScalar(row, field, index, type) {
  const value = readChannel(row, field, index, type);
  return typeof value === 'number' ? String(value) : value;
}
