import { applyWrapperStyle } from './plot-empty-state.js';

// The chart legend: one toggle per data series. Toggling hides/shows the
// series instantly (the renderer re-renders) and reports the switch to the
// service for the series-toggled event. Recognized text travels from the
// series ids the host's data carries — the plugin invents no labels.

/**
 * Renders the legend under/over the plot and wires the toggles.
 * @param {object} container Container element.
 * @param {object} spec Chart spec (legend?, data.seriesIds?).
 * @param {object} style Wrapper styles.
 * @param {Map} visibility Current per-series visibility.
 * @param {Function} onToggle Called as (seriesId, visible) on a switch.
 * @returns {void}
 */
export function renderLegend(container, spec, style, visibility, onToggle) {
  const seriesIds = spec.data?.seriesIds ?? [];
  const wantsLegend = spec.legend?.visible !== false && seriesIds.length > 1;
  if (!wantsLegend) {
    return;
  }
  const legend = globalThis.document.createElement('div');
  legend.className = 'pey-vis-legend';
  applyWrapperStyle(legend, style);
  legend.style.display = 'flex';
  legend.style.flexWrap = 'wrap';
  legend.style.gap = '10px';
  legend.style.margin = '6px 0';
  if (spec.legend?.position === 'bottom') {
    legend.style.order = '2';
  } else {
    legend.style.order = '-1';
  }

  for (const seriesId of seriesIds) {
    const item = globalThis.document.createElement('label');
    item.style.display = 'inline-flex';
    item.style.alignItems = 'center';
    item.style.gap = '4px';
    item.style.cursor = 'pointer';

    const checkbox = globalThis.document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = visibility.get(seriesId) ?? true;
    checkbox.addEventListener('change', () => {
      onToggle(seriesId, checkbox.checked);
    });

    const text = globalThis.document.createElement('span');
    text.textContent = seriesId;

    item.append(checkbox, text);
    legend.append(item);
  }
  container.append(legend);
}

