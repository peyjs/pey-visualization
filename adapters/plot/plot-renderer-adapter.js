// The Plot renderer adapter: the ONLY seam between the plugin and
// Observable Plot. Builds the plot from the library-neutral spec, wraps it
// with title/caption/legend elements, reports interactions through the
// handlers, redraws the drawing (only the drawing) when the container
// resizes, and releases everything it kept when the handle's release() is
// called.

import * as Plot from '@observablehq/plot';
import { familyOf } from '../../lib/spec/data-validator.js';
import { applyWrapperStyle, renderCaption, renderEmptyState, renderTitle } from './plot-empty-state.js';
import { attachClick } from './plot-interaction.js';
import { renderLegend } from './plot-legend.js';
import { axisScaleOptions, plotCss, plotSize, resolvePalette, wrapperStyle } from './plot-style.js';
import { watchResize } from './plot-resize.js';
import { barScaleHints, buildBarMarks } from './plot-marks/bar-charts.js';
import { buildDistributionMarks, distributionScaleHints } from './plot-marks/distribution-charts.js';
import { buildHeatmapMarks, heatmapScaleHints } from './plot-marks/heatmap.js';
import { buildPointMarks, pointScaleHints } from './plot-marks/point-charts.js';
import { buildSeriesMarks, seriesScaleHints } from './plot-marks/series-charts.js';

const FAMILY_BUILDERS = Object.freeze({
  series: { marks: buildSeriesMarks, hints: seriesScaleHints },
  bar: { marks: buildBarMarks, hints: barScaleHints },
  point: { marks: buildPointMarks, hints: pointScaleHints },
  distribution: { marks: buildDistributionMarks, hints: distributionScaleHints },
  heatmap: { marks: buildHeatmapMarks, hints: heatmapScaleHints },
});

/**
 * Merges the family scale hints into the base scale options without
 * dropping the base (e.g. the palette's color range must survive a
 * heatmap's color-legend hint).
 * @param {object} options Base Plot options.
 * @param {object} hints Family hints.
 * @returns {void} Mutates `options`.
 */
function mergeHints(options, hints) {
  for (const [key, fragment] of Object.entries(hints)) {
    options[key] = fragment !== null && typeof fragment === 'object' && !Array.isArray(fragment)
      ? { ...options[key], ...fragment }
      : fragment;
  }
}

/**
 * Creates the Plot renderer adapter.
 *
 * @param {object} [adapterConfig] Adapter-specific configuration (unused today).
 * @returns {{render: Function}} Renderer implementing the internal contract:
 *   `render(container, spec, handlers) → { release() }`.
 */
export function createPlotRendererAdapter(adapterConfig = {}) {
  void adapterConfig;

  return {
    /**
     * Draws one chart into the container.
     *
     * @param {object} container Host container element.
     * @param {object} spec Library-neutral chart spec.
     * @param {object} handlers `{ onToggle(seriesId, visible), onClick({seriesId, datum}) }`.
     * @returns {{release: Function}} Handle releasing every kept resource.
     */
    render(container, spec, handlers) {
      const releases = [];
      const style = wrapperStyle(spec);
      const palette = resolvePalette(spec);
      const familyBuilder = FAMILY_BUILDERS[familyOf(spec.type)] ?? FAMILY_BUILDERS.series;

      container.replaceChildren();
      applyWrapperStyle(container, style);
      renderTitle(container, spec, style);

      // No data is not an error: a quiet placeholder instead of a drawing.
      if (spec.data.rows.length === 0) {
        renderEmptyState(container, style);
        return { release() {} };
      }

      const wrapper = globalThis.document.createElement('div');
      wrapper.className = 'pey-vis-plot';
      applyWrapperStyle(wrapper, style);

      // Redraws only the drawing itself — the wrapper, title, caption and
      // legend stay put — so resize bursts are cheap and idempotent.
      const drawPlot = () => {
        if (releaseClick) {
          releaseClick();
          releaseClick = null;
        }
        wrapper.replaceChildren();
        const { width, height } = plotSize(spec, container);
        const options = {
          marks: familyBuilder.marks(spec),
          width,
          height,
          style: plotCss(spec, palette),
          background: palette.background,
          color: { range: palette.colors },
        };
        mergeHints(options, familyBuilder.hints(spec));
        mergeHints(options, axisScaleOptions(spec, palette));
        const plot = Plot.plot(options);
        releaseClick = attachClick(plot, handlers.onClick);
        wrapper.append(plot);
      };
      let releaseClick = null;
      drawPlot();

      let lastWidth = plotSize(spec, container).width;
      releases.push(watchResize(container, () => {
        const width = plotSize(spec, container).width;
        if (width !== lastWidth) {
          lastWidth = width;
          try {
            drawPlot();
          } catch {
            // A failed resize redraw keeps the previous drawing.
          }
        }
      }));

      container.append(wrapper);
      // The legend sits between the drawing and the caption; DOM order —
      // not flex ordering — decides the visual position.
      renderLegend(container, spec, style, handlers.onToggle);
      renderCaption(container, spec, style);

      let released = false;
      return {
        release() {
          if (released) {
            return;
          }
          released = true;
          for (const release of releases) {
            try {
              release();
            } catch {
              // Releasing an already-released resource is harmless.
            }
          }
          container.replaceChildren();
        },
      };
    },
  };
}
