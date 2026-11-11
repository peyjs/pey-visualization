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

test('should_validate_series_rows_into_canonical_shape_when_series_are_present', () => {
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

test('should_keep_series_optional_when_plain_rows_are_validated_but_require_it_for_stacking', async () => {
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

test('should_validate_plain_bar_rows_when_no_series_is_given', () => {
  const spec = validateData('bar', [{ cat: 'الف', v: 5 }], { x: 'cat', y: 'v' });
  assert.deepEqual(spec.rows, [{ x: 'الف', y: 5, series: null }]);
  assert.equal(spec.seriesIds, null);
});

test('should_require_the_size_channel_when_bubble_rows_are_validated', async () => {
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

test('should_validate_distribution_rows_when_each_type_is_checked', () => {
  const histogram = validateData('histogram', [{ v: 1.5 }, { v: 2.5 }], { x: 'v' });
  assert.deepEqual(histogram.rows, [{ x: 1.5, y: null }, { x: 2.5, y: null }]);

  const box = validateData('boxPlot', [{ cat: 'الف', v: 1 }, { cat: 'الف', v: 7 }], { x: 'cat', y: 'v' });
  assert.deepEqual(box.rows, [{ x: 'الف', y: 1 }, { x: 'الف', y: 7 }]);
});

test('should_validate_heatmap_rows_when_values_are_numeric', () => {
  const spec = validateData('heatmap', [{ c: 'شنبه', h: '۱۰', t: 31 }], { x: 'c', y: 'h', value: 't' });
  assert.deepEqual(spec.rows, [{ x: 'شنبه', y: '۱۰', value: 31 }]);
});

test('should_report_the_row_index_when_a_channel_is_missing_or_non_finite', async () => {
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

test('should_reject_non_row_shapes_when_series_values_are_not_scalar', async () => {
  assert.throws(() => validateData('line', 'nope'), (error) => error.code === 'VIS_INVALID_DATA' && error.detail.reason === 'not-a-row-list');
  assert.throws(() => validateData('line', { nope: 1 }), (error) => error.code === 'VIS_INVALID_DATA' && error.detail.reason === 'not-a-row-list');
  assert.throws(
    () => validateData('line', [{ x: 1, y: 2, series: { nested: true } }]),
    (error) => error.code === 'VIS_INVALID_DATA' && error.detail.reason === 'unsupported-channel-type',
  );
  // A Date is a documented channel value ONLY on the series family's x
  // (the temporal channel): as a category, key or series id it is an
  // object identity and must refuse — series identity keyed on a Date
  // would break on every update with fresh instances.
  assert.deepEqual(validateData('timeSeries', [{ x: new Date('2024-01-01'), y: 2 }]).rows, [{ x: new Date('2024-01-01'), y: 2, series: null }]);
  assert.throws(
    () => validateData('line', [{ x: 1, y: 2, series: new Date('2024-01-01') }]),
    (error) => error.code === 'VIS_INVALID_DATA' && error.detail.reason === 'unsupported-channel-type',
  );
  assert.throws(
    () => validateData('bar', [{ x: new Date('2024-01-01'), y: 2 }]),
    (error) => error.code === 'VIS_INVALID_DATA' && error.detail.reason === 'unsupported-channel-type',
  );
  assert.throws(
    () => validateData('heatmap', [{ x: 'a', y: new Date('2024-01-01'), value: 1 }]),
    (error) => error.code === 'VIS_INVALID_DATA' && error.detail.reason === 'unsupported-channel-type',
  );
  // A boolean is present-but-unusable too — the same honest reason, never
  // "missing".
  assert.throws(
    () => validateData('line', [{ x: true, y: 2 }]),
    (error) => error.code === 'VIS_INVALID_DATA'
      && error.detail.reason === 'unsupported-channel-type'
      && error.message.includes('must be a scalar or a Date'),
  );
});

test('should_accept_a_null_series_as_no_series_when_the_optional_channel_is_checked', () => {
  // Round-11 regression: an explicit null and an absent field are two
  // spellings of the same intent — the validator's own normalized output
  // uses `series: null` for exactly this shape, so the input null must be
  // accepted, not reported as a missing channel.
  const withNull = validateData('line', [{ x: 1, y: 2, series: null }]);
  assert.deepEqual(withNull.rows, [{ x: 1, y: 2, series: null }]);
  const withoutField = validateData('line', [{ x: 1, y: 2 }]);
  assert.deepEqual(withoutField, withNull, 'null and absent behave identically');
  // But the SERIES-REQUIRED family still refuses a null series.
  assert.throws(
    () => validateData('stackedArea', [{ x: 1, y: 2, series: null }]),
    (error) => error.code === 'VIS_INVALID_DATA' && error.detail.reason === 'missing-channel',
  );
});

test('should_reject_function_bigint_and_symbol_channels_when_the_whitelist_is_checked', () => {
  // Round-11 regression: the scalar guard is a WHITELIST (number/string,
  // plus a Date on the temporal channel). The old blacklist let these
  // three types through — some rendered silently wrong on the real
  // adapter, one died inside Plot.plot as a raw VIS_RENDER_FAILED cause
  // instead of a named data error.
  for (const value of [() => 1, 1n, Symbol('s')]) {
    assert.throws(
      () => validateData('line', [{ x: value, y: 2 }]),
      (error) => error.code === 'VIS_INVALID_DATA' && error.detail.reason === 'unsupported-channel-type',
      typeof value,
    );
    assert.throws(
      () => validateData('line', [{ x: 1, y: 2, series: value }]),
      (error) => error.code === 'VIS_INVALID_DATA' && error.detail.reason === 'unsupported-channel-type',
      typeof value,
    );
  }
});

test('should_accept_empty_data_as_the_empty_state_when_every_type_is_checked', () => {
  for (const type of ['line', 'timeSeries', 'area', 'stackedArea', 'bar', 'groupedBar', 'stackedBar', 'scatter', 'bubble', 'dot', 'histogram', 'boxPlot', 'density', 'heatmap']) {
    const spec = validateData(type, []);
    assert.deepEqual(spec.rows, [], type);
  }
});

test('should_reject_unknown_chart_types_with_their_own_code_when_the_type_is_unknown', async () => {
  assert.throws(
    () => validateData('pie', [{ x: 1, y: 2 }]),
    (error) => error.code === 'VIS_UNKNOWN_CHART_TYPE' && error.detail.type === 'pie',
  );
  assert.throws(
    () => validateData('donut', [{ x: 1, y: 2 }]),
    (error) => error.code === 'VIS_UNKNOWN_CHART_TYPE',
  );
});
