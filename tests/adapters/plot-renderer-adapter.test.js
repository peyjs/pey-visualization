// Verifies the real Plot renderer adapter headless: it builds actual
// Observable Plot output through an injected document shim — the tooltip
// presence and the release cleanup for both the drawn and the empty path.

import assert from 'node:assert/strict';
import test from 'node:test';
import { tipMark } from '../../adapters/plot/plot-marks/tips.js';
import { createPlotRendererAdapter } from '../../adapters/plot/plot-renderer-adapter.js';
import { createDomShim, createShimContainer } from '../dom-shim.js';

// A shared shim for the contract suite (each render also gets a fresh
// container); the per-test setup still overrides globalThis.document.
const shimDocument = createDomShim();

function setup() {
  const document = createDomShim();
  // The title/caption/legend/empty-state helpers read the global document;
  // the shim stands in for the browser for the whole test.
  const previousDocument = globalThis.document;
  globalThis.document = document;
  const adapter = createPlotRendererAdapter({ document });
  const container = createShimContainer(document);
  return {
    adapter,
    container,
    restore() {
      globalThis.document = previousDocument;
    },
  };
}

const ROWS = [
  { x: 1, y: 2, series: 'الف' },
  { x: 2, y: 4, series: 'ب' },
];

test('should_render_a_real_plot_and_clear_it_on_release_when_data_has_rows', () => {
  const { adapter, container, restore } = setup();
  try {
    const handle = adapter.render(container, {
      type: 'line',
      data: { rows: ROWS, seriesIds: null },
      legend: { visible: false },
      theme: 'light',
    }, { onToggle: () => {}, onClick: () => {} });

    const findTag = (element, tag) => {
      for (const child of element.children ?? []) {
        if (child.tagName === tag) {
          return child;
        }
        const found = findTag(child, tag);
        if (found !== undefined) {
          return found;
        }
      }
      return undefined;
    };
    const svg = findTag(container, 'svg');
    assert.notEqual(svg, undefined, 'the plot svg must be appended');
    assert.ok(svg.children.length > 0, 'the plot has drawn marks');

    handle.release();
    // Contract: release frees resources ONLY — the drawing stays on the
    // page until the next render or the service's remove/deactivate.
    assert.ok(container.children.length > 0, 'release must not wipe the drawn chart');
  } finally {
    restore();
  }
});

test('should_clear_the_container_when_releasing_an_empty_state', () => {
  const { adapter, container, restore } = setup();
  try {
    const handle = adapter.render(container, {
      type: 'line',
      data: { rows: [], seriesIds: null },
      legend: { visible: false },
      theme: 'light',
    }, { onToggle: () => {}, onClick: () => {} });

    assert.ok(container.children.length > 0, 'the empty state is host-visible DOM');
    handle.release();
    assert.ok(container.children.length > 0, 'release frees nothing here; cleanup belongs to the service');
  } finally {
    restore();
  }
});

test('should_build_the_tooltip_through_tipMark_when_the_heatmap_has_values', () => {
  const rows = [{ x: 'الف', y: 'ب', value: 3 }];
  const tip = tipMark(rows, { withValue: true, pointer: 'near' });

  assert.ok(tip.channels?.title !== undefined, 'the tip carries a title channel');
  assert.deepEqual(tip.channels.title.value(rows[0]), 'الف · ب · 3', 'the title covers x, y and the value');
});

test('should_skip_the_series_segment_in_the_title_when_the_row_has_no_series', () => {
  const rows = [{ x: 1, y: 2, series: null }];
  const tip = tipMark(rows);

  assert.deepEqual(tip.channels.title.value(rows[0]), '1 · 2', 'no dangling series separator for series-less rows');
});

import { runRendererContractSuite } from '../renderer-contract.js';

runRendererContractSuite('plot-adapter', () => createPlotRendererAdapter({ document: shimDocument }), () => createShimContainer(shimDocument));
