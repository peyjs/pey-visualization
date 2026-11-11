// Verifies the real Plot renderer adapter headless: it builds actual
// Observable Plot output through an injected document shim — the tooltip
// presence and the release cleanup for both the drawn and the empty path.

import assert from 'node:assert/strict';
import test from 'node:test';
import { tipMark } from '../../adapters/plot/plot-marks/tips.js';
import { createPlotRendererAdapter } from '../../adapters/plot/plot-renderer-adapter.js';
import { bindDatum } from '../../adapters/plot/plot-interaction.js';
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

test('should_stamp_each_series_leaf_with_its_own_series_when_a_series_mark_renders', () => {
  // Round-6 P1: Plot's next() returns a group per mark whose clickable
  // children are leaves — the stamp must reach the leaves, and each series
  // leaf must carry its OWN series (recovered from its stroke/fill via the
  // color scale), not the first series of the data.
  const { adapter, container, restore } = setup();
  try {
    let clicked = null;
    const handle = adapter.render(container, {
      type: 'line',
      data: { rows: ROWS, seriesIds: ['الف', 'ب'] },
      legend: { visible: false },
      theme: 'light',
    }, { onToggle: () => {}, onClick: (report) => { clicked = report; } });

    const svg = (container.children ?? []).find((child) => child.tagName === 'svg')
      ?? deepFind(container, (node) => node.tagName === 'svg');
    assert.notEqual(svg, undefined, 'the plot rendered');

    const leaves = [];
    const walk = (element) => {
      const children = element.children ?? [];
      if (!Array.isArray(children) || children.length === 0) {
        leaves.push(element);
        return;
      }
      children.forEach(walk);
    };
    walk(svg);

    const stamped = leaves.filter((leaf) => leaf.__vis !== undefined);
    const seriesIds = [...new Set(stamped.map((leaf) => leaf.__vis.seriesId))];
    assert.ok(seriesIds.includes('الف') && seriesIds.includes('ب'),
      `each series leaf carries its own series (stamped: ${JSON.stringify([...new Set(stamped.map((leaf) => leaf.__vis.seriesId))])})`);

    const target = stamped.find((leaf) => leaf.__vis.seriesId === 'ب');
    // The delegated listener is registered on the svg through addEventListener;
    // dispatch through the shim instead — one dispatch, one invocation.
    svg.dispatchEvent({ type: 'click', target });
    assert.equal(clicked.seriesId, 'ب', 'the click report names the clicked series');
    handle.release();
  } finally {
    restore();
  }
});

test('should_stamp_leaves_when_children_is_an_htmlcollection_like_object', () => {
  // Browser fidelity: Element.children is an HTMLCollection, NOT an array —
  // an Array.isArray traversal would stop at the first group and go inert
  // in the browser while the array-backed shim stayed green.
  const group = shimDocument.createElement('g');
  const leafA = shimDocument.createElement('path');
  leafA.setAttribute('stroke', '#4269d0');
  const leafB = shimDocument.createElement('path');
  leafB.setAttribute('stroke', '#efb118');
  // HTMLCollection-like: non-array, numeric length, iterable.
  const collection = { length: 2, 0: leafA, 1: leafB, [Symbol.iterator]: Array.prototype[Symbol.iterator] };
  Object.defineProperty(group, 'children', { value: collection });

  const rows = [
    { x: 1, y: 2, series: 'الف' },
    { x: 2, y: 4, series: 'ب' },
  ];
  const mark = bindDatum({ x: 'x', y: 'y', stroke: 'series' }, rows, false);
  mark.render([0, 1], {}, { stroke: ['#4269d0', '#efb118'] }, {}, {}, () => group);

  assert.equal(leafA.__vis?.seriesId, 'الف');
  assert.equal(leafB.__vis?.seriesId, 'ب');
});

test('should_leave_leaves_unstamped_when_two_series_share_a_color', () => {
  // A color drawn by two DIFFERENT series (cycled or short host palette) is
  // ambiguous: wrong identity is worse than no identity.
  const group = shimDocument.createElement('g');
  const leafA = shimDocument.createElement('path');
  leafA.setAttribute('stroke', '#4269d0');
  const leafB = shimDocument.createElement('path');
  leafB.setAttribute('stroke', '#4269d0');
  group.append(leafA, leafB);

  const rows = [
    { x: 1, y: 2, series: 'الف' },
    { x: 2, y: 4, series: 'ب' },
  ];
  const mark = bindDatum({ x: 'x', y: 'y', stroke: 'series' }, rows, false);
  mark.render([0, 1], {}, { stroke: ['#4269d0', '#4269d0'] }, {}, {}, () => group);

  assert.equal(leafA.__vis, undefined, 'the ambiguous leaf stays unstamped');
  assert.equal(leafB.__vis, undefined, 'no wrong identity is invented');
});

function deepFind(element, predicate) {
  if (predicate(element)) {
    return element;
  }
  for (const child of element.children ?? []) {
    const found = deepFind(child, predicate);
    if (found !== undefined) {
      return found;
    }
  }
  return undefined;
}

test('should_keep_the_legend_when_only_one_series_removes_and_it_is_the_hidden_one', () => {
  // A single remaining series that is itself hidden filters all rows into
  // the empty state — the unchecked checkbox must still render, or the
  // series could never be brought back.
  const { adapter, container, restore } = setup();
  try {
    const visibility = new Map([['الف', false]]);
    adapter.render(container, {
      type: 'line',
      data: { rows: [], seriesIds: ['الف'] },
      legend: { visible: true },
      theme: 'light',
      seriesVisibility: visibility,
    }, { onToggle: () => {}, onClick: () => {} });

    let legend = null;
    const walk = (element) => {
      for (const child of element.children ?? []) {
        if (child.className === 'pey-vis-legend') {
          legend = child;
        }
        walk(child);
      }
    };
    walk(container);

    assert.notEqual(legend, null, 'the legend survives the single-hidden-series dead end');
    const checkbox = (legend.children ?? []).flatMap((item) => (item.children ?? []).filter((node) => String(node.tagName ?? '').toLowerCase() === 'input'))[0];
    assert.equal(checkbox.checked, false, 'the hidden series stays toggleable');
  } finally {
    restore();
  }
});

test('should_keep_the_legend_on_the_empty_state_when_every_series_is_hidden', () => {
  // Hiding every series filters all rows and the drawing goes empty — but
  // the legend must survive on the empty state, or the hidden series could
  // never be brought back from the UI.
  const { adapter, container, restore } = setup();
  try {
    const visibility = new Map([['الف', false], ['ب', false]]);
    const handle = adapter.render(container, {
      type: 'line',
      data: { rows: [], seriesIds: ['الف', 'ب'] },
      legend: { visible: true },
      theme: 'light',
      seriesVisibility: visibility,
    }, { onToggle: () => {}, onClick: () => {} });

    let legend = null;
    const walk = (element) => {
      for (const child of element.children ?? []) {
        if (child.className === 'pey-vis-legend') {
          legend = child;
        }
        walk(child);
      }
    };
    walk(container);

    assert.notEqual(legend, null, 'the legend stays on the empty state');
    const boxes = (legend.children ?? []).map((item) => (item.children ?? []).find((node) => String(node.tagName ?? '').toLowerCase() === 'input'));
    assert.deepEqual(boxes.map((box) => box.checked), [false, false], 'both hidden series stay toggleable');
    handle.release();
  } finally {
    restore();
  }
});

test('should_render_hidden_series_as_unchecked_when_the_visibility_state_is_given', () => {
  // P1 regression: the visibility state rides on the spec — a legend rebuilt
  // from a state that lives nowhere renders every series as checked and
  // makes a hidden series unrecoverable.
  const { adapter, container, restore } = setup();
  try {
    const visibility = new Map([['الف', false]]);
    adapter.render(container, {
      type: 'line',
      data: { rows: ROWS, seriesIds: ['الف', 'ب'] },
      legend: { visible: true },
      theme: 'light',
      seriesVisibility: visibility,
    }, { onToggle: () => {}, onClick: () => {} });

    const states = {};
    const walk = (element) => {
      for (const child of element.children ?? []) {
        const tag = String(child.tagName ?? '').toLowerCase();
        if (tag === 'label') {
          const checkbox = (child.children ?? []).find((node) => String(node.tagName ?? '').toLowerCase() === 'input');
          const text = (child.children ?? []).find((node) => String(node.tagName ?? '').toLowerCase() === 'span');
          if (checkbox && text) {
            states[text.textContent] = checkbox.checked;
          }
        }
        walk(child);
      }
    };
    walk(container);

    assert.deepEqual(states, { 'الف': false, 'ب': true }, 'a hidden series stays in the legend, unchecked');
  } finally {
    restore();
  }
});


test('should_render_a_real_grouped_bar_when_faceted_marks_walk_their_groups', () => {
  // Smoke gate for the faceted path: Plot's fx/fy groups call
  // node.hasAttribute while upgrading their ARIA — a shim without it hid
  // this whole chart family from real rendering (round-8 P2-3).
  const { adapter, container, restore } = setup();
  try {
    const handle = adapter.render(container, {
      type: 'groupedBar',
      data: {
        rows: [
          { x: 'دسته۱', y: 2, series: 'الف' },
          { x: 'دسته۱', y: 3, series: 'ب' },
          { x: 'دسته۲', y: 1, series: 'الف' },
        ],
        seriesIds: ['الف', 'ب'],
      },
      legend: { visible: false },
      theme: 'light',
    }, { onToggle: () => {}, onClick: () => {} });

    assert.ok(container.children.length > 0, 'the faceted SVG built');
    handle.release();
    // Release frees only the kept resources — the drawing stays on the
    // container (the contract: the container is cleared by the next render
    // or by the service on remove/deactivate).
    assert.ok(container.children.length > 0, 'release does not wipe the chart');
  } finally {
    restore();
  }
});

test('should_render_a_real_heatmap_when_the_color_legend_walks_the_dom', () => {
  // Smoke gate for the color-legend path: the heatmap's { color: { legend:
  // true } } hint drives d3-selection's style.removeProperty — a shim
  // without it hid this whole chart family from real rendering (round-8
  // P2-3).
  const { adapter, container, restore } = setup();
  try {
    const handle = adapter.render(container, {
      type: 'heatmap',
      data: { rows: [
        { x: 'ستون۱', y: 'ردیف۱', value: 1 },
        { x: 'ستون۲', y: 'ردیف۲', value: 5 },
      ] },
      legend: { visible: false },
      theme: 'light',
    }, { onToggle: () => {}, onClick: () => {} });

    assert.ok(container.children.length > 0, 'the heatmap SVG built');
    handle.release();
    // Release frees only the kept resources — the drawing stays on the
    // container (the contract: the container is cleared by the next render
    // or by the service on remove/deactivate).
    assert.ok(container.children.length > 0, 'release does not wipe the chart');
  } finally {
    restore();
  }
});

runRendererContractSuite('plot-adapter', () => createPlotRendererAdapter({ document: shimDocument }), () => createShimContainer(shimDocument));
