import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hasRenderableUsage,
  isUsageStateStale,
  mergeUsageState,
  normalizeMessageLimitPayload,
  normalizeUsagePayload,
} from '../src/modules/UsageTrackerModule/UsageState.js';

test('normalizeUsagePayload converts settings usage response to renderable windows', () => {
  const nowMs = Date.parse('2026-04-11T15:10:00.000Z');
  const state = normalizeUsagePayload(
    {
      five_hour: {
        utilization: 63.0,
        resets_at: '2026-04-11T18:00:00.000Z',
      },
      seven_day: {
        utilization: 13.0,
        resets_at: '2026-04-18T11:00:00.000Z',
      },
    },
    nowMs
  );

  assert.equal(Math.round(state.session.percent), 63);
  assert.equal(Math.round(state.weekly.percent), 13);
  assert.match(state.session.title, /Session 63%/);
  assert.match(state.weekly.title, /Weekly 13%/);
  assert.equal(hasRenderableUsage(state), true);
});

test('normalizeMessageLimitPayload converts completion SSE window ratios', () => {
  const state = normalizeMessageLimitPayload({
    windows: {
      '5h': {
        utilization: 0.62,
        resets_at: 1775930400,
      },
      '7d': {
        utilization: 0.12,
        resets_at: 1776510000,
      },
    },
  });

  assert.equal(Math.round(state.session.percent), 62);
  assert.equal(Math.round(state.weekly.percent), 12);
  assert.equal(state.source, 'message_limit');
});

test('mergeUsageState preserves previous windows when a partial update arrives', () => {
  const previousState = normalizeUsagePayload({
    five_hour: {
      utilization: 40,
      resets_at: '2026-04-11T18:00:00.000Z',
    },
    seven_day: {
      utilization: 11,
      resets_at: '2026-04-18T11:00:00.000Z',
    },
  });
  const partialState = {
    source: 'message_limit',
    updatedAtMs: Date.now(),
    session: previousState.session,
    weekly: null,
  };

  const merged = mergeUsageState(previousState, partialState);

  assert.equal(Math.round(merged.session.percent), 40);
  assert.equal(Math.round(merged.weekly.percent), 11);
});

test('isUsageStateStale detects missing or old updates', () => {
  assert.equal(isUsageStateStale(null), true);
  assert.equal(isUsageStateStale({ updatedAtMs: Date.now() - 10_000 }, 20_000), false);
  assert.equal(isUsageStateStale({ updatedAtMs: Date.now() - 30_000 }, 20_000), true);
});
