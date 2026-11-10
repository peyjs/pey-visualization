// The chart legend: one toggle per data series. Toggling hides/shows the
// series instantly (the service redraws) and reports the switch to the
// service for the series-toggled event. Labels are the series ids the
// host's data carries — the plugin invents no labels.

import { applyWrapperStyle } from './plot-empty-state.js';

/**
 * Renders the legend for the chart's series.
 * @param {object} container Container element.
 * @param {object} spec Chart spec (data.seriesIds — the FULL list, hidden
 *   series included).
 * @param {object} style Wrapper styles.
 * @param {Function} onToggle Called as (seriesId, visible) on a switch.
 * @param {Map|null} [seriesVisibility] Per-series visibility state; a
 *   missing entry means visible.
 * @param {Function} [documentOf] Effective-document getter (headless tests).
 * @returns {boolean} True when a legend was rendered.
 */
export function renderLegend(container, spec, style, onToggle, seriesVisibility = null, documentOf = () => globalThis.document) {
  const seriesIds = spec.data?.seriesIds ?? [];
  // The legend renders for a multi-series chart — and also when at least
  // one series is currently HIDDEN: with a single visible series whose
  // siblings are hidden (or all rows filtered out), the unchecked checkbox
  // is the only way the hidden series can ever come back.
  const hasHidden = seriesIds.some((seriesId) => seriesVisibility?.get(seriesId) === false);
  if (spec.legend?.visible === false || (seriesIds.length < 2 && !hasHidden)) {
    return false;
  }
  const legend = documentOf().createElement('div');
  legend.className = 'pey-vis-legend';
  applyWrapperStyle(legend, style);
  legend.style.display = 'flex';
  legend.style.flexWrap = 'wrap';
  legend.style.gap = '10px';
  legend.style.margin = '6px 0';

  for (const seriesId of seriesIds) {
    const item = documentOf().createElement('label');
    item.style.display = 'inline-flex';
    item.style.alignItems = 'center';
    item.style.gap = '4px';
    item.style.cursor = 'pointer';

    const checkbox = documentOf().createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = seriesVisibility?.get(seriesId) !== false;
    checkbox.addEventListener('change', () => {
      onToggle(seriesId, checkbox.checked);
    });

    const text = documentOf().createElement('span');
    text.textContent = seriesId;

    item.append(checkbox, text);
    legend.append(item);
  }
  container.append(legend);
  return true;
}
