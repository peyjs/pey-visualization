// Mark building for the series family: line, timeSeries, area,
// stackedArea. Plot stacks barY/areaY implicitly when the fill channel is
// mapped, so stackedArea is an areaY with the series fill.

import * as Plot from '@observablehq/plot';
import { bindDatum } from '../plot-interaction.js';

/**
 * Builds the marks for one series-family chart.
 * @param {object} spec Chart spec (type, data.rows with canonical x/y/series).
 * @returns {Array} Plot marks.
 */
export function buildSeriesMarks(spec) {
  const rows = spec.data.rows;
  const hasSeries = rows.some((row) => row.series !== null);
  const seriesField = hasSeries ? 'series' : undefined;
  const isTemporal = rows.length > 0 && rows.every((row) => row.x instanceof Date);

  switch (spec.type) {
    case 'line':
    case 'timeSeries':
      return [Plot.line(rows, bindDatum({
        x: 'x',
        y: 'y',
        stroke: seriesField,
        markerEnd: hasSeries ? undefined : 'circle',
      }, rows, false))];
    case 'area':
      return [Plot.area(rows, {
        x: 'x',
        y1: 0,
        y2: 'y',
        fill: seriesField,
      })];
    case 'stackedArea':
      return [Plot.areaY(rows, bindDatum({
        x: 'x',
        y: 'y',
        fill: 'series',
      }, rows, false))];
    default:
      return [];
  }
}

/**
 * Family-level scale hints: timeSeries wants a time x-scale.
 * @param {object} spec Chart spec.
 * @returns {object} Extra Plot scale options.
 */
export function seriesScaleHints(spec) {
  if (spec.type === 'timeSeries') {
    return { x: { type: 'time' } };
  }
  return {};
}
