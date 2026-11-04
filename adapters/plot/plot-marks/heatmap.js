// Mark building for the heatmap family: one colored cell per (x, y) pair;
// the color scale from the value channel is the chart type's own
// computation, and Plot's color legend explains it.

import * as Plot from '@observablehq/plot';
import { bindDatum } from '../plot-interaction.js';

/**
 * Builds the marks for one heatmap chart.
 * @param {object} spec Chart spec (data.rows with x/y/value).
 * @returns {Array} Plot marks.
 */
export function buildHeatmapMarks(spec) {
  const rows = spec.data.rows;
  return [Plot.cell(rows, bindDatum({
    x: 'x',
    y: 'y',
    fill: 'value',
    inset: 0.5,
  }, rows))];
}

/**
 * Family-level scale hints: the heatmap explains its color scale.
 * @param {object} spec Chart spec.
 * @returns {object} Extra Plot options.
 */
export function heatmapScaleHints(spec) {
  void spec;
  return { color: { legend: true } };
}
