// Validation for the heatmap family: a value per (x, y) cell pair. The
// color scale from values is the chart type's own computation.

import { readChannel, readFinite, requireRowObject, requireRows } from './series-charts.js';

/**
 * Validates heatmap data into canonical rows.
 * @param {unknown} data Host data (array or { rows }).
 * @param {object} channels Resolved channel field names ({ x, y, value }).
 * @param {string} type Chart type.
 * @returns {{rows: Array, seriesIds: null}} Normalized spec data.
 * @throws {object} VIS_INVALID_DATA.
 */
export function validateHeatmapData(data, channels, type) {
  const rows = requireRows(data, type);
  const normalized = [];
  rows.forEach((row, index) => {
    requireRowObject(row, index, type);
    const x = readChannel(row, channels.x, index, type);
    const y = readChannel(row, channels.y, index, type);
    const value = readFinite(row, channels.value, index, type);
    normalized.push({ x, y, value });
  });
  return { rows: normalized, seriesIds: null };
}
