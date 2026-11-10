// The Plot renderer adapter: the ONLY seam between the plugin and
// Observable Plot. Builds the plot from the library-neutral spec, wraps it
// with title/caption/legend elements, reports interactions through the
// handlers, redraws the drawing (only the drawing) when the container
// resizes, and releases everything it kept when the handle's release() is
// called.
//
// Internal render contract: `release()` frees ONLY the resources the render
// kept (observers, listeners). The container is cleared by the NEXT render
// (it replaces its children at start) or by the service on remove/
// deactivate — a redraw must never wipe the chart it just drew. A failed
// render clears the partial DOM itself.

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
 * @param {object} [adapterConfig] Adapter-specific configuration; an
 *   injected `document` enables headless rendering (tests, exotic hosts).
 * @returns {{render: Function}} Renderer implementing the internal contract:
 *   `render(container, spec, handlers) → { release() }`.
 */
export function createPlotRendererAdapter(adapterConfig = {}) {
  // An injected document lets tests (and exotic hosts) render headless;
  // in a browser it stays undefined and Plot uses the global document.
  const injectedDocument = adapterConfig?.document ?? null;
  const documentOf = () => injectedDocument ?? globalThis.document;

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
      const style = wrapperStyle(spec);
      const palette = resolvePalette(spec);
      const familyBuilder = FAMILY_BUILDERS[familyOf(spec.type)] ?? FAMILY_BUILDERS.series;

      container.replaceChildren();
      applyWrapperStyle(container, style);
      renderTitle(container, spec, style, documentOf);
      try {
        return renderInto(container, spec, handlers, {
          style,
          palette,
          familyBuilder,
          documentOf,
        });
      } catch (error) {
        // A failure after the title landed must leave no partial DOM in the
        // host container (requirement 8.3: no trace of a failed chart).
        container.replaceChildren();
        throw error;
      }
    },
  };
}

/**
 * Draws one chart into an already-prepared container.
 * @param {object} container Host container element (cleared, styled, titled).
 * @param {object} spec Library-neutral chart spec.
 * @param {object} handlers `{ onToggle, onClick }`.
 * @param {object} context Pre-resolved render context ({style, palette,
 *   familyBuilder, documentOf}).
 * @returns {{release: Function}} Handle releasing every kept resource.
 */
function renderInto(container, spec, handlers, { style, palette, familyBuilder, documentOf }) {
  // No data is not an error: a quiet placeholder instead of a drawing. Its
  // release frees nothing (no resources were kept) — the container is
  // cleared by the next render or by the service on remove. A legend still
  // renders here when the spec declares series: after hiding every series
  // the checkboxes must survive, or the hidden series could never be
  // brought back (renderLegend guards the hidden legend / single-series
  // cases itself).
  if (spec.data.rows.length === 0) {
    renderEmptyState(container, style, documentOf);
    renderLegend(container, spec, style, handlers.onToggle, spec.seriesVisibility, documentOf);
    return {
      release() {},
    };
  }

  const wrapper = documentOf().createElement('div');
  wrapper.className = 'pey-vis-plot';
  applyWrapperStyle(wrapper, style);

  // Declared before drawPlot so the closure references a binding that
  // already exists, not one hoisted by call-order luck.
  let releaseClick = null;
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
      marginTop: spec.margin?.top,
      marginRight: spec.margin?.right,
      marginBottom: spec.margin?.bottom,
      marginLeft: spec.margin?.left,
    };
    mergeHints(options, familyBuilder.hints(spec));
    mergeHints(options, axisScaleOptions(spec, palette));
    // Plot reads `window.document`, not `globalThis.document`: the
    // effective document is injected explicitly unless it IS the real one.
    if (typeof window === 'undefined' || documentOf() !== window.document) {
      options.document = documentOf();
    }
    const plot = Plot.plot(options);
    releaseClick = attachClick(plot, handlers.onClick);
    wrapper.append(plot);
  };
  drawPlot();

  let lastWidth = plotSize(spec, container).width;
  const releases = [watchResize(container, () => {
    const width = plotSize(spec, container).width;
    if (width !== lastWidth) {
      lastWidth = width;
      try {
        drawPlot();
      } catch {
        // A failed resize redraw keeps the previous drawing.
      }
    }
  })];

  container.append(wrapper);
  // Legend placement: top/left render before the drawing, bottom/right
  // after it — DOM order decides the visual position in this version. The
  // legend reads the FULL series list plus the visibility state, so a
  // hidden series stays toggleable (checked=false), not deleted from the UI.
  const legendBefore = ['top', 'left'].includes(spec.legend?.position ?? 'top');
  if (legendBefore) {
    renderLegend(container, spec, style, handlers.onToggle, spec.seriesVisibility, documentOf);
  }
  renderCaption(container, spec, style, documentOf);
  if (!legendBefore) {
    renderLegend(container, spec, style, handlers.onToggle, spec.seriesVisibility, documentOf);
  }

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
    },
  };
}
