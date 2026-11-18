# pey.visualization — Reference

Self-contained reference for the `pey.visualization` feature plugin. This document follows `docs/requirements.md` (the construction source of truth) and explains the manifest contract.

## Purpose

Chart rendering: the host supplies prepared data and display settings, the plugin draws the chart, provides the agreed interactions and reports events. The plugin receives and stores no data, understands no business meaning, and performs only the computations the chart type itself needs (binning, quantiles, stacking, scales).

## Structure

- `manifest.json` — plugin contract (identity, service, events, config).
- `index.js` — lifecycle wiring (`prepare` / `activate`).
- `lib/constants.js` — names, codes, type families, defaults.
- `lib/error.js` — structured errors that keep their cause.
- `lib/chart-store.js` — the active-chart store (live references).
- `lib/renderer-loader.js` — the renderer-adapter loader (dynamic import).
- `lib/visualization-service.js` — `create`/`update`/`remove` + events.
- `lib/spec/data-validator.js` — validation dispatch by type.
- `lib/spec/options-normalizer.js` — display-option normalization.
- `lib/spec/charts/*.js` — the five family validators.
- `adapters/plot/*.js` — style, size, legend, interaction, empty state.
- `adapters/plot/plot-marks/*.js` — spec-to-Plot-mark translation.
- `tests/` — plugin tests (`node:test`, fake renderer only).
- `docs/reference.md` — this file.
- `CHANGELOG.md` — the plugin's version history.

## Dependencies

- **Required:** none.
- **Optional:** none.

The npm dependency `@observablehq/plot` is internal to the plugin: it is imported only under `adapters/plot/`, behind the internal renderer contract `render(container, spec, handlers) → { release() }`, where `spec` is a library-neutral intermediate shape (type, normalized data, display options). No type, message or error from the chart library exists in the service; a raw render-failure cause stays only in `detail.cause` of the structured error. Swapping the library = one new adapter, no consumer change.

## Public API

Service: `pey.visualization.service`.

### `create({ container, type, data, options? })`

Creates one independent chart and returns `{ id }`. The `container` is an Element or a CSS selector string, resolved once at creation (`VIS_INVALID_CONTAINER`). `type` is one of the chart types below (`VIS_UNKNOWN_CHART_TYPE`). Data and options are validated before drawing; empty data is not an error — the chart renders an empty state.

### `update(id, { data?, options? })`

Re-renders an existing chart with new data, new options or both; data given alone keep the previous options and vice versa. Re-rendering redraws the whole chart (no partial transitions are promised). A failed re-render keeps the previous drawing on the page and surfaces `VIS_RENDER_FAILED`. An unknown id → `VIS_UNKNOWN_CHART`.

### `remove(id)`

Takes a chart away completely: the display leaves the page, every resource is freed (`release`), and other charts continue untouched. Plugin shutdown does the same for all charts.

### Chart types

Five families — validation and rendering of each family live in their own module:

| Family | Types | Data (renamable fields) |
|---|---|---|
| series | `line`, `timeSeries`, `area`, `stackedArea` | `x` (scalar, or `Date` on the time channel only), `y` (number), `series` optional — required for `stackedArea` |
| bar | `bar`, `groupedBar`, `stackedBar` | `x` (category), `y` (number), `series` optional — required for grouped/stacked |
| point | `scatter`, `dot`, `bubble` | `x`, `y`, and a numeric `size` for bubble |
| distribution | `histogram`, `density`, `boxPlot` | histogram: numeric `x`; density: numeric `x` and `y`; boxPlot: category `x` and numeric `y` |
| heatmap | `heatmap` | `x`, `y`, numeric `value` |

The host's field names map to channels through `options.channels` (e.g. `{ x: 'day', y: 'amount' }`); the default is the channel name itself. Pie/donut charts are not supported.

### Display options

All optional; defaults look right without any setting:

- **Theme:** `theme: 'light' | 'dark'` or a custom `palette: { colors, background, textColor, gridColor, axisColor }`. The plugin does not detect theme changes; it re-renders when the option changes.
- **Size:** `width`, `height`, or `aspectRatio` (default 1.6); without an explicit width the container's width applies. `height` and `aspectRatio` together are refused (`aspect-ratio-with-height`).
- **Margin:** `margin: { top, right, bottom, left }` — each side a non-negative number (zero means no margin).
- **Title and caption:** `title`, `caption` — host-prepared text.
- **Legend:** `legend: { visible, position: 'top'|'right'|'bottom'|'left' }` — shown with more than one series, or when at least one series is hidden, and it switches each series.
- **Axes:** `axes.x / axes.y` with `label`, `domain: [min, max]` and `tickFormat` (a host format function — the plugin has no format of its own).
- **Text:** `text: { direction: 'rtl'|'ltr', font, fontSize }` — text direction independent of the axis directions.
- **Bar orientation:** `orientation: 'vertical'|'horizontal'` — for the whole bar family (`bar`, `groupedBar`, `stackedBar`); refused on other types with `orientation-not-applicable-to-type`.
- **Channels:** `channels` (see Chart types).

## Events

| Event | Data | When |
|---|---|---|
| `visualization:clicked` | `{ chartId, seriesId, datum }` | The user clicked a chart part the renderer supports selecting; a click on empty chart space reports only `chartId`. |
| `visualization:series-toggled` | `{ chartId, seriesId, visible }` | The user switched a series through the legend (published only after a successful redraw). |
| `visualization:render-failed` | `{ chartId, operation, code }` | A redraw the service initiated on its own (today: the redraw after a toggle) failed and was rolled back. |

Events carry chart/series identity and the clicked datum only — never a raw payload beyond it. A failed event publish is settled in a catch and never throws out of the service call: the plugin has no logger, and a broken bus must not take the visualization service down (soft-degradation policy of the requirements).

## Errors Reference

| Code | Situation | Type |
|---|---|---|
| `VIS_INVALID_CONTAINER` | The container is not a valid Element/selector, or the selector matched nothing. | operational |
| `VIS_UNKNOWN_CHART_TYPE` | Unknown or unsupported chart type. | operational |
| `VIS_INVALID_DATA` | Invalid/incomplete data (cause carries `reason`, the field name and the row number in `detail`). | operational |
| `VIS_INVALID_OPTIONS` | Invalid options (cause and option name in `detail`). | operational |
| `VIS_RENDER_FAILED` | Drawing failed (the raw library cause in `detail.cause`). | operational |
| `VIS_UNKNOWN_CHART` | Unknown id in `update`/`remove`. | operational |
| `VIS_ADAPTER_NOT_FOUND` / `VIS_ADAPTER_INVALID` / `VIS_ADAPTER_INITIALIZATION_FAILED` | Startup: the configured renderer adapter could not be found, is incomplete, or failed to initialize. | startup |
| `SERVICE_UNAVAILABLE` | Called after deactivation/shutdown. | operational |

`source` is always `pey.visualization`; the raw library message never crosses. Missing data is not an error.

## Config

| Key | Type | Required | Default | Purpose |
|---|---|---|---|---|
| `adapter` | `string` | No | `'PlotRendererAdapter'` | The renderer adapter to load. |
| `adapterConfig` | `object` | No | `{}` | Adapter-specific configuration. |
| `theme` | `string` | No | `'light'` | The default display theme (light/dark). |

## Business Rules

- The host owns the data and its meaning; the plugin owns the drawing. The only allowed computations are the chart type's own: histogram binning, box-plot quantiles/outliers, density estimation, stacking of accumulated layers, heatmap color scaling, axis scales and domains. Any business computation (sums by category, averages, filtering, sorting, grouping) belongs to the host.
- One chart per `create`, independent by id: one chart's removal never disturbs another.
- A failed `update` re-renders the previous drawing and shape (and stays updatable afterwards); a failed series toggle reverts the choice, redraws the reverted state and reports the structured failure — picture, state and legend always tell one story; a failed resize redraw keeps the previous drawing; a failed first render frees every resource the render had registered so far (the resize observer and the click and legend listeners included), leaving no zombie observer on the host container; removal and shutdown release every resource even when the host container is broken.
- Responsive redraws run on container resize (ResizeObserver, coalesced per frame, redrawing the drawing only — title, caption and legend stay put); in environments without ResizeObserver, responsiveness is inert and the initial width applies.
- The tooltip rides the pointer, built from each row's own channels (title = the row's channels; for heatmap the value) — for all row families (series/bar/point/heatmap). The aggregated families (histogram/boxPlot/density) have none on purpose: their marks regroup rows, so attributing a title to a row would be wrong.
- A hidden series stays in the legend as an unchecked checkbox, so it can always come back; the visibility state rides the render spec and survives updates.
- The user's selection processing and any business change is the host's; events carry identity only.

## Constraints

- Animation, advanced zoom/pan, PNG/SVG/PDF export, cross-chart interactive coordination, advanced accessibility, very-large-data optimization, and pie/donut charts are out of scope for this version.
- Real rendering with Observable Plot requires a browser; the Node suite covers everything with a fake renderer, and a manual browser render review belongs to the host.
- Do not use this service for data preparation or business aggregation; hand it rows it can validate per family.
