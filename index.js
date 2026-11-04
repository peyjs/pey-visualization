// Wires the visualization service into Bonyan's two-phase lifecycle.

import { DEFAULT_ADAPTER, SERVICE_NAME } from './lib/constants.js';
import { loadRenderer } from './lib/renderer-loader.js';
import { createVisualizationService } from './lib/visualization-service.js';

const state = { renderer: null, events: null, config: {} };
let lifecycle = null;

/**
 * Prepares the plugin: loads the configured chart renderer and builds the
 * service. Nothing is drawn at startup; charts exist only after create.
 * @param {object} prepareContext Bonyan preparation context.
 * @returns {Promise<Array>} Service registration.
 * @throws {object} Structured startup error when the renderer fails.
 */
export async function prepare(prepareContext) {
  state.renderer = null;
  state.events = prepareContext.events ?? null;
  state.config = prepareContext.config ?? {};
  prepareContext.onDeactivated = () => lifecycle?.deactivate();
  prepareContext.onShutdown = async () => lifecycle?.deactivate();

  const config = state.config;
  state.renderer = await loadRenderer(
    config.adapter ?? DEFAULT_ADAPTER,
    config.adapterConfig ?? {},
  );
  lifecycle = createVisualizationService(state);
  return [{ name: SERVICE_NAME, object: lifecycle.service }];
}

/**
 * Activates the dependency-free visualization plugin after settlement.
 *
 * @param {Record<string, object>} services Bound declared dependencies; always empty here.
 * @returns {Promise<void>}
 */
export async function activate(services) {
  void services;
}
