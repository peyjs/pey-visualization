// Display-option slice normalizers for the pey.visualization plugin.
//
// Each host display slice (theme, size, margins, legend, axes, text,
// orientation, title) is normalized and validated here. Everything is
// optional: the defaults must already look good (requirement 4). The
// host's values are applied, never judged — colors, fonts, label texts and
// tick formats pass through as given. All validation errors carry the
// offending field.

import { ERROR_CODES } from '../constants.js';
import { createVisualizationError } from '../error.js';

// The theme names the plugin knows; the host decides which one applies.
export const THEMES = new Set(['light', 'dark']);

const ORIENTATIONS = new Set(['vertical', 'horizontal']);
const LEGEND_POSITIONS = new Set(['top', 'right', 'bottom', 'left']);
const TEXT_DIRECTIONS = new Set(['rtl', 'ltr']);

/**
 * Throws the structured invalid-options error.
 * @param {string} reason Machine-readable reason.
 * @param {string} field Offending option key.
 * @returns {never} Nothing; always throws.
 * @throws {object} VIS_INVALID_OPTIONS.
 */
function invalid(reason, field) {
  throw createVisualizationError(
    ERROR_CODES.INVALID_OPTIONS,
    'Chart options are invalid',
    { reason, field },
  );
}

/**
 * Keeps a string option only when it is a plain non-empty string.
 * @param {unknown} value Candidate.
 * @returns {string|undefined} The value, or undefined to fall back to defaults.
 */
function optionalString(value) {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/**
 * Keeps a finite positive number.
 * @param {unknown} value Candidate.
 * @returns {number|undefined} The value, or undefined to fall back.
 */
function optionalPositiveNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;
}

/**
 * Normalizes the theme slice: a light/dark theme name or a full custom
 * palette. The host decides the theme; the plugin never detects it.
 * @param {object} options Raw options.
 * @returns {object} Normalized theme `{ theme?, palette? }`.
 * @throws {object} VIS_INVALID_OPTIONS.
 */
function normalizeTheme(options) {
  const theme = optionalString(options.theme);
  if (theme !== undefined && !THEMES.has(theme)) {
    invalid('unknown-theme', 'theme');
  }
  const palette = options.palette;
  if (palette !== undefined) {
    if (palette === null || typeof palette !== 'object' || Array.isArray(palette)) {
      invalid('palette-not-an-object', 'palette');
    }
    const clean = {};
    for (const key of ['colors', 'background', 'textColor', 'gridColor', 'axisColor']) {
      if (palette[key] !== undefined) {
        if (key === 'colors') {
          if (!Array.isArray(palette.colors) || palette.colors.some((color) => typeof color !== 'string')) {
            invalid('palette-colors-not-strings', 'palette.colors');
          }
          clean.colors = palette.colors;
        } else if (typeof palette[key] !== 'string') {
          invalid('palette-value-not-a-string', `palette.${key}`);
        } else {
          clean[key] = palette[key];
        }
      }
    }
    return { ...(theme !== undefined ? { theme } : {}), ...(Object.keys(clean).length > 0 ? { palette: clean } : {}) };
  }
  return theme !== undefined ? { theme } : {};
}

/**
 * Normalizes the size slice: explicit width/height or an aspect ratio.
 * When neither is given the renderer takes the container's width and the
 * default aspect.
 * @param {object} options Raw options.
 * @returns {object} Normalized size slice.
 * @throws {object} VIS_INVALID_OPTIONS.
 */
function normalizeSize(options) {
  const size = {};
  const width = optionalPositiveNumber(options.width);
  const height = optionalPositiveNumber(options.height);
  const aspectRatio = optionalPositiveNumber(options.aspectRatio);
  if (options.width !== undefined && width === undefined) {
    invalid('width-not-a-positive-number', 'width');
  }
  if (options.height !== undefined && height === undefined) {
    invalid('height-not-a-positive-number', 'height');
  }
  if (options.aspectRatio !== undefined && aspectRatio === undefined) {
    invalid('aspect-ratio-not-a-positive-number', 'aspectRatio');
  }
  if (width !== undefined) {
    size.width = width;
  }
  if (height !== undefined) {
    size.height = height;
  } else if (aspectRatio !== undefined) {
    size.aspectRatio = aspectRatio;
  }
  return size;
}

/**
 * Normalizes the legend slice: visibility and position. Series toggling is
 * offered only when the renderer supports it.
 * @param {object} options Raw options.
 * @returns {object} Normalized legend slice.
 * @throws {object} VIS_INVALID_OPTIONS.
 */
function normalizeLegend(options) {
  const legend = options.legend;
  if (legend === undefined || legend === null) {
    return {};
  }
  if (typeof legend !== 'object' || Array.isArray(legend)) {
    invalid('legend-not-an-object', 'legend');
  }
  const clean = {};
  if (legend.visible !== undefined) {
    if (typeof legend.visible !== 'boolean') {
      invalid('legend-visible-not-boolean', 'legend.visible');
    }
    clean.visible = legend.visible;
  }
  if (legend.position !== undefined) {
    if (!LEGEND_POSITIONS.has(legend.position)) {
      invalid('unknown-legend-position', 'legend.position');
    }
    clean.position = legend.position;
  }
  return Object.keys(clean).length > 0 ? { legend: clean } : {};
}

/**
 * Normalizes the axes slice: labels, domains, tick handling — label texts
 * and tick formats come from the host untouched.
 * @param {object} options Raw options.
 * @returns {object} Normalized axes slice.
 * @throws {object} VIS_INVALID_OPTIONS.
 */
function normalizeAxes(options) {
  const axes = options.axes;
  if (axes === undefined || axes === null) {
    return {};
  }
  if (typeof axes !== 'object' || Array.isArray(axes)) {
    invalid('axes-not-an-object', 'axes');
  }
  const clean = {};
  for (const axis of ['x', 'y']) {
    const given = axes[axis];
    if (given === undefined || given === null) {
      continue;
    }
    if (typeof given !== 'object' || Array.isArray(given)) {
      invalid('axis-not-an-object', `axes.${axis}`);
    }
    const one = {};
    if (given.label !== undefined) {
      if (typeof given.label !== 'string') {
        invalid('axis-label-not-a-string', `axes.${axis}.label`);
      }
      one.label = given.label;
    }
    if (given.domain !== undefined) {
      if (!Array.isArray(given.domain) || given.domain.length !== 2) {
        invalid('axis-domain-not-a-pair', `axes.${axis}.domain`);
      }
      one.domain = given.domain;
    }
    if (given.tickFormat !== undefined && typeof given.tickFormat !== 'function') {
      invalid('axis-tick-format-not-a-function', `axes.${axis}.tickFormat`);
    }
    if (given.tickFormat !== undefined) {
      one.tickFormat = given.tickFormat;
    }
    if (Object.keys(one).length > 0) {
      clean[axis] = one;
    }
  }
  return Object.keys(clean).length > 0 ? { axes: clean } : {};
}

/**
 * Normalizes the text slice: direction (independent of the axes' own
 * direction), font family and base size.
 * @param {object} options Raw options.
 * @returns {object} Normalized text slice.
 * @throws {object} VIS_INVALID_OPTIONS.
 */
function normalizeText(options) {
  const text = options.text;
  if (text === undefined || text === null) {
    return {};
  }
  if (typeof text !== 'object' || Array.isArray(text)) {
    invalid('text-not-an-object', 'text');
  }
  const clean = {};
  if (text.direction !== undefined) {
    if (!TEXT_DIRECTIONS.has(text.direction)) {
      invalid('unknown-text-direction', 'text.direction');
    }
    clean.direction = text.direction;
  }
  const font = optionalString(text.font);
  if (text.font !== undefined && font === undefined) {
    invalid('font-not-a-string', 'text.font');
  }
  if (font !== undefined) {
    clean.font = font;
  }
  const fontSize = optionalPositiveNumber(text.fontSize);
  if (text.fontSize !== undefined && fontSize === undefined) {
    invalid('font-size-not-a-positive-number', 'text.fontSize');
  }
  if (fontSize !== undefined) {
    clean.fontSize = fontSize;
  }
  return Object.keys(clean).length > 0 ? { text: clean } : {};
}

/**
 * Normalizes the bar orientation slice (bar family only).
 * @param {object} options Raw options.
 * @param {string} type Chart type.
 * @returns {object} Normalized orientation slice.
 * @throws {object} VIS_INVALID_OPTIONS.
 */
function normalizeOrientation(options, type) {
  if (type !== 'bar' || options.orientation === undefined) {
    return {};
  }
  if (!ORIENTATIONS.has(options.orientation)) {
    invalid('unknown-orientation', 'orientation');
  }
  return { orientation: options.orientation };
}

/**
 * Normalizes the chart title and caption.
 * @param {object} options Raw options.
 * @returns {object} Normalized title slice.
 * @throws {object} VIS_INVALID_OPTIONS.
 */
function normalizeTitle(options) {
  const clean = {};
  const title = optionalString(options.title);
  if (options.title !== undefined && title === undefined) {
    invalid('title-not-a-string', 'title');
  }
  if (title !== undefined) {
    clean.title = title;
  }
  const caption = optionalString(options.caption);
  if (options.caption !== undefined && caption === undefined) {
    invalid('caption-not-a-string', 'caption');
  }
  if (caption !== undefined) {
    clean.caption = caption;
  }
  return Object.keys(clean).length > 0 ? clean : {};
}

/**
 * Normalizes the plot margins (the padding around the drawing).
 * @param {object} options Raw options.
 * @returns {object} Normalized margin slice.
 * @throws {object} VIS_INVALID_OPTIONS.
 */
function normalizeMargin(options) {
  const margin = options.margin;
  if (margin === undefined || margin === null) {
    return {};
  }
  if (typeof margin !== 'object' || Array.isArray(margin)) {
    invalid('margin-not-an-object', 'margin');
  }
  const clean = {};
  for (const side of ['top', 'right', 'bottom', 'left']) {
    const value = optionalPositiveNumber(margin[side]);
    if (margin[side] !== undefined && value === undefined) {
      invalid('margin-side-not-a-positive-number', `margin.${side}`);
    }
    if (value !== undefined) {
      clean[side] = value;
    }
  }
  return Object.keys(clean).length > 0 ? { margin: clean } : {};
}


export {
  invalid,
  normalizeAxes,
  normalizeLegend,
  normalizeMargin,
  normalizeOrientation,
  normalizeSize,
  normalizeText,
  normalizeTitle,
  normalizeTheme,
};
