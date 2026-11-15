// Shared constants for the pey.visualization plugin.

export const PLUGIN_NAME = 'pey.visualization';
export const PLUGIN_VERSION = '1.0.0';
export const SERVICE_NAME = 'pey.visualization.service';

export const ERROR_CODES = Object.freeze({
  INVALID_DATA: 'VIS_INVALID_DATA',
  UNKNOWN_CHART_TYPE: 'VIS_UNKNOWN_CHART_TYPE',
  INVALID_CONTAINER: 'VIS_INVALID_CONTAINER',
  INVALID_OPTIONS: 'VIS_INVALID_OPTIONS',
  RENDER_FAILED: 'VIS_RENDER_FAILED',
  UNKNOWN_CHART: 'VIS_UNKNOWN_CHART',
});

export const SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE';

export const CLICK_EVENT = 'visualization:clicked';
export const SERIES_TOGGLED_EVENT = 'visualization:series-toggled';
export const RENDER_FAILED_EVENT = 'visualization:render-failed';

// The supported chart types, grouped by family. Validation and rendering
// are dispatched per family; no module lists every type alone.
export const CHART_TYPES = Object.freeze({
  series: Object.freeze(['line', 'timeSeries', 'area', 'stackedArea']),
  bar: Object.freeze(['bar', 'groupedBar', 'stackedBar']),
  point: Object.freeze(['scatter', 'bubble', 'dot']),
  distribution: Object.freeze(['histogram', 'boxPlot', 'density']),
  heatmap: Object.freeze(['heatmap']),
});

export const DEFAULT_THEME = 'light';
// The theme names the OPTIONS CONTRACT knows (validated in the options
// slices); the renderer's own color tables live in its adapter.
export const THEME_NAMES = Object.freeze(new Set(['light', 'dark']));
export const DEFAULT_ADAPTER = 'PlotRendererAdapter';
