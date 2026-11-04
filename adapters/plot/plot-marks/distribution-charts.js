// Mark building for the distribution family: histogram (binning is the
// chart type's own computation), boxPlot (quartiles/outliers computed by
// the mark) and density (kernel smoothing over the 2-D cloud).

import * as Plot from '@observablehq/plot';
import { bindDatum } from '../plot-interaction.js';

/**
 * Builds the marks for one distribution-family chart.
 * @param {object} spec Chart spec (type, data.rows).
 * @returns {Array} Plot marks.
 */
export function buildDistributionMarks(spec) {
  const rows = spec.data.rows;

  switch (spec.type) {
    case 'histogram':
      return [Plot.rectY(rows, bindDatum(Plot.binX({ y: 'count' }, { x: 'x' }), rows))];
    case 'boxPlot':
      return [Plot.boxY(rows, { x: 'x', y: 'y' })];
    case 'density':
      return [Plot.density(rows, { x: 'x', y: 'y', fill: 'density' })];
    default:
      return [];
  }
}

/**
 * Family-level scale hints: none — the marks define their own axes.
 * @returns {object} Extra Plot scale options.
 */
export function distributionScaleHints() {
  return {};
}
