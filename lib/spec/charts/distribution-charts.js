// Validation for the distribution family: histogram, density (one numeric
// channel) and boxPlot (value per category row — the quartile and outlier
// computation is the chart type's own, done at render time).

import { readChannel, readFinite, requireRowObject, requireRows } from './series-charts.js';

/**
 * Validates distribution-family data into canonical rows.
 * @param {unknown} data Host data (array or { rows }).
 * @param {object} channels Resolved channel field names ({ x, y }).
 * @param {string} type Chart type.
 * @returns {{rows: Array, seriesIds: null}} Normalized spec data.
 * @throws {object} VIS_INVALID_DATA.
 */
export function validateDistributionData(data, channels, type) {
  const rows = requireRows(data, type);
  const normalized = [];
  rows.forEach((row, index) => {
    requireRowObject(row, index, type);
    if (type === 'boxPlot') {
      const category = readChannel(row, channels.x, index, type);
      const value = readFinite(row, channels.y, index, type);
      normalized.push({ x: category, y: value });
      return;
    }
    // histogram and density work on one numeric channel.
    const value = readFinite(row, channels.x, index, type);
    normalized.push({ x: value, y: null });
  });
  return { rows: normalized, seriesIds: null };
}
