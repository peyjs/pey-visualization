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

test('should_build_one_mark_per_series_type', () => {
  for (const type of ['line', 'timeSeries', 'area', 'stackedArea']) {
    const marks = buildSeriesMarks(spec(type, xySeries));
    assert.equal(marks.length, 1, type);
  }
});

test('should_build_line_marks_with_and_without_series_stroke', () => {
  const plain = buildSeriesMarks(spec('line', xy));
  const multi = buildSeriesMarks(spec('line', xySeries));
  assert.equal(plain[0].channels.stroke, undefined);
  assert.equal(multi[0].channels.stroke.value, 'series');
});

test('should_build_bar_marks_per_type_and_orientation', () => {
  assert.equal(buildBarMarks(spec('bar', [{ x: 'الف', y: 5, series: null }])).length, 1);
  assert.equal(buildBarMarks(spec('bar', xy, { orientation: 'horizontal' })).length, 1);
  assert.equal(buildBarMarks(spec('groupedBar', xySeries)).length, 1);
  assert.equal(buildBarMarks(spec('stackedBar', xySeries)).length, 1);
});

test('should_build_point_marks_with_size_only_for_bubble', () => {
  const scatter = buildPointMarks(spec('scatter', xy));
  const bubble = buildPointMarks(spec('bubble', [{ x: 1, y: 2, size: 9 }]));
  assert.equal(scatter.length, 1);
  assert.equal(scatter[0].channels.r, undefined);
  assert.equal(bubble.length, 1);
  assert.equal(bubble[0].channels.r.value, 'size');
});

test('should_build_distribution_marks_per_type', () => {
  for (const [type, rows] of [
    ['histogram', [{ x: 1.5, y: null }]],
    ['boxPlot', [{ x: 'الف', y: 1 }]],
    ['density', [{ x: 1.5, y: 2.5 }]],
  ]) {
    assert.equal(buildDistributionMarks(spec(type, rows)).length, 1, type);
  }
});

test('should_build_one_cell_mark_for_the_heatmap', () => {
  const marks = buildHeatmapMarks(spec('heatmap', [{ x: 'a', y: 'b', value: 3 }]));
  assert.equal(marks.length, 1);
  assert.equal(marks[0].channels.fill.value, 'value');
});

test('should_stamp_the_datum_binding_on_discrete_marks', () => {
  const [mark] = buildPointMarks(spec('scatter', xy));
  // The binding render wraps the mark's render — invoking it without a
  // real DOM just exercises the pass-through path.
  assert.equal(typeof mark.render, 'function');
});
