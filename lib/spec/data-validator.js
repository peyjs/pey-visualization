// Dispatches data validation by chart type to its family validator, then
// hands back the normalized, library-neutral spec data. Empty data is not
// an error — an empty row list means the chart renders its empty state.

import { CHART_TYPES, ERROR_CODES } from '../constants.js';
import { createVisualizationError } from '../error.js';
import { validateBarData } from './charts/bar-charts.js';
import { validateDistributionData } from './charts/distribution-charts.js';
import { validateHeatmapData } from './charts/heatmap.js';
import { validatePointData } from './charts/point-charts.js';
import { validateSeriesData } from './charts/series-charts.js';

// Default host field names per channel; options may rename them.
export const DEFAULT_CHANNELS = Object.freeze({
  x: 'x',
  y: 'y',
  series: 'series',
  size: 'size',
  value: 'value',
});

const FAMILY_VALIDATORS = Object.freeze({
  series: validateSeriesData,
  bar: validateBarData,
  point: validatePointData,
  distribution: validateDistributionData,
  heatmap: validateHeatmapData,
});

/**
 * Resolves the family of a chart type.
 * @param {string} type Chart type.
 * @returns {string|null} Family key, or null for an unknown type.
 */
export function familyOf(type) {
  for (const [family, types] of Object.entries(CHART_TYPES)) {
    if (types.includes(type)) {
      return family;
    }
  }
  return null;
}

/**
 * Resolves the channel field names: host field names per channel, falling
 * back to the defaults. `channels` is the validated slice of options.
 * @param {object} [channels] Options channels slice.
 * @returns {object} Resolved channels (only the ones the host named).
 */
export function resolveChannels(channels) {
  const resolved = {};
  for (const [channel, field] of Object.entries(channels ?? {})) {
    if (typeof field === 'string' && field.length > 0 && Object.hasOwn(DEFAULT_CHANNELS, channel)) {
      resolved[channel] = field;
    }
  }
  return { ...DEFAULT_CHANNELS, ...resolved };
}

/**
 * Validates chart data for one type and returns the normalized spec data.
 * @param {string} type Chart type.
 * @param {unknown} data Host data.
 * @param {object} [channels] Resolved channel field names.
 * @returns {{rows: Array, seriesIds: Array|null}} Normalized spec data.
 * @throws {object} VIS_UNKNOWN_CHART_TYPE / VIS_INVALID_DATA.
 */
export function validateData(type, data, channels) {
  const family = familyOf(type);
  if (family === null) {
    throw createVisualizationError(
      ERROR_CODES.UNKNOWN_CHART_TYPE,
      'The requested chart type is not supported',
      { type },
    );
  }
  const validate = FAMILY_VALIDATORS[family];
  return validate(data, resolveChannels(channels), type);
}
