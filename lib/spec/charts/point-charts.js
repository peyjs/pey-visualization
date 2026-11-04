// Validation for the point family: scatter, bubble, dot. Scatter and dot
// carry (x, y); bubble additionally needs a numeric size channel.

import { readChannel, readFinite, requireRowObject, requireRows } from './series-charts.js';

/**
 * Validates point-family data into canonical rows. Bubble needs the size
 * channel on every row (a declared name or the default `size`).
 * @param {unknown} data Host data (array or { rows }).
 * @param {object} channels Resolved channel field names ({ x, y, size }).
 * @param {string} type Chart type.
 * @returns {{rows: Array, seriesIds: null}} Normalized spec data.
 * @throws {object} VIS_INVALID_DATA.
 */
export function validatePointData(data, channels, type) {
  const needsSize = type === 'bubble';
  const rows = requireRows(data, type);
  const normalized = [];
  rows.forEach((row, index) => {
    requireRowObject(row, index, type);
    const x = readChannel(row, channels.x, index, type);
    const y = readFinite(row, channels.y, index, type);
    const size = needsSize ? readFinite(row, channels.size, index, type) : null;
    normalized.push({ x, y, size });
  });
  return { rows: normalized, seriesIds: null };
}
