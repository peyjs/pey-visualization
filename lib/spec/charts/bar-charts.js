// Validation for the bar family: bar (vertical/horizontal), groupedBar,
// stackedBar. Category rows carry (x = category, y = value); the grouped
// and stacked variants read the optional series membership per row —
// without it they degrade to a plain single-series bar.

import { readChannel, readFinite, readOptionalSeries, readScalar, requireRowObject, requireRows } from './series-charts.js';
/**
 * Validates bar-family data into canonical rows.
 * @param {unknown} data Host data (array or { rows }).
 * @param {object} channels Resolved channel field names ({ x, y, series }).
 * @param {string} type Chart type.
 * @returns {{rows: Array, seriesIds: Array|null}} Normalized spec data.
 * @throws {object} VIS_INVALID_DATA.
 */
export function validateBarData(data, channels, type) {
  const supportsSeries = type !== 'bar';
  const seriesRequired = type === 'groupedBar' || type === 'stackedBar';
  const rows = requireRows(data, type);
  const seen = new Map();
  const normalized = [];
  rows.forEach((row, index) => {
    requireRowObject(row, index, type);
    const category = readChannel(row, channels.x, index, type);
    const value = readFinite(row, channels.y, index, type);
    let seriesId = null;
    if (supportsSeries) {
      seriesId = seriesRequired
        ? readScalar(row, channels.series, index, type)
        : readOptionalSeries(row, channels.series, index, type);
    }
    if (seriesId !== null && !seen.has(seriesId)) {
      seen.set(seriesId, seen.size);
    }
    normalized.push({ x: category, y: value, series: seriesId });
  });
  return { rows: normalized, seriesIds: seen.size > 0 ? [...seen.keys()] : null };
}
