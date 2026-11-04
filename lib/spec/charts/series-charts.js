// Validation for the series family: line, timeSeries, area, stackedArea.
// Normalized output rows carry canonical fields (x, y, series) regardless
// of the host's field names.

import { createVisualizationError } from '../../error.js';

/**
 * Reads an optional series membership value: a row may carry it or not.
 * @param {object} row Row.
 * @param {string} field Host field name.
 * @param {number} index Row position.
 * @param {string} type Chart type.
 * @returns {string|null} Series id, or null when the row has none.
 * @throws {object} VIS_INVALID_DATA.
 */
export function readOptionalSeries(row, field, index, type) {
  if (row[field] === undefined) {
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
    const x = readChannel(row, channels.x, index, type);
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
 * Reads a channel value (any scalar the host prepared).
 * @param {object} row Row.
 * @param {string} field Host field name.
 * @param {number} index Row position.
 * @param {string} type Chart type.
 * @returns {string|number|Date} Channel value.
 * @throws {object} VIS_INVALID_DATA.
 */
export function readChannel(row, field, index, type) {
  const value = row[field];
  if (value === undefined || value === null || typeof value === 'boolean' || typeof value === 'object') {
    throw createVisualizationError(
      'VIS_INVALID_DATA',
      `Row is missing the "${field}" channel`,
      { type, reason: 'missing-channel', field, index },
    );
  }
  return value;
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
