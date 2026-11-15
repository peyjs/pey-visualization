// Unit tests for lib/spec/options-slices.js — a few representative
// normalizers (the full matrix lives in options-normalizer.test.js).

import assert from 'node:assert/strict';
import test from 'node:test';
import { THEME_NAMES } from '../lib/constants.js';
import { normalizeLegend, normalizeText, normalizeTheme } from '../lib/spec/options-slices.js';

test('should_keep_only_known_theme_names_when_normalizing_the_theme', () => {
  assert.deepEqual(normalizeTheme({ theme: 'dark' }), { theme: 'dark' });
  assert.throws(() => normalizeTheme({ theme: 'sepia' }), (error) => error.code === 'VIS_INVALID_OPTIONS');
});

test('should_expose_the_theme_names_the_plugin_knows_when_read', () => {
  // Single source of truth: the options validator and the renderer's color
  // tables both read this set — a new theme means one contract edit.
  assert.deepEqual([...THEME_NAMES].sort(), ['dark', 'light']);
});

test('should_normalize_the_legend_slice_when_visibility_and_position_are_given', () => {
  assert.deepEqual(normalizeLegend({ legend: { visible: false, position: 'bottom' } }), {
    legend: { visible: false, position: 'bottom' },
  });
  assert.throws(() => normalizeLegend({ legend: { position: 'corner' } }), (error) => error.code === 'VIS_INVALID_OPTIONS');
});

test('should_normalize_the_text_slice_when_direction_font_and_size_are_given', () => {
  assert.deepEqual(normalizeText({ text: { direction: 'rtl', font: 'Vazirmatn', fontSize: 13 } }), {
    text: { direction: 'rtl', font: 'Vazirmatn', fontSize: 13 },
  });
  assert.throws(() => normalizeText({ text: { direction: 'up' } }), (error) => error.code === 'VIS_INVALID_OPTIONS');
});
