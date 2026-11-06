// Mark building for the point family: scatter, dot and bubble (a dot with
// a size channel driving the radius range).

import * as Plot from '@observablehq/plot';
import { bindDatum } from '../plot-interaction.js';
import { tipMark } from './tips.js';

/**
 * Builds the marks for one point-family chart.
 * @param {object} spec Chart spec (type, data.rows).
 * @returns {Array} Plot marks.
 */
export function buildPointMarks(spec) {
  const rows = spec.data.rows;

  switch (spec.type) {
    case 'scatter':
    case 'dot':
      return [
        Plot.dot(rows, bindDatum({ x: 'x', y: 'y' }, rows)),
        tipMark(rows, { pointer: 'near' }),
      ].filter(Boolean);
    case 'bubble':
      return [
        Plot.dot(rows, bindDatum({
          x: 'x',
          y: 'y',
          r: 'size',
          fillOpacity: 0.65,
        }, rows)),
        tipMark(rows, { pointer: 'near' }),
      ].filter(Boolean);
    default:
      return [];
  }
}

/**
 * Family-level scale hints: the bubble radius range.
 * @param {object} spec Chart spec.
 * @returns {object} Extra Plot scale options.
 */
export function pointScaleHints(spec) {
  if (spec.type === 'bubble') {
    return { r: { range: [4, 20] } };
  }
  return {};
}
