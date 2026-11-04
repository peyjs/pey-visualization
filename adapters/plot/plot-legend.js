import { applyWrapperStyle } from './plot-empty-state.js';

// The chart legend: one toggle per data series. Toggling hides/shows the
// series instantly (the renderer redraws) and reports the switch to the
// service for the series-toggled event. Labels are the series ids the
// host's data carries — the plugin invents no labels.

/**
 * Renders the legend for the chart's series.
 * @param {object} container Container element.
 * @param {object} spec Chart spec (data.seriesIds).
 * @param {object} style Wrapper styles.
 * @param {Function} onToggle Called as (seriesId, visible) on a switch.
 * @returns {boolean} True when a legend was rendered.
 */
export function renderLegend(container, spec, style, onToggle) {
  const seriesIds = spec.data?.seriesIds ?? [];
  if (spec.legend?.visible === false || seriesIds.length < 2) {
    return false;
  }
  const legend = globalThis.document.createElement('div');
  legend.className = 'pey-vis-legend';
  applyWrapperStyle(legend, style);
  legend.style.display = 'flex';
  legend.style.flexWrap = 'wrap';
  legend.style.gap = '10px';
  legend.style.margin = '6px 0';

  for (const seriesId of seriesIds) {
    const item = globalThis.document.createElement('label');
    item.style.display = 'inline-flex';
    item.style.alignItems = 'center';
    item.style.gap = '4px';
    item.style.cursor = 'pointer';

    const checkbox = globalThis.document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = true;
    checkbox.addEventListener('change', () => {
      onToggle(seriesId, checkbox.checked);
    });

    const text = globalThis.document.createElement('span');
    text.textContent = seriesId;

    item.append(checkbox, text);
    legend.append(item);
  }
  container.append(legend);
  return true;
}
