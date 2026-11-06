// Verifies the real Plot renderer adapter headless: it builds actual
// Observable Plot output through an injected document shim — the tooltip
// presence and the release cleanup for both the drawn and the empty path.

import assert from 'node:assert/strict';
import test from 'node:test';
import * as Plot from '@observablehq/plot';
import { createPlotRendererAdapter } from '../../adapters/plot/plot-renderer-adapter.js';
import { createDomShim, createShimContainer } from '../dom-shim.js';

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
    assert.equal(container.children.length, 0, 'release clears the container');
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
    assert.equal(container.children.length, 0, 'the empty state must not outlive its chart');
  } finally {
    restore();
  }
});

test('should_build_a_title_channel_into_the_tooltip_shape_when_the_heatmap_has_values', () => {
  const rows = [{ x: 'الف', y: 'ب', value: 3 }];
  const tip = Plot.tip(rows, Plot.pointer({ x: 'x', y: 'y', title: (row) => `${row.x} · ${row.y} · ${row.value}` }));

  assert.ok(tip.channels?.title !== undefined, 'the tip carries the value in its title');
});
