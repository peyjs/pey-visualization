// Loads and validates the configured chart renderer adapter. The renderer
// is the plugin's internal seam: today Observable Plot behind
// PlotRendererAdapter, tomorrow another engine behind another adapter —
// the service surface never changes.
//
// Contract: render(container, spec, handlers) → handle { release() }.
// The renderer draws into the container, manages tooltip/legend/resize
// itself, reports interactions through the handlers, and releases every
// resource it kept when release() is called.

import { DEFAULT_ADAPTER } from './constants.js';
import { createVisualizationError } from './error.js';

const RENDERER_METHODS = ['render'];

const RENDERER_ERROR_CODES = Object.freeze({
  INITIALIZATION_FAILED: 'VIS_ADAPTER_INITIALIZATION_FAILED',
  INVALID: 'VIS_ADAPTER_INVALID',
  NOT_FOUND: 'VIS_ADAPTER_NOT_FOUND',
});

const DEFAULT_RENDERER_LOADERS = Object.freeze({
  PlotRendererAdapter: async (adapterConfig) => {
    const { createPlotRendererAdapter } = await import('../adapters/plot/plot-renderer-adapter.js');
    return createPlotRendererAdapter(adapterConfig);
  },
});

function startupError(code, message) {
  return createVisualizationError(code, message, {}, 'startup');
}

function validateRenderer(renderer) {
  const isValid = renderer !== null
    && typeof renderer === 'object'
    && RENDERER_METHODS.every((methodName) => typeof renderer[methodName] === 'function');
  if (!isValid) {
    throw startupError(RENDERER_ERROR_CODES.INVALID, 'Configured chart renderer does not implement the required contract');
  }
}

/**
 * Loads, creates and validates the configured renderer adapter.
 * @param {string} [identifier] Configured adapter identifier.
 * @param {object} [adapterConfig={}] Adapter-specific configuration.
 * @param {Record<string, Function>} [rendererLoaders] Adapter factories.
 * @returns {Promise<object>} Validated renderer adapter.
 * @throws {object} Standard startup error for unknown, failed or invalid renderers.
 */
export async function loadRenderer(
  identifier = DEFAULT_ADAPTER,
  adapterConfig = {},
  rendererLoaders = DEFAULT_RENDERER_LOADERS,
) {
  const loaders = rendererLoaders ?? DEFAULT_RENDERER_LOADERS;
  const loader = typeof identifier === 'string' ? loaders[identifier] : undefined;
  if (typeof loader !== 'function') {
    throw startupError(RENDERER_ERROR_CODES.NOT_FOUND, 'Configured chart renderer is not supported');
  }
  let renderer;
  try {
    renderer = await loader(adapterConfig ?? {});
  } catch (error) {
    if (error?.code && String(error.code).startsWith('VIS_ADAPTER_')) {
      throw error;
    }
    throw startupError(RENDERER_ERROR_CODES.INITIALIZATION_FAILED, 'Configured chart renderer could not be initialized');
  }
  validateRenderer(renderer);
  return renderer;
}
