// Mark building for the bar family: bar (vertical or horizontal per the
// options), groupedBar (series faceting) and stackedBar (implicit stacking
// through the series fill).

import * as Plot from '@observablehq/plot';
import { bindDatum } from '../plot-interaction.js';

/**
 * Builds the marks for one bar-family chart.
 * @param {object} spec Chart spec (type, orientation?, data.rows).
 * @returns {Array} Plot marks.
 */
export function buildBarMarks(spec) {
  const rows = spec.data.rows;
  const horizontal = spec.orientation === 'horizontal';

  switch (spec.type) {
    case 'bar':
      return [horizontal
        ? Plot.barX(rows, bindDatum({ x: 'y', y: 'x' }, rows))
        : Plot.barY(rows, bindDatum({ x: 'x', y: 'y' }, rows))];
    case 'groupedBar':
      return [horizontal
        ? Plot.barX(rows, bindDatum({ fy: 'series', x: 'y', y: 'x', fill: 'series' }, rows))
        : Plot.barY(rows, bindDatum({ fx: 'series', x: 'x', y: 'y', fill: 'series' }, rows))];
    case 'stackedBar':
      return [horizontal
        ? Plot.barX(rows, bindDatum({ x: 'y', y: 'x', fill: 'series' }, rows))
        : Plot.barY(rows, bindDatum({ x: 'x', y: 'y', fill: 'series' }, rows))];
    default:
      return [];
  }
}

/**
 * Family-level scale hints: horizontal bars swap the numeric axis to x.
 * @param {object} spec Chart spec.
 * @returns {object} Extra Plot scale options.
 */
export function barScaleHints(spec) {
  if (spec.type === 'bar' && spec.orientation === 'horizontal') {
    return { x: { grid: true }, y: { grid: false } };
  }
  return {};
}
