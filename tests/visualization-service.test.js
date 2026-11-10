// Verifies the visualization service over a fake renderer and fake
// containers — no DOM, no chart library at test time.

import assert from 'node:assert/strict';
import test from 'node:test';
import { createVisualizationService } from '../lib/visualization-service.js';
import { runRendererContractSuite } from './renderer-contract.js';

/**
 * A fake renderer: records every render and its handle, replays toggles
 * and clicks on demand, and can be told to fail on the next render.
 */
function createFakeRenderer() {
  const renderer = {
    renders: [],
    released: [],
    render(container, spec, handlers) {
      if (renderer.failNext) {
        renderer.failNext = false;
        throw new Error('plot exploded');
      }
      if (renderer.failWhen && renderer.failWhen(spec)) {
        throw new Error('plot refused these rows');
      }
      // Mirrors the real adapter contract: render clears the container at
      // start (a placeholder stands in for the drawn chart) and release
      // frees resources without touching the container.
      container.replaceChildren();
      container.append({ placeholder: true, spec });
      const handle = { release: () => renderer.released.push(spec) };
      renderer.renders.push({ container, spec, handlers, handle });
      return handle;
    },
  };
  return renderer;
}

function createFakeContainer(width = 800) {
  return {
    appended: [],
    get children() {
      return this.appended;
    },
    clientWidth: width,
    style: {},
    dir: '',
    append(child) {
      this.appended.push(child);
    },
    replaceChildren() {
      this.appended.length = 0;
    },
  };
}

function createService({ config } = {}) {
  const published = [];
  const renderer = createFakeRenderer();
  const { service, deactivate } = createVisualizationService({
    renderer,
    events: { publish: (type, data) => published.push({ type, data }) },
    config: config ?? {},
  });
  return { service, deactivate, renderer, published };
}

function lastRender(renderer) {
  return renderer.renders.at(-1);
}

// The service fake must satisfy the same render contract as the real Plot
// adapter — one suite, both implementations.
runRendererContractSuite('service-fake-renderer', () => createFakeRenderer(), () => createFakeContainer());

const LINE_ROWS = [{ x: 1, y: 2 }, { x: 2, y: 4 }, { x: 3, y: 6 }];

function createLine(service, overrides = {}) {
  return service.create({
    container: createFakeContainer(),
    type: 'line',
    data: { rows: LINE_ROWS },
    options: { title: 'اولیه' },
    ...overrides,
  });
}

// --- create ---------------------------------------------------------------

test('should_create_independent_charts_with_unique_ids_when_created_one_after_another', () => {
  const { service } = createService();
  const first = createLine(service);
  const second = createLine(service);

  assert.notEqual(first.id, second.id);
  assert.equal(typeof first.id, 'string');
});

test('should_hand_the_renderer_a_normalized_library_neutral_spec_when_a_chart_is_created', () => {
  const { service, renderer } = createService();
  createLine(service, {
    data: { rows: [{ day: 'شنبه', amount: 3 }] },
    options: { title: 'فروش', channels: { x: 'day', y: 'amount' } },
  });

  const { spec } = lastRender(renderer);
  assert.equal(spec.type, 'line');
  assert.equal(spec.title, 'فروش');
  assert.deepEqual(spec.data.rows, [{ x: 'شنبه', y: 3, series: null }]);
});

test('should_reject_an_invalid_container_with_its_own_code_when_the_container_is_not_an_element', () => {
  const { service } = createService();

  for (const container of [null, undefined, '', '#missing-in-node']) {
    assert.throws(
      () => service.create({ container, type: 'line', data: { rows: LINE_ROWS } }),
      (error) => error.code === 'VIS_INVALID_CONTAINER',
      String(container),
    );
  }
});

test('should_reject_unknown_types_and_invalid_data_and_options_when_validation_fails', () => {
  const { service } = createService();

  assert.throws(
    () => service.create({ container: createFakeContainer(), type: 'pie', data: { rows: LINE_ROWS } }),
    (error) => error.code === 'VIS_UNKNOWN_CHART_TYPE',
  );
  assert.throws(
    () => service.create({ container: createFakeContainer(), type: 'line', data: { rows: [{ x: 1 }] } }),
    (error) => error.code === 'VIS_INVALID_DATA',
  );
  assert.throws(
    () => service.create({ container: createFakeContainer(), type: 'line', data: { rows: LINE_ROWS }, options: { width: -1 } }),
    (error) => error.code === 'VIS_INVALID_OPTIONS',
  );
});

test('should_render_the_empty_state_when_data_is_empty_without_an_error', () => {
  const { service, renderer } = createService();

  const { id } = service.create({ container: createFakeContainer(), type: 'line', data: { rows: [] } });
  assert.equal(lastRender(renderer).spec.data.rows.length, 0);
  assert.equal(service.remove(id).ok, true);
});

test('should_resolve_a_selector_through_the_document_when_given_a_string', () => {
  const { service, renderer } = createService();
  const element = createFakeContainer();
  const original = globalThis.document;
  globalThis.document = { querySelector: (selector) => (selector === '#chart' ? element : null) };

  try {
    const { id } = service.create({ container: '#chart', type: 'line', data: { rows: LINE_ROWS } });
    assert.equal(lastRender(renderer).container, element);
    assert.equal(service.remove(id).ok, true);
  } finally {
    if (original === undefined) {
      delete globalThis.document;
    } else {
      globalThis.document = original;
    }
  }
});

// --- update ----------------------------------------------------------------

test('should_update_data_alone_and_keep_the_previous_options_when_only_data_is_sent', () => {
  const { service, renderer } = createService();
  const { id } = createLine(service);

  service.update(id, { data: { rows: [{ x: 9, y: 1 }] } });

  const { spec } = lastRender(renderer);
  assert.deepEqual(spec.data.rows, [{ x: 9, y: 1, series: null }]);
  assert.equal(spec.title, 'اولیه');
});

test('should_update_options_alone_and_keep_the_previous_data_when_only_options_are_sent', () => {
  const { service, renderer } = createService();
  const { id } = createLine(service);

  service.update(id, { options: { title: 'تازه', theme: 'dark' } });

  const { spec } = lastRender(renderer);
  assert.deepEqual(spec.data.rows.map(({ x, y }) => ({ x, y })), LINE_ROWS);
  assert.equal(spec.title, 'تازه');
  assert.equal(spec.theme, 'dark');
});

test('should_reject_an_empty_update_and_unknown_ids_when_the_input_is_useless', () => {
  const { service } = createService();
  const { id } = createLine(service);

  assert.throws(
    () => service.update(id, {}),
    (error) => error.code === 'VIS_INVALID_OPTIONS' && error.detail.reason === 'nothing-to-update',
  );
  assert.throws(() => service.update('nope', { data: { rows: [] } }), (error) => error.code === 'VIS_UNKNOWN_CHART');
});

// --- remove ----------------------------------------------------------------

test('should_remove_one_chart_without_disturbing_the_others_when_others_exist', () => {
  const { service, renderer } = createService();
  const first = createLine(service);
  const second = createLine(service);

  assert.equal(service.remove(first.id).ok, true);
  assert.equal(renderer.released.length, 1);
  assert.throws(() => service.update(first.id, { data: { rows: [] } }), (error) => error.code === 'VIS_UNKNOWN_CHART');

  // The survivor still updates.
  assert.equal(service.update(second.id, { data: { rows: [{ x: 1, y: 1 }] } }).ok, true);
});

test('should_fail_removing_an_unknown_chart_when_the_id_is_unknown', () => {
  const { service } = createService();
  assert.throws(() => service.remove('nope'), (error) => error.code === 'VIS_UNKNOWN_CHART');
});

// --- interaction events -----------------------------------------------------

test('should_relay_series_toggles_and_keep_the_choice_across_updates_when_the_legend_toggles', () => {
  const { service, renderer, published } = createService();
  const { id } = service.create({
    container: createFakeContainer(),
    type: 'line',
    data: { rows: [{ x: 1, y: 2, series: 'الف' }, { x: 2, y: 4, series: 'ب' }] },
  });

  lastRender(renderer).handlers.onToggle('الف', false);
  assert.deepEqual(published.at(-1), { type: 'visualization:series-toggled', data: { chartId: id, seriesId: 'الف', visible: false } });

  service.update(id, { data: { rows: [{ x: 1, y: 2, series: 'الف' }, { x: 2, y: 4, series: 'ب' }] } });
  const { spec } = lastRender(renderer);
  assert.deepEqual(spec.data.seriesIds, ['الف', 'ب'], 'seriesIds stays full so the legend keeps the hidden series toggleable');
  assert.equal(spec.data.rows.some((row) => row.series === 'الف'), false, 'only the mark rows are filtered');
});

test('should_release_every_intermediate_handle_when_a_toggle_redraw_fails', () => {
  // The rollback render's handle must be released before the reverted
  // redraw replaces it — every failed toggle used to leak a whole live
  // render (ResizeObserver included).
  const { service, renderer } = createService();
  service.create({
    container: createFakeContainer(),
    type: 'line',
    data: { rows: [{ x: 1, y: 2, series: 'الف' }, { x: 2, y: 4, series: 'ب' }] },
  });

  renderer.failWhen = (spec) => spec.data.rows.length === 1;
  lastRender(renderer).handlers.onToggle('الف', false);
  renderer.failWhen = null;

  assert.equal(renderer.released.length, renderer.renders.length - 1, 'only the live handle stays unreleased');
});

test('should_carry_the_visibility_state_on_the_spec_when_the_legend_needs_it', () => {
  // The legend reads spec.seriesVisibility to render hidden series as
  // unchecked — a state that lives nowhere on the spec would render every
  // redraw as "all visible" and make a hidden series unrecoverable.
  const { service, renderer } = createService();
  service.create({
    container: createFakeContainer(),
    type: 'line',
    data: { rows: [{ x: 1, y: 2, series: 'الف' }, { x: 2, y: 4, series: 'ب' }] },
  });

  lastRender(renderer).handlers.onToggle('الف', false);

  const { spec } = lastRender(renderer);
  assert.equal(spec.seriesVisibility.get('الف'), false, 'the redrawn spec carries the real state');
  assert.notEqual(spec.seriesVisibility.get('ب'), false);

  lastRender(renderer).handlers.onToggle('الف', true);
  assert.notEqual(lastRender(renderer).spec.seriesVisibility.get('الف'), false, 'the series is recoverable');
});

test('should_report_and_revert_a_failed_toggle_redraw_when_the_renderer_fails', () => {
  // A redraw failure is never silent: no series-toggled event fires for a
  // drawing that never happened, the structured failure is published, and
  // the reverted state is redrawn so picture, state and legend agree.
  const { service, renderer, published } = createService();
  const { id } = service.create({
    container: createFakeContainer(),
    type: 'line',
    data: { rows: [{ x: 1, y: 2, series: 'الف' }, { x: 2, y: 4, series: 'ب' }] },
  });

  renderer.failWhen = (spec) => spec.data.rows.length === 1;
  lastRender(renderer).handlers.onToggle('الف', false);

  const types = published.map((event) => event.type);
  assert.ok(!types.includes('visualization:series-toggled'), 'no toggle event for a redraw that never happened');
  const failed = published.find((event) => event.type === 'visualization:render-failed');
  assert.notEqual(failed, undefined, 'the failure is reported to the host');
  assert.deepEqual(failed.data, { chartId: id, operation: 'series-toggle', code: 'VIS_RENDER_FAILED' });

  const { spec } = lastRender(renderer);
  assert.notEqual(spec.seriesVisibility.get('الف'), false, 'the reverted state is what the redraw carries');
  assert.equal(spec.data.rows.length, 2, 'both series are back on the drawing');
});

test('should_relay_clicks_with_chart_series_and_datum_identity_when_a_mark_is_clicked', () => {
  const { service, renderer, published } = createService();
  const { id } = createLine(service);

  lastRender(renderer).handlers.onClick({ seriesId: null, datum: { x: 2, y: 4, series: null } });

  assert.deepEqual(published.at(-1), {
    type: 'visualization:clicked',
    data: { chartId: id, seriesId: null, datum: { x: 2, y: 4, series: null } },
  });
});

// --- failure handling --------------------------------------------------------

test('should_report_render_failures_structured_and_leave_no_chart_behind_when_the_first_render_fails', () => {
  const { service, renderer } = createService();
  renderer.failNext = true;

  assert.throws(
    () => createLine(service),
    (error) => error.code === 'VIS_RENDER_FAILED' && error.detail.cause === 'plot exploded',
  );
  assert.equal(renderer.renders.length, 0);
});

test('should_roll_back_to_the_previous_drawing_when_a_re_render_fails', () => {
  const { service, renderer } = createService();
  const { id } = createLine(service);
  const rendersBeforeUpdate = renderer.renders.length;

  renderer.failWhen = (spec) => spec.data.rows.length === 99;
  assert.throws(
    () => service.update(id, { data: { rows: Array.from({ length: 99 }, (_, i) => ({ x: i, y: i })) } }),
    (error) => error.code === 'VIS_RENDER_FAILED',
  );

  // The rollback re-render restored the previous data.
  const { spec } = lastRender(renderer);
  assert.deepEqual(spec.data.rows.map(({ x, y }) => ({ x, y })), LINE_ROWS);
  assert.ok(renderer.renders.length > rendersBeforeUpdate);
  assert.equal(service.update(id, { options: { title: 'بعد از شکست' } }).ok, true);
});

// --- lifecycle ----------------------------------------------------------------

test('should_remove_every_chart_and_refuse_every_call_when_the_plugin_deactivates', () => {
  const { service, deactivate, renderer } = createService();
  const first = createLine(service);
  const second = createLine(service);

  deactivate();

  assert.equal(renderer.released.length, 2);
  assert.throws(() => service.create({
    container: createFakeContainer(),
    type: 'line',
    data: { rows: LINE_ROWS },
  }), (error) => error.code === 'SERVICE_UNAVAILABLE');
  assert.throws(() => service.update(first.id, { data: { rows: [] } }), (error) => error.code === 'SERVICE_UNAVAILABLE');
  assert.throws(() => service.remove(second.id), (error) => error.code === 'SERVICE_UNAVAILABLE');
});

test('should_never_put_chart_data_into_events_when_events_are_published', () => {
  const { service, renderer, published } = createService();
  const { id } = service.create({
    container: createFakeContainer(),
    type: 'bar',
    data: { rows: [{ x: 'محرمانه', y: 5, series: 'سری محرمانه' }] },
  });

  lastRender(renderer).handlers.onToggle('سری محرمانه', false);
  lastRender(renderer).handlers.onClick({ seriesId: 'سری محرمانه', datum: null });

  const dumped = JSON.stringify(published.map((event) => event.type));
  assert.equal(dumped.includes('محرمانه'), false);
  assert.ok(published.every((event) => event.data.chartId === id));
});

// --- review regressions ---------------------------------------------------

test('should_leave_the_chart_untouched_when_an_update_fails_validation', () => {
  const { service, renderer } = createService();
  const { id } = createLine(service);
  const rendersBefore = renderer.renders.length;

  // A data validation failure must not poison the stored entry: the chart
  // keeps its previous data and stays updatable.
  assert.throws(
    () => service.update(id, { data: { rows: [{ x: 'نه-عدد', y: 'نه-عدد' }] } }),
    (error) => error.code === 'VIS_INVALID_DATA',
  );

  const { spec } = lastRender(renderer);
  assert.deepEqual(spec.data.rows.map(({ x, y }) => ({ x, y })), LINE_ROWS, 'the previous data survives');
  assert.equal(renderer.renders.length, rendersBefore, 'no re-render was attempted with poisoned data');
  const { id: second } = service.update(id, { options: { title: 'بعد از شکست اعتبارسنجی' } });
  void second;
  const after = lastRender(renderer);
  assert.equal(after.spec.title, 'بعد از شکست اعتبارسنجی', 'the chart stays updatable after the failure');
});

test('should_apply_a_series_toggle_to_the_drawing_immediately_when_toggled', () => {
  const { service, renderer } = createService();
  const { id } = service.create({
    container: createFakeContainer(),
    type: 'line',
    data: { rows: [{ x: 1, y: 2, series: 'الف' }, { x: 2, y: 4, series: 'ب' }] },
  });
  const rowsBefore = lastRender(renderer).spec.data.rows.length;

  lastRender(renderer).handlers.onToggle('ب', false);

  const after = lastRender(renderer);
  assert.ok(after.spec.data.rows.length < rowsBefore, 'the hidden series left the drawing right away');

  // The choice persists across the next update render too.
  service.update(id, { options: { title: 'تازه' } });
  assert.equal(lastRender(renderer).spec.data.rows.length, after.spec.data.rows.length);
});
