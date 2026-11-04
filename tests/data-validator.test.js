// Verifies per-family data validation: canonical row shaping, per-type
// requirements, structured invalid-data errors, and the empty-data rule.

import assert from 'node:assert/strict';
import test from 'node:test';
import { validateData } from '../lib/spec/data-validator.js';

function rejectsWithReason(promise, reason, field) {
  return assert.rejects(promise, (error) => error?.code === 'VIS_INVALID_DATA'
    && error?.detail?.reason === reason
    && (field === undefined || error?.detail?.field === field));
}

test('should_validate_series_rows_into_canonical_shape', () => {
  const spec = validateData('line', [
    { day: 'دوشنبه', amount: 10, cat: 'الف' },
    { day: 'سه‌شنبه', amount: 20, cat: 'ب' },
  ], { x: 'day', y: 'amount', series: 'cat' });

  assert.deepEqual(spec.rows, [
    { x: 'دوشنبه', y: 10, series: 'الف' },
    { x: 'سه‌شنبه', y: 20, series: 'ب' },
  ]);
  assert.deepEqual(spec.seriesIds, ['الف', 'ب']);
});

test('should_keep_series_optional_for_plain_rows_but_available_for_stacking', async () => {
  const plain = validateData('line', [{ x: 1, y: 2 }]);
  assert.deepEqual(plain.rows, [{ x: 1, y: 2, series: null }]);
  assert.equal(plain.seriesIds, null);

  // The stacked variant renders per series; rows without the series field
  // are a data error naming the missing field.
  await rejectsWithReason(
    Promise.resolve().then(() => validateData('stackedArea', [{ x: 1, y: 2 }])),
    'missing-channel',
    'series',
  );
  await rejectsWithReason(
    Promise.resolve().then(() => validateData('groupedBar', [{ x: 'الف', y: 1 }])),
    'missing-channel',
    'series',
  );
});

test('should_validate_plain_bar_rows_without_series', () => {
  const spec = validateData('bar', [{ cat: 'الف', v: 5 }], { x: 'cat', y: 'v' });
  assert.deepEqual(spec.rows, [{ x: 'الف', y: 5, series: null }]);
  assert.equal(spec.seriesIds, null);
});

test('should_validate_point_rows_and_require_size_for_bubble', async () => {
  const scatter = validateData('scatter', [{ a: 1, b: 2 }], { x: 'a', y: 'b' });
  assert.deepEqual(scatter.rows, [{ x: 1, y: 2, size: null }]);

  await rejectsWithReason(
    Promise.resolve().then(() => validateData('bubble', [{ a: 1, b: 2 }], { x: 'a', y: 'b' })),
    'missing-channel',
    'size',
  );

  const bubble = validateData('bubble', [{ a: 1, b: 2, pop: 30 }], { x: 'a', y: 'b', size: 'pop' });
  assert.deepEqual(bubble.rows, [{ x: 1, y: 2, size: 30 }]);
});

test('should_validate_distribution_rows_per_type', () => {
  const histogram = validateData('histogram', [{ v: 1.5 }, { v: 2.5 }], { x: 'v' });
  assert.deepEqual(histogram.rows, [{ x: 1.5, y: null }, { x: 2.5, y: null }]);

  const box = validateData('boxPlot', [{ cat: 'الف', v: 1 }, { cat: 'الف', v: 7 }], { x: 'cat', y: 'v' });
  assert.deepEqual(box.rows, [{ x: 'الف', y: 1 }, { x: 'الف', y: 7 }]);
});

test('should_validate_heatmap_rows_with_numeric_value', () => {
  const spec = validateData('heatmap', [{ c: 'شنبه', h: '۱۰', t: 31 }], { x: 'c', y: 'h', value: 't' });
  assert.deepEqual(spec.rows, [{ x: 'شنبه', y: '۱۰', value: 31 }]);
});

test('should_report_missing_or_non_finite_channels_with_row_index', async () => {
  assert.throws(
    () => validateData('line', [{ x: 1 }, { x: 2 }]),
    (error) => error.code === 'VIS_INVALID_DATA'
      && error.detail.reason === 'missing-channel'
      && error.detail.index === 0
      && error.detail.field === 'y',
  );
  assert.throws(
    () => validateData('line', [{ x: 1, y: Number.NaN }]),
    (error) => error.code === 'VIS_INVALID_DATA' && error.detail.reason === 'channel-not-finite',
  );
  assert.throws(
    () => validateData('line', [null]),
    (error) => error.code === 'VIS_INVALID_DATA' && error.detail.reason === 'row-not-an-object',
  );
});

test('should_reject_non_row_shapes_and_series_values_that_are_not_scalar', async () => {
  assert.throws(() => validateData('line', 'nope'), (error) => error.code === 'VIS_INVALID_DATA' && error.detail.reason === 'not-a-row-list');
  assert.throws(() => validateData('line', { nope: 1 }), (error) => error.code === 'VIS_INVALID_DATA' && error.detail.reason === 'not-a-row-list');
  assert.throws(
    () => validateData('line', [{ x: 1, y: 2, series: { nested: true } }]),
    (error) => error.code === 'VIS_INVALID_DATA' && error.detail.reason === 'missing-channel',
  );
});

test('should_accept_empty_data_for_every_type_as_the_empty_state', () => {
  for (const type of ['line', 'timeSeries', 'area', 'stackedArea', 'bar', 'groupedBar', 'stackedBar', 'scatter', 'bubble', 'dot', 'histogram', 'boxPlot', 'density', 'heatmap']) {
    const spec = validateData(type, []);
    assert.deepEqual(spec.rows, [], type);
  }
});

test('should_reject_unknown_chart_types_with_their_own_code', async () => {
  assert.throws(
    () => validateData('pie', [{ x: 1, y: 2 }]),
    (error) => error.code === 'VIS_UNKNOWN_CHART_TYPE' && error.detail.type === 'pie',
  );
  assert.throws(
    () => validateData('donut', [{ x: 1, y: 2 }]),
    (error) => error.code === 'VIS_UNKNOWN_CHART_TYPE',
  );
});
