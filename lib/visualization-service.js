// Provides the pey.visualization service: independent charts drawn in
// host-provided containers from host-prepared data.
//
// The service orchestrates: options are normalized, data is validated per
// chart type, the internal renderer draws into the container, and
// interaction reports become plugin events carrying chart/series identity
// only. The service holds no data of its own beyond the active charts in
// the store; deactivation removes every chart.

import {
  CLICK_EVENT,
  ERROR_CODES,
  SERVICE_UNAVAILABLE,
  RENDER_FAILED_EVENT,
  SERIES_TOGGLED_EVENT,
} from './constants.js';
import { createChartStore } from './chart-store.js';
import { createVisualizationError, describeCause } from './error.js';
import { normalizeOptions } from './spec/options-normalizer.js';
import { validateData } from './spec/data-validator.js';

/**
 * Publishes an event when the bus exists. Bus failures never fail a call.
 * @param {object} events Event bus or null.
 * @param {string} type Event type.
 * @param {object} data Event data.
 * @returns {void}
 */
function publish(events, type, data) {
  try {
    events?.publish(type, data);
  } catch {
    // Event bus issues never fail a service call.
  }
}

/**
 * Resolves the host's container into a display element. An element passes
 * through; a string is resolved as a CSS selector — once, at create time.
 * @param {unknown} container Host container.
 * @returns {object} Display element.
 * @throws {object} VIS_INVALID_CONTAINER.
 */
function resolveContainer(container) {
  if (container !== null && typeof container === 'object' && !Array.isArray(container)
    && typeof container.append === 'function' && typeof container.replaceChildren === 'function') {
    return container;
  }
  if (typeof container === 'string' && container.length > 0) {
    const element = globalThis.document?.querySelector?.(container);
    if (element) {
      return element;
    }
  }
  throw createVisualizationError(
    ERROR_CODES.INVALID_CONTAINER,
    'The chart container must be an element or a selector matching one',
    { container: typeof container === 'string' ? container : undefined },
  );
}

/**
 * Wraps one renderer failure into the structured render-failure error with
 * the original cause preserved for diagnosis.
 * @param {unknown} error Renderer failure.
 * @param {string} chartId Chart identity.
 * @returns {object} Structured error.
 */
function renderFailure(error, chartId) {
  return createVisualizationError(
    ERROR_CODES.RENDER_FAILED,
    'The chart could not be rendered',
    { chartId, cause: describeCause(error) },
  );
}

/**
 * Creates the visualization service closing over activation-bound
 * references.
 * @param {object} state References ({ renderer, events, config }).
 * @returns {{service: object, deactivate: Function}} Service and lifecycle control.
 */
export function createVisualizationService(state) {
  const store = createChartStore();
  let available = true;

  function assertAvailable() {
    if (!available) {
      throw createVisualizationError(SERVICE_UNAVAILABLE, 'Visualization service is unavailable');
    }
  }

  function requireRenderer() {
    assertAvailable();
    if (!state.renderer) {
      throw createVisualizationError(SERVICE_UNAVAILABLE, 'Visualization service is unavailable');
    }
    return state.renderer;
  }

  /**
   * Applies the per-series visibility the user has toggled in the legend:
   * series hidden through the legend are removed from the spec data before
   * every render, so a re-render (update or resize) keeps the choice.
   * @param {object} entry Store entry.
   * @returns {object} Spec with hidden series filtered out.
   */
  function specForRender(entry) {
    // The visibility state rides on the spec: the legend reads it to render
    // hidden series as unchecked (toggleable), not deleted from the UI.
    const spec = { ...entry.spec, seriesVisibility: entry.seriesVisibility };
    const hidden = [...entry.seriesVisibility.entries()].filter(([, visible]) => !visible).map(([id]) => id);
    if (hidden.length === 0 || !spec.data?.seriesIds) {
      return spec;
    }
    // Only the MARK rows are filtered: seriesIds stays the full list so the
    // legend keeps rendering hidden series as unchecked (toggleable) —
    // deleting them from seriesIds made a hidden series unrecoverable.
    return {
      ...spec,
      data: {
        ...spec.data,
        rows: spec.data.rows.filter((row) => row.series === null || !hidden.includes(row.series)),
      },
    };
  }

  /**
   * Draws one chart into its container, keeps the renderer's handle on the
   * entry, and maps renderer failures to the structured render-failure
   * error.
   * @param {object} entry Store entry (mutated: gains `handle`).
   * @returns {void}
   * @throws {object} VIS_RENDER_FAILED.
   */
  function drawChart(entry) {
    let handle;
    try {
      handle = entry.renderer.render(entry.element, specForRender(entry), {
        onToggle: (seriesId, visible) => {
          // The legend choice is persisted and applied to the drawing right
          // away: the user sees the series disappear immediately, not after
          // the next update or resize. A redraw failure must not escape as
          // an uncaught DOM exception on the host page — and it is never
          // swallowed silently either: the choice is reverted, the reverted
          // state is redrawn (so picture, state and legend tell one story),
          // and the structured failure is published for the host.
          entry.seriesVisibility.set(seriesId, visible);
          try {
            redrawKeepingPrevious(entry);
          } catch (error) {
            entry.seriesVisibility.set(seriesId, !visible);
            // redrawKeepingPrevious already made a recovery render with the
            // (still applied) visibility — its handle is live in entry.handle
            // and must be released before the reverted redraw replaces it,
            // or every failed toggle leaks a whole render (ResizeObserver
            // included).
            releaseHandle(entry.handle);
            try {
              drawChart(entry);
            } catch {
              // Even the reverted redraw failed; the state stays truthful
              // and the next successful update restores the drawing.
            }
            publish(state.events, RENDER_FAILED_EVENT, {
              chartId: entry.id,
              operation: 'series-toggle',
              code: error?.code ?? ERROR_CODES.RENDER_FAILED,
            });
            return;
          }
          // The event fires only after a redraw that actually happened, so
          // a listener reacting to it always sees the announced state.
          publish(state.events, SERIES_TOGGLED_EVENT, { chartId: entry.id, seriesId, visible });
        },
        onClick: (report) => {
          publish(state.events, CLICK_EVENT, {
            chartId: entry.id,
            seriesId: report?.seriesId ?? null,
            datum: report?.datum ?? null,
          });
        },
      });
    } catch (error) {
      throw renderFailure(error, entry.id);
    }
    entry.handle = handle;
  }

  /**
   * Redraws one chart, rolling back to the previous drawing and spec when
   * the new render fails. The rollback render is guarded separately so a
   * broken rollback never swallows the original error.
   * @param {object} entry Store entry (mutated).
   * @returns {void}
   * @throws {object} VIS_RENDER_FAILED.
   */
  function redrawKeepingPrevious(entry, previous = { spec: entry.spec, data: entry.data, options: entry.options, handle: entry.handle }) {
    const oldHandle = previous.handle;
    try {
      drawChart(entry);
    } catch (error) {
      // Roll back to the previous drawing and shape.
      entry.spec = previous.spec;
      entry.data = previous.data;
      entry.options = previous.options;
      entry.handle = oldHandle;
      try {
        drawChart(entry);
      } catch {
        throw createVisualizationError(
          ERROR_CODES.RENDER_FAILED,
          'The chart could not be rendered and its previous drawing could not be restored',
          { chartId: entry.id, cause: describeCause(error), rollbackFailed: true },
        );
      }
      // The rollback's fresh render replaced oldHandle's resources: release
      // it here too, or every failed update leaks a live ResizeObserver.
      releaseHandle(oldHandle);
      throw error;
    }
    releaseHandle(oldHandle);
  }

  /**
   * Releases one renderer handle with the stale-handle guard.
   * @param {object|null} handle Renderer handle.
   * @returns {void}
   */
  function releaseHandle(handle) {
    if (handle?.release) {
      try {
        handle.release();
      } catch {
        // Releasing a stale handle is harmless.
      }
    }
  }

  /**
   * Builds the full internal spec (options slice + normalized data) for one
   * chart from the host's raw input.
   * @param {string} type Chart type.
   * @param {unknown} data Raw data.
   * @param {object} [options] Raw options.
   * @returns {object} The library-neutral spec.
   * @throws {object} VIS_INVALID_OPTIONS / VIS_INVALID_DATA / VIS_UNKNOWN_CHART_TYPE.
   */
  function buildSpec(type, data, options) {
    const { spec: optionSpec, channels } = normalizeOptions(options, type, state.config ?? {});
    const normalizedData = validateData(type, data, channels);
    return { ...optionSpec, type, data: normalizedData };
  }

  function requireChart(id) {
    assertAvailable();
    if (typeof id !== 'string') {
      throw createVisualizationError(ERROR_CODES.UNKNOWN_CHART, 'No chart exists for this id', { chartId: id });
    }
    const entry = store.get(id);
    if (!entry) {
      throw createVisualizationError(ERROR_CODES.UNKNOWN_CHART, 'No chart exists for this id', { chartId: id });
    }
    return entry;
  }

  return {
    service: {
      /**
       * Creates one independent chart in a host-provided container.
       *
       * @param {object} input { container, type, data, options? }.
       * @returns {{id: string}} The chart id.
       * @throws {object} Structured validation, container, type, data, options or render error.
       */
      create(input) {
        requireRenderer();
        const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
        const element = resolveContainer(source.container);
        const type = typeof source.type === 'string' ? source.type : '';
        if (type.length === 0) {
          throw createVisualizationError(ERROR_CODES.UNKNOWN_CHART_TYPE, 'The requested chart type is not supported', { type });
        }
        const spec = buildSpec(type, source.data, source.options);

        const entry = {
          element,
          renderer: state.renderer,
          spec,
          options: source.options ?? null,
          data: source.data,
          seriesVisibility: new Map(),
          handle: null,
        };
        const id = store.add(entry);
        try {
          drawChart(entry);
        } catch (error) {
          store.remove(id);
          throw error;
        }
        return { id };
      },

      /**
       * Re-renders an existing chart with new data, new options or both.
       * A failed re-render keeps the previous drawing on the page.
       *
       * @param {string} id Chart id.
       * @param {object} input { data?, options? }.
       * @returns {{ok: boolean, id: string}} Confirmation.
       * @throws {object} VIS_UNKNOWN_CHART / validation / render errors.
       */
      update(id, input) {
        const entry = requireChart(id);
        requireRenderer();
        const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
        if (source.data === undefined && source.options === undefined) {
          throw createVisualizationError(
            ERROR_CODES.INVALID_OPTIONS,
            'An update needs new data, new options or both',
            { reason: 'nothing-to-update' },
          );
        }
        // The new spec is built and validated BEFORE any entry state is
        // touched: a validation failure must leave the chart untouched, or
        // every later update would keep failing on the poisoned data.
        const nextData = source.data !== undefined ? source.data : entry.data;
        const nextOptions = source.options !== undefined ? source.options : entry.options ?? undefined;
        const nextSpec = buildSpec(entry.spec.type, nextData, nextOptions);
        // The previous snapshot is captured before the mutation, so the
        // rollback restores the genuinely previous drawing.
        const previous = { spec: entry.spec, data: entry.data, options: entry.options, handle: entry.handle };
        entry.data = nextData;
        entry.options = nextOptions;
        entry.spec = nextSpec;
        redrawKeepingPrevious(entry, previous);
        return { ok: true, id: entry.id };
      },

      /**
       * Removes a chart completely; other charts continue untouched.
       *
       * @param {string} id Chart id.
       * @returns {{ok: boolean}} Confirmation.
       * @throws {object} VIS_UNKNOWN_CHART / SERVICE_UNAVAILABLE.
       */
      remove(id) {
        const entry = requireChart(id);
        // Release first: a failing release keeps the entry in the store, so
        // the caller can retry instead of losing a chart to a broken sweep.
        try {
          entry.handle?.release?.();
        } catch (error) {
          throw renderFailure(error, id);
        }
        // Release frees resources only (the internal render contract): the
        // container cleanup on removal is the service's responsibility.
        entry.element.replaceChildren();
        store.remove(id);
        return { ok: true };
      },
    },

    deactivate() {
      available = false;
      // Shutdown sweep: every active chart is taken off its container and
      // every resource freed (requirement 8.3). Release frees resources
      // only — the containers are cleared here.
      for (const entry of store.removeAll()) {
        try {
          entry.handle?.release?.();
        } catch {
          // A release failure during shutdown must not stop the sweep.
        }
        try {
          entry.element.replaceChildren();
        } catch {
          // A detached container must not stop the sweep either.
        }
      }
    },
  };
}
