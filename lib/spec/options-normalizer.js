// Normalizes and validates the host's display options into the chart
// spec's options slice. The orchestration lives here; each display slice
// has its own normalizer in options-slices.js.

import { DEFAULT_THEME, THEME_NAMES } from '../constants.js';
import { createVisualizationError } from '../error.js';
import { DEFAULT_CHANNELS } from './data-validator.js';
import {
  invalid,
  normalizeAxes,
  normalizeLegend,
  normalizeMargin,
  normalizeOrientation,
  normalizeSize,
  normalizeText,
  normalizeTitle,
  normalizeTheme,
} from './options-slices.js';

/**
 * Resolves the effective theme: the configured default when the plugin
 * config carries a known theme name, otherwise the built-in default.
 * @param {unknown} configured Configured theme.
 * @returns {string} Effective theme.
 */
function themeOrDefault(configured) {
  return typeof configured === 'string' && THEME_NAMES.has(configured) ? configured : DEFAULT_THEME;
}

/**
 * Normalizes and validates the options `channels` slice: every entry must
 * name a KNOWN channel with a non-empty string field. The other options
 * slices all reject bad values with a named reason and field — silently
 * dropping a bad channels entry sent the host chasing a misleading
 * data-side error ("Row is missing the "series" channel") when the real
 * mistake was a mistyped option (e.g. `serise: 'cat'`), or a non-string
 * field name.
 * @param {object} channels Raw channels slice (non-null plain object).
 * @returns {object} Cleaned channels (known keys with string fields only).
 * @throws {object} VIS_INVALID_OPTIONS.
 */
function normalizeChannels(channels) {
  const clean = {};
  for (const [channel, field] of Object.entries(channels)) {
    if (!Object.hasOwn(DEFAULT_CHANNELS, channel)) {
      invalid('unknown-channel', `channels.${channel}`);
    }
    if (typeof field !== 'string' || field.length === 0) {
      invalid('channel-not-a-string', `channels.${channel}`);
    }
    clean[channel] = field;
  }
  return clean;
}

/**
 * Normalizes and validates the full display-options set for one chart.
 * @param {object} [options] Raw host options.
 * @param {string} type Chart type.
 * @param {object} [defaults] Plugin-config defaults ({ theme }).
 * @returns {{channels?: object, spec: object}} Normalized options; `channels`
 *   carries the host's channel field names for data validation, `spec` the
 *   display slice for the renderer.
 * @throws {object} VIS_INVALID_OPTIONS.
 */
export function normalizeOptions(options, type, defaults = {}) {
  if (options === undefined || options === null) {
    return { spec: { theme: themeOrDefault(defaults.theme) } };
  }
  if (typeof options !== 'object' || Array.isArray(options)) {
    invalid('options-not-an-object', 'options');
  }

  const theme = normalizeTheme(options);
  const spec = {
    ...normalizeTitle(options),
    ...normalizeSize(options),
    ...normalizeMargin(options),
    ...normalizeLegend(options),
    ...normalizeAxes(options),
    ...normalizeText(options),
    ...normalizeOrientation(options, type),
    theme: theme.theme ?? themeOrDefault(defaults.theme),
  };
  if (theme.palette) {
    spec.palette = theme.palette;
  }
  const result = { spec };
  if (options.channels !== undefined) {
    if (options.channels === null || typeof options.channels !== 'object' || Array.isArray(options.channels)) {
      invalid('channels-not-an-object', 'channels');
    }
    result.channels = normalizeChannels(options.channels);
  }
  return result;
}
