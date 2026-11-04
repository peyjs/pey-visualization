// Interaction wiring for the Plot renderer: datum binding on rendered
// marks and the delegated click report.
//
// Datum binding uses Plot's documented custom-render seam: each discrete
// mark's render is wrapped so every drawn element carries the row it was
// drawn from (`__vis`). The delegated click listener reads that stamp and
// reports { seriesId, datum }; a click on empty plot space reports no
// identity. Line/area marks draw one node per series, so their stamp is
// series-level (datum stays null).

/**
 * Wraps one mark's options with the datum-binding render. Discrete marks
 * draw one element per row; series marks draw one element per series.
 * @param {object} markOptions Plot mark options.
 * @param {Array} rows Normalized spec rows.
 * @param {boolean} perRow True when the mark draws one element per row.
 * @returns {object} Mark options with the binding render installed.
 */
export function bindDatum(markOptions, rows, perRow = true) {
  const original = typeof markOptions.render === 'function' ? markOptions.render : null;
  return {
    ...markOptions,
    render: (index, scales, values, dimensions, context, next) => {
      const nodes = original
        ? original(index, scales, values, dimensions, context, next)
        : next(index, scales, values, dimensions, context);
      stamp(nodes, index, rows, perRow);
      return nodes;
    },
  };
}

/**
 * Stamps each rendered element with its row (discrete marks) or its first
 * row of the series (series marks).
 * @param {Array|object} nodes Rendered elements.
 * @param {Array} index Data indices the mark was given.
 * @param {Array} rows Normalized spec rows.
 * @param {boolean} perRow One element per row, or one per series.
 * @returns {void}
 */
function stamp(nodes, index, rows, perRow) {
  const list = Array.isArray(nodes) ? nodes : [nodes];
  for (let position = 0; position < list.length; position += 1) {
    const element = list[position];
    const rowIndex = perRow ? index[position] : index[0];
    const row = typeof rowIndex === 'number' ? rows[rowIndex] : null;
    if (element && row) {
      element.__vis = { datum: perRow ? row : null, seriesId: row.series ?? null };
    }
  }
}

/**
 * Attaches the delegated click listener to the rendered plot.
 * @param {object} svg The rendered plot element.
 * @param {Function} onClick Called with { seriesId, datum } — nulls on
 *   empty plot space.
 * @returns {Function} Release function.
 */
export function attachClick(svg, onClick) {
  const listener = (event) => {
    const hit = event.target?.__vis;
    onClick({
      seriesId: hit?.seriesId ?? null,
      datum: hit?.datum ?? null,
    });
  };
  svg.addEventListener('click', listener);
  return () => svg.removeEventListener('click', listener);
}
