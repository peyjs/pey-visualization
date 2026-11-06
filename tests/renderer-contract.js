// Reusable renderer contract suite for pey.visualization: every renderer
// implementation (the real Plot adapter here, the in-memory fake used by
// the service tests) must satisfy the same `render → { release }`
// contract. The release semantics follow the internal contract: release
// frees resources only and never wipes the container.

import assert from 'node:assert/strict';
import test from 'node:test';

const ROWS = [{ x: 1, y: 2, series: 'الف' }, { x: 2, y: 4, series: 'ب' }];

/**
 * Runs the whole renderer contract suite against one factory.
 * @param {string} label Suite label (implementation name).
 * @param {Function} createRenderer `() => { render(container, spec, handlers) }`.
 * @param {Function} createContainer Host container factory.
 */
export function runRendererContractSuite(label, createRenderer, createContainer) {
  test(`[${label}] should_return_a_handle_with_release_when_rendering`, () => {
    const renderer = createRenderer();
    const container = createContainer();
    const handle = renderer.render(container, { type: 'line', data: { rows: ROWS, seriesIds: null } }, {
      onToggle: () => {}, onClick: () => {},
    });

    assert.equal(typeof handle.release, 'function');
  });

  test(`[${label}] should_clear_the_container_at_the_start_of_each_render`, () => {
    const renderer = createRenderer();
    const container = createContainer();
    renderer.render(container, { type: 'line', data: { rows: ROWS, seriesIds: null } }, { onToggle: () => {}, onClick: () => {} });
    const sizeAfterFirst = container.children.length;

    renderer.render(container, { type: 'line', data: { rows: ROWS, seriesIds: null } }, { onToggle: () => {}, onClick: () => {} });

    assert.equal(container.children.length <= sizeAfterFirst, true, 'a second render must not stack content');
  });

  test(`[${label}] should_not_wipe_the_chart_when_release_is_called_after_a_redraw`, () => {
    // The exact P0 scenario: render → render (redraw) → release the FIRST
    // handle. The drawing of the second render must stay on the page.
    const renderer = createRenderer();
    const container = createContainer();
    const first = renderer.render(container, { type: 'line', data: { rows: ROWS, seriesIds: null } }, {
      onToggle: () => {}, onClick: () => {},
    });
    const second = renderer.render(container, { type: 'line', data: { rows: ROWS, seriesIds: null } }, {
      onToggle: () => {}, onClick: () => {},
    });

    first.release();

    assert.ok(container.children.length > 0, 'releasing the stale handle must not wipe the current chart');
    second.release();
  });

  test(`[${label}] should_render_the_empty_state_without_an_error_and_release_safely`, () => {
    const renderer = createRenderer();
    const container = createContainer();
    const handle = renderer.render(container, { type: 'line', data: { rows: [], seriesIds: null } }, {
      onToggle: () => {}, onClick: () => {},
    });

    handle.release();
    assert.equal(typeof handle.release, 'function');
  });
}
