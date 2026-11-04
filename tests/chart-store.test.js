// Verifies the chart store (registry + cleanup) and the renderer loader
// (unknown, broken, incomplete adapters).

import assert from 'node:assert/strict';
import test from 'node:test';
import { createChartStore } from '../lib/chart-store.js';
import { loadRenderer } from '../lib/renderer-loader.js';

test('should_register_charts_with_unique_ids_and_return_them', () => {
  const store = createChartStore();
  const first = store.add({ container: {} });
  const second = store.add({ container: {} });

  assert.notEqual(first, second);
  assert.equal(store.ids().length, 2);
  assert.equal(store.has(first), true);
  assert.equal(store.get(second).id, second);
});

test('should_keep_entries_by_reference_so_live_updates_stay_visible', () => {
  const store = createChartStore();
  const id = store.add({ spec: { title: 'قدیمی' } });
  const entry = store.get(id);
  entry.spec = { title: 'تازه' };

  assert.equal(store.get(id).spec.title, 'تازه');
  assert.equal(store.ids().length, 1);
});

test('should_remove_one_chart_without_touching_the_others', () => {
  const store = createChartStore();
  const first = store.add({ container: {} });
  const second = store.add({ container: {} });

  const removed = store.remove(first);
  assert.equal(removed.id, first);
  assert.equal(store.has(first), false);
  assert.equal(store.has(second), true);
});

test('should_remove_all_charts_on_shutdown', () => {
  const store = createChartStore();
  store.add({ container: {} });
  store.add({ container: {} });

  const removed = store.removeAll();
  assert.equal(removed.length, 2);
  assert.equal(store.ids().length, 0);
});

// --- renderer loader -------------------------------------------------------

const GOOD_RENDERER = {
  render: (container, spec, handlers) => ({ release() {} }),
};

test('should_load_a_known_good_renderer', async () => {
  const renderer = await loadRenderer('FakeRenderer', {}, {
    FakeRenderer: async () => GOOD_RENDERER,
  });
  assert.equal(renderer, GOOD_RENDERER);
});

test('should_default_to_the_configured_default_identifier', async () => {
  const renderer = await loadRenderer(undefined, {}, {
    PlotRendererAdapter: async () => GOOD_RENDERER,
  });
  assert.equal(renderer, GOOD_RENDERER);
});

test('should_reject_unknown_and_non_string_identifiers', async () => {
  for (const identifier of ['NoSuchRenderer', undefined]) {
    const error = await loadRenderer(identifier, {}, {}).catch((caught) => caught);
    assert.equal(error.code, 'VIS_ADAPTER_NOT_FOUND');
    assert.equal(error.type, 'startup');
  }
});

test('should_reject_a_broken_renderer_factory', async () => {
  const error = await loadRenderer('Broken', {}, {
    Broken: async () => {
      throw new Error('plot failed to load');
    },
  }).catch((caught) => caught);
  assert.equal(error.code, 'VIS_ADAPTER_INITIALIZATION_FAILED');
  assert.equal(error.type, 'startup');
});

test('should_reject_a_renderer_missing_the_contract', async () => {
  const error = await loadRenderer('Incomplete', {}, {
    Incomplete: async () => ({}),
  }).catch((caught) => caught);
  assert.equal(error.code, 'VIS_ADAPTER_INVALID');
  assert.equal(error.type, 'startup');
});

test('should_survive_a_null_loader_registry_argument', async () => {
  const error = await loadRenderer('PlotRendererAdapter', {}, null).catch((caught) => caught);
  // The default registry is used; Plot is not available outside a browser
  // build without its package, so this either loads (dev install) or
  // fails at initialization — never NOT_FOUND.
  assert.notEqual(error?.code, 'VIS_ADAPTER_NOT_FOUND');
});
