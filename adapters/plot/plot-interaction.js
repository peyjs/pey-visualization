// Interaction wiring for the Plot renderer: datum binding on rendered
// marks and the delegated click report.
//
// Datum binding uses Plot's documented custom-render seam: the wrapper
// walks the rendered subtree down to its LEAF elements and stamps each one
// (`__vis`) — Plot's `next()` returns a group per mark whose clickable
// children are leaves, so a stamp on the group itself never answers a
// browser click (the event target is always a leaf). Discrete marks (dot,
// bar, cell) draw one element per row: leaf i carries row index[i] with its
// datum and series. Series marks (line, area) draw one element per series:
// the series of each leaf is recovered from its own stroke/fill color,
// mapped back to the series through the (scaled) channel values —
// attributing the whole group to index[0] would
// label every series as the first one, so an unmatched leaf stays unstamped
// (a click on it reports no identity rather than a wrong one).

/**
 * Wraps one mark's options with the datum-binding render.
 * @param {object} markOptions Plot mark options.
 * @param {Array} rows Normalized spec rows.
 * @param {boolean} perRow True when the mark draws one element per row.
 * @returns {object} Mark options with the binding render installed.
 */
export function bindDatum(markOptions, rows, perRow = true) {
  const original = typeof markOptions.render === 'function' ? markOptions.render : null;
  return {
    ...markOptions,
    render: function (index, scales, values, dimensions, context, next) {
      const nodes = original
        ? original.call(this, index, scales, values, dimensions, context, next)
        : next(index, scales, values, dimensions, context);
      stampTree(nodes, index, rows, perRow, values);
      return nodes;
    },
  };
}

/**
 * Stamps the leaf elements of the rendered subtree: one-to-one with the
 * data for discrete marks, series-level (via each leaf's own color) for
 * grouped series marks.
 * @param {Array|object} nodes Rendered elements.
 * @param {Array} index Data indices the mark was given.
 * @param {Array} rows Normalized spec rows.
 * @param {boolean} perRow One element per row, or one per series.
 * @param {object} values The mark's channel values (per datum, already scaled — Plot hands the render its transformed channel values).
 * @returns {void}
 */
function stampTree(nodes, index, rows, perRow, values) {
  const list = Array.isArray(nodes) ? nodes : [nodes];
  for (const element of list) {
    const leaves = leafElements(element);
    if (perRow && leaves.length === index.length) {
      leaves.forEach((leaf, position) => {
        const rowIndex = index[position];
        const row = typeof rowIndex === 'number' ? rows[rowIndex] : null;
        if (leaf && row) {
          leaf.__vis = { datum: row, seriesId: row.series ?? null };
        }
      });
      continue;
    }
    if (perRow) {
      // A per-row mark whose element count drifted from the data count:
      // a one-to-one guess could stamp the wrong row, so nothing is stamped
      // (a click there reports no identity instead of a wrong one).
      continue;
    }
    // The channel values arrive SCALED: values.stroke/fill[i] is the color
    // datum i was drawn with. Mapping each drawn color back to the series
    // of the rows carrying it recovers each leaf's series without guessing.
    const colorToSeries = new Map();
    const channel = Array.isArray(values?.stroke) ? values.stroke : (Array.isArray(values?.fill) ? values.fill : null);
    if (channel) {
      for (const datumIndex of index) {
        const row = rows[datumIndex];
        const color = channel[datumIndex];
        if (row && typeof color === 'string' && row.series != null && !colorToSeries.has(color)) {
          colorToSeries.set(color, row.series);
        }
      }
    }
    for (const leaf of leaves) {
      const color = leaf.getAttribute?.('stroke') ?? leaf.getAttribute?.('fill');
      const seriesId = typeof color === 'string' ? colorToSeries.get(color) ?? null : null;
      if (leaf && seriesId !== null) {
        leaf.__vis = { datum: null, seriesId };
      }
    }
  }
}

/**
 * Collects the rendered subtree's leaf elements (no children of their own).
 * @param {object} element Rendered element.
 * @returns {Array} Leaves in draw order.
 */
function leafElements(element) {
  const children = element?.children ?? [];
  if (!Array.isArray(children) || children.length === 0) {
    return element ? [element] : [];
  }
  return children.flatMap((child) => leafElements(child));
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
