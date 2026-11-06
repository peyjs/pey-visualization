// Unit tests for lib/error.js — the pey.visualization boundary error
// factory and the cause-description helper.

import assert from 'node:assert/strict';
import test from 'node:test';
import { createVisualizationError, describeCause } from '../lib/error.js';

test('should_build_standard_structured_error_when_called_with_code_and_message', () => {
  const error = createVisualizationError('VIS_RENDER_FAILED', 'The chart could not be rendered', { chartId: 'c1' });

  assert.equal(error.code, 'VIS_RENDER_FAILED');
  assert.equal(error.source, 'pey.visualization');
  assert.equal(error.type, 'operational');
  assert.equal(error.detail.chartId, 'c1');
  assert.ok(!Number.isNaN(Date.parse(error.timestamp)));
});

test('should_accept_the_startup_type_when_the_loader_fails', () => {
  const error = createVisualizationError('VIS_ADAPTER_NOT_FOUND', 'x', {}, 'startup');

  assert.equal(error.type, 'startup');
});

test('should_reject_unsupported_codes_and_types_when_misused', () => {
  assert.throws(() => createVisualizationError('lowercase', 'x'), TypeError);
  assert.throws(() => createVisualizationError('VIS_RENDER_FAILED', 'x', undefined, 'fatal'), TypeError);
});

test('should_describe_errors_safely_when_arbitrary_things_are_thrown', () => {
  assert.equal(describeCause(new Error('raw message')), 'raw message');
  assert.equal(describeCause('plain string'), 'plain string');
  assert.equal(describeCause(undefined), undefined);
});
