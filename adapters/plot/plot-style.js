// Theme and style mapping for the Plot renderer: the host's theme choice
// or custom palette becomes Plot style options and wrapper styles. Text
// direction is applied on the wrapper, independent of the axes. The theme
// NAME contract lives in lib/constants.js (THEME_NAMES); this table only
// carries the renderer's colors per name.

import { DEFAULT_THEME, THEME_NAMES } from '../../lib/constants.js';

const THEMES = Object.freeze({
  light: Object.freeze({
    background: '#ffffff',
    textColor: '#1a1a1a',
    gridColor: '#e2e2e2',
    axisColor: '#666666',
  }),
  dark: Object.freeze({
    background: '#1e1e1e',
    textColor: '#eeeeee',
    gridColor: '#444444',
    axisColor: '#9a9a9a',
  }),
});

// A categorical palette that stays readable on both themes.
const CATEGORY_COLORS = Object.freeze([
  '#4269d0', '#efb118', '#ff725c', '#6cc5b0', '#3ca951',
  '#ff8ab7', '#a463f2', '#97bbf5', '#c7b5e2', '#ffb54d',
]);

/**
 * Resolves the effective palette for one chart: the host's palette wins,
 * the named theme fills the rest.
 * @param {object} spec Chart spec (theme?, palette?).
 * @returns {object} `{ background, textColor, gridColor, axisColor, colors }`.
 */
export function resolvePalette(spec) {
  const theme = THEMES[THEME_NAMES.has(spec.theme) ? spec.theme : DEFAULT_THEME] ?? THEMES.light;
  const palette = spec.palette ?? {};
  return {
    background: palette.background ?? theme.background,
    textColor: palette.textColor ?? theme.textColor,
    gridColor: palette.gridColor ?? theme.gridColor,
    axisColor: palette.axisColor ?? theme.axisColor,
    colors: Array.isArray(palette.colors) && palette.colors.length > 0 ? palette.colors : [...CATEGORY_COLORS],
  };
}

/**
 * Builds the CSS style string applied to the rendered plot.
 * @param {object} spec Chart spec.
 * @param {object} palette Resolved palette.
 * @returns {string} CSS text.
 */
export function plotCss(spec, palette) {
  const font = spec.text?.font ? `font-family: ${spec.text.font};` : '';
  const size = spec.text?.fontSize ? `font-size: ${spec.text.fontSize}px;` : '';
  return `color: ${palette.textColor}; background: ${palette.background}; ${font} ${size}`;
}

/**
 * Builds the wrapper styles: direction is the text's own, independent of
 * the axes' direction (requirement 7).
 * @param {object} spec Chart spec.
 * @returns {object} Wrapper styles `{ direction, fontFamily, fontSize }`.
 */
export function wrapperStyle(spec) {
  return {
    direction: spec.text?.direction ?? 'ltr',
    fontFamily: spec.text?.font,
    fontSize: spec.text?.fontSize,
  };
}

/**
 * Maps the axes slice into Plot scale options (labels, domains, tick
 * formats, grid) — the host's label texts and tick formats pass through
 * untouched.
 * @param {object} spec Chart spec.
 * @param {object} palette Resolved palette.
 * @returns {object} `{ x?, y? }` Plot scale options.
 */
export function axisScaleOptions(spec, palette) {
  const scales = {};
  for (const axis of ['x', 'y']) {
    const given = spec.axes?.[axis];
    if (!given) {
      continue;
    }
    const one = { grid: true, color: palette.axisColor };
    if (given.label !== undefined) {
      one.label = given.label;
    }
    if (given.domain !== undefined) {
      one.domain = given.domain;
    }
    if (given.tickFormat !== undefined) {
      one.tickFormat = given.tickFormat;
    }
    scales[axis] = one;
  }
  return scales;
}

/**
 * Computes the plot size: explicit width/height from the spec, else the
 * container width with the default (or given) aspect ratio.
 * @param {object} spec Chart spec.
 * @param {object} element Container element.
 * @returns {{width: number, height: number}} Pixel size.
 */
export function plotSize(spec, element) {
  const width = spec.width ?? readClientWidth(element) ?? 640;
  const height = spec.height ?? Math.round(width / (spec.aspectRatio ?? 1.6));
  return { width, height };
}

/**
 * Reads the container's current client width when available.
 * @param {object} element Container element.
 * @returns {number|undefined} Width.
 */
function readClientWidth(element) {
  const width = element?.clientWidth;
  return typeof width === 'number' && width > 0 ? width : undefined;
}
