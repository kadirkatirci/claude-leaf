import test from 'node:test';
import assert from 'node:assert/strict';
import CounterBadge from '../src/components/primitives/CounterBadge.js';
import { counterBadgeClass } from '../src/utils/ClassNames.js';
import { setupDom } from '../test-support/dom.js';

test('counter badges use the repo-owned accent class instead of host accent utilities', () => {
  const cleanup = setupDom();

  try {
    const badge = CounterBadge.create({ content: '3' });

    assert.match(counterBadgeClass(), /\bclp-counter-badge\b/);
    assert.match(badge.className, /\bclp-counter-badge\b/);
    assert.doesNotMatch(badge.className, /\bbg-accent-main-100\b/);
  } finally {
    cleanup();
  }
});
