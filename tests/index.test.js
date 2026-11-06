// Verifies the entry-point lifecycle wiring and the manifest contract.

import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { prepare } from '../index.js';

const MANIFEST_PATH = new URL('../manifest.json', import.meta.url);
const PACKAGE_PATH = new URL('../package.json', import.meta.url);

function createPrepareContext(overrides = {}) {
  return {
    config: {},
    events: {
      publish: () => {},
      subscribe: () => () => {},
    },
    onShutdown: null,
    onDeactivated: null,
    reportCriticalError: () => {},
    ...overrides,
  };
}

test('should_register_service_when_prepare_is_called', async () => {
  const context = createPrepareContext();

  const registrations = await prepare(context);

  assert.equal(registrations.length, 1);
  assert.equal(registrations[0].name, 'pey.visualization.service');
  assert.equal(typeof registrations[0].object.create, 'function');
  assert.equal(typeof registrations[0].object.update, 'function');
  assert.equal(typeof registrations[0].object.remove, 'function');
  assert.equal(typeof context.onShutdown, 'function');
  assert.equal(typeof context.onDeactivated, 'function');
});

test('should_load_the_default_renderer_adapter_when_prepare_runs', async () => {
  const registrations = await prepare(createPrepareContext());
  assert.equal(typeof registrations[0].object.create, 'function');
});

test('should_reject_startup_when_the_configured_renderer_is_unknown', async () => {
  const context = createPrepareContext({ config: { adapter: 'NoSuchRenderer' } });

  await assert.rejects(
    () => prepare(context),
    (error) => error.code === 'VIS_ADAPTER_NOT_FOUND' && error.type === 'startup',
  );
});

test('should_activate_without_binding_anything_when_there_are_no_dependencies', async () => {
  const { activate } = await import('../index.js');
  await activate({});
});

test('should_match_manifest_contract_when_loaded', async () => {
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));
  const pkg = JSON.parse(await readFile(PACKAGE_PATH, 'utf8'));

  assert.equal(manifest.name, 'pey.visualization');
  assert.equal(manifest.version, pkg.version);
  assert.equal(manifest.type, 'feature');
  assert.equal(manifest.adapterType, undefined);
  assert.deepEqual(manifest.dependencies, { required: [], optional: [] });
  assert.equal(manifest.provides.length, 1);
  assert.equal(manifest.provides[0].name, 'pey.visualization.service');
  const methodNames = manifest.provides[0].methods.map((method) => method.name);
  assert.deepEqual(methodNames, ['create', 'update', 'remove']);
  assert.deepEqual(manifest.events.map((event) => event.name), ['visualization:clicked', 'visualization:series-toggled']);
  assert.deepEqual(manifest.config, { adapter: 'PlotRendererAdapter', adapterConfig: {}, theme: 'light' });
});
