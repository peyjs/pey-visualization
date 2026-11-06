// Verifies display-option normalization: sensible defaults, pass-through of
// host decisions, and structured errors for invalid values.

import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeOptions } from '../lib/spec/options-normalizer.js';

test('should_default_to_the_light_theme_when_no_options_are_given', () => {
  const { spec, channels } = normalizeOptions(undefined, 'line');
  assert.equal(spec.theme, 'light');
  assert.equal(channels, undefined);
});

test('should_use_the_plugin_config_theme_as_the_default_when_no_options_are_given', () => {
  assert.equal(normalizeOptions(undefined, 'line', { theme: 'dark' }).spec.theme, 'dark');
  assert.equal(normalizeOptions({}, 'line', { theme: 'bogus' }).spec.theme, 'light');
});

test('should_accept_a_named_theme_and_a_custom_palette_when_the_host_supplies_one', () => {
  const { spec } = normalizeOptions({ theme: 'dark' }, 'bar');
  assert.equal(spec.theme, 'dark');

  const custom = normalizeOptions({
    palette: { colors: ['#111', '#222'], background: '#000', textColor: '#fff' },
  }, 'bar');
  assert.deepEqual(custom.spec.palette, { colors: ['#111', '#222'], background: '#000', textColor: '#fff' });
});

test('should_carry_the_channel_field_names_when_the_host_names_its_columns', () => {
  const { channels } = normalizeOptions({ channels: { x: 'day', y: 'amount' } }, 'line');
  assert.deepEqual(channels, { x: 'day', y: 'amount' });
});

test('should_normalize_display_slices_when_the_host_supplies_display_options', () => {
  const { spec } = normalizeOptions({
    title: 'فروش ماه',
    caption: 'بر حسب میلیون تومان',
    width: 640,
    aspectRatio: 2,
    legend: { visible: true, position: 'bottom' },
    axes: { x: { label: 'ماه', domain: [1, 12] }, y: { label: 'مبلغ', tickFormat: (v) => String(v) } },
    text: { direction: 'rtl', font: 'Vazirmatn', fontSize: 13 },
    orientation: 'horizontal',
  }, 'bar');

  assert.deepEqual(spec, {
    title: 'فروش ماه',
    caption: 'بر حسب میلیون تومان',
    width: 640,
    aspectRatio: 2,
    legend: { visible: true, position: 'bottom' },
    axes: {
      x: { label: 'ماه', domain: [1, 12] },
      y: { label: 'مبلغ', tickFormat: spec.axes.y.tickFormat },
    },
    text: { direction: 'rtl', font: 'Vazirmatn', fontSize: 13 },
    orientation: 'horizontal',
    theme: 'light',
  });
});

test('should_reject_invalid_option_values_when_any_slice_is_malformed', () => {
  const cases = [
    [{ theme: 'sepia' }, 'unknown-theme', 'theme'],
    [{ palette: 'red' }, 'palette-not-an-object', 'palette'],
    [{ palette: { colors: [1, 2] } }, 'palette-colors-not-strings', 'palette.colors'],
    [{ width: -5 }, 'width-not-a-positive-number', 'width'],
    [{ height: 'big' }, 'height-not-a-positive-number', 'height'],
    [{ aspectRatio: 0 }, 'aspect-ratio-not-a-positive-number', 'aspectRatio'],
    [{ legend: { visible: 'yes' } }, 'legend-visible-not-boolean', 'legend.visible'],
    [{ legend: { position: 'corner' } }, 'unknown-legend-position', 'legend.position'],
    [{ axes: { x: { label: 3 } } }, 'axis-label-not-a-string', 'axes.x.label'],
    [{ axes: { y: { domain: [1] } } }, 'axis-domain-not-a-pair', 'axes.y.domain'],
    [{ axes: { x: { tickFormat: 'x' } } }, 'axis-tick-format-not-a-function', 'axes.x.tickFormat'],
    [{ text: { direction: 'up' } }, 'unknown-text-direction', 'text.direction'],
    [{ text: { font: 12 } }, 'font-not-a-string', 'text.font'],
    [{ margin: 'big' }, 'margin-not-an-object', 'margin'],
    [{ margin: { top: -1 } }, 'margin-side-not-a-positive-number', 'margin.top'],
    [{ title: 5 }, 'title-not-a-string', 'title'],
    [{ channels: 'x' }, 'channels-not-an-object', 'channels'],
    ['nope', 'options-not-an-object', 'options'],
  ];
  for (const [options, reason, field] of cases) {
    assert.throws(
      () => normalizeOptions(options, 'bar'),
      (error) => error.code === 'VIS_INVALID_OPTIONS' && error.detail.reason === reason && error.detail.field === field,
      `${field}: ${JSON.stringify(options)}`,
    );
  }
});
