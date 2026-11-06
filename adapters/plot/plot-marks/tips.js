// Tooltip marks for the Plot renderer: a pointer-following tip whose title
// is built from the row's canonical channels. Aggregated families
// (histogram, boxPlot, density) are excluded — their marks regroup rows,
// so a per-row title would misattribute.

import * as Plot from '@observablehq/plot';

/**
 * Builds the tooltip title for one row from its canonical channels: the
 * series (when present), then x, y, and the value channel for heatmaps.
 * The plugin formats no numbers or dates — the values render as the host
 * prepared them.
 * @param {object} row Data row.
 * @param {{withValue?: boolean}} [options] Include the heatmap value.
 * @returns {string} Title text.
 */
function titleOf(row, { withValue = false } = {}) {
  const parts = [];
  if (row.series !== null && row.series !== undefined) {
    parts.push(String(row.series));
  }
  parts.push(String(row.x));
  parts.push(String(row.y));
  if (withValue) {
    parts.push(String(row.value));
  }
  return parts.join(' · ');
}

/**
 * Builds a pointer-following tooltip mark for one chart, or null for
 * empty data.
 * @param {Array} rows Data rows.
 * @param {object} [options] Tip shape.
 * @param {string} [options.x] x channel.
 * @param {string} [options.y] y channel.
 * @param {boolean} [options.withValue] Include the value channel in the title.
 * @param {'x'|'y'|'near'} [options.pointer] Pointer transform (x follows,
 *   y follows, or nearest).
 * @returns {object|null} Plot tip mark, or null when there is no data.
 */
export function tipMark(rows, { x = 'x', y = 'y', withValue = false, pointer = 'x' } = {}) {
  if (rows.length === 0) {
    return null;
  }
  const channels = {
    x,
    y,
    title: (row) => titleOf(row, { withValue }),
  };
  const transform = pointer === 'near' ? Plot.pointer : pointer === 'y' ? Plot.pointerY : Plot.pointerX;
  return Plot.tip(rows, transform(channels));
}
