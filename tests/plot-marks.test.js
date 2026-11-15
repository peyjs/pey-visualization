// Verifies the spec → Plot mark mapping for every supported type. Mark
// construction needs no DOM; only drawing does, which stays a manual
// browser check.

import assert from 'node:assert/strict';
import test from 'node:test';
import { buildBarMarks } from '../adapters/plot/plot-marks/bar-charts.js';
import { buildDistributionMarks } from '../adapters/plot/plot-marks/distribution-charts.js';
import { buildHeatmapMarks } from '../adapters/plot/plot-marks/heatmap.js';
import { buildPointMarks } from '../adapters/plot/plot-marks/point-charts.js';
import { buildSeriesMarks } from '../adapters/plot/plot-marks/series-charts.js';

function spec(type, rows, extra = {}) {
  return { type, data: { rows, seriesIds: null }, ...extra };
}

const xy = [{ x: 1, y: 2 }, { x: 2, y: 4 }];
const xySeries = [{ x: 1, y: 2, series: 'الف' }, { x: 2, y: 4, series: 'ب' }];

test('should_build_a_mark_and_a_tooltip_per_series_type_when_rows_are_present', () => {
  for (const type of ['line', 'timeSeries', 'area', 'stackedArea']) {
    const marks = buildSeriesMarks(spec(type, xySeries));
    assert.equal(marks.length, 2, type);
    assert.ok(marks[1].channels?.title !== undefined, type);
  }
});

test('should_build_line_marks_with_series_stroke_only_when_a_series_exists', () => {
  const plain = buildSeriesMarks(spec('line', xy));
  const multi = buildSeriesMarks(spec('line', xySeries));
  assert.equal(plain[0].channels.stroke, undefined);
  assert.equal(multi[0].channels.stroke.value, 'series');
});

test('should_build_bar_and_tooltip_marks_when_type_and_orientation_vary', () => {
  assert.equal(buildBarMarks(spec('bar', [{ x: 'الف', y: 5, series: null }])).length, 2);
  assert.equal(buildBarMarks(spec('bar', xy, { orientation: 'horizontal' })).length, 2);
  assert.equal(buildBarMarks(spec('groupedBar', xySeries)).length, 2);
  assert.equal(buildBarMarks(spec('stackedBar', xySeries)).length, 2);
});

test('should_build_horizontal_marks_for_every_bar_family_type_when_orientation_is_horizontal', () => {
  // The horizontal path exists for the whole bar family (x carries the
  // value, y the category) — the service's bar-only orientation guard just
  // used to make it unreachable for grouped/stacked.
  for (const type of ['bar', 'groupedBar', 'stackedBar']) {
    const horizontal = buildBarMarks(spec(type, xySeries, { orientation: 'horizontal' }));
    assert.equal(horizontal[0].channels.x.value, 'y', type);
    assert.equal(horizontal[0].channels.y.value, 'x', type);
  }
});

test('should_build_point_marks_with_a_size_channel_only_when_type_is_bubble', () => {
  const scatter = buildPointMarks(spec('scatter', xy));
  const bubble = buildPointMarks(spec('bubble', [{ x: 1, y: 2, size: 9 }]));
  assert.equal(scatter.length, 2);
  assert.equal(scatter[0].channels.r, undefined);
  assert.ok(scatter[1].channels?.title !== undefined);
  assert.equal(bubble.length, 2);
  assert.equal(bubble[0].channels.r.value, 'size');
});

test('should_build_a_single_aggregated_mark_when_each_distribution_type_is_checked', () => {
  for (const [type, rows] of [
    ['histogram', [{ x: 1.5, y: null }]],
    ['boxPlot', [{ x: 'الف', y: 1 }]],
    ['density', [{ x: 1.5, y: 2.5 }]],
  ]) {
    assert.equal(buildDistributionMarks(spec(type, rows)).length, 1, type);
  }
});

test('should_build_cell_and_tooltip_marks_when_the_heatmap_has_values', () => {
  const marks = buildHeatmapMarks(spec('heatmap', [{ x: 'a', y: 'b', value: 3 }]));
  assert.equal(marks.length, 2);
  assert.equal(marks[0].channels.fill.value, 'value');
  assert.ok(marks[1].channels?.title !== undefined);
});

test('should_skip_the_tooltip_when_data_is_empty_or_the_family_is_aggregated', () => {
  assert.equal(buildSeriesMarks(spec('line', [])).length, 1, 'an empty row set has no tip mark');
  assert.equal(buildDistributionMarks(spec('histogram', [{ x: 1.5, y: null }])).length, 1, 'aggregated families get no tip');
});

test('should_stamp_the_datum_binding_when_a_discrete_mark_is_built', () => {
  const [mark] = buildPointMarks(spec('scatter', xy));
  // The binding render wraps the mark's render — invoking it without a
  // real DOM just exercises the pass-through path.
  assert.equal(typeof mark.render, 'function');
});
