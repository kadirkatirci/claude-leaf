import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import {
  CHAT_TEST_SURFACES,
  REAL_CHAT_FIXTURES,
  SYNTHETIC_CHAT_FIXTURES,
  listAllChatFixtureIds,
} from './e2e/support/chatFixtures.js';

const require = createRequire(import.meta.url);
const { getFixtureById } = require('./fixtures/lib/fixture-router.cjs');

function collectSurfaceFixtureIds() {
  const ids = new Set();

  Object.values(CHAT_TEST_SURFACES).forEach(surface => {
    if (Array.isArray(surface)) {
      surface.forEach(id => ids.add(id));
      return;
    }

    Object.values(surface).forEach(id => ids.add(id));
  });

  return [...ids];
}

test('all declared chat fixtures resolve in the fixture router', () => {
  const ids = new Set([...listAllChatFixtureIds(), ...collectSurfaceFixtureIds()]);

  ids.forEach(id => {
    assert.ok(getFixtureById(id), `Expected fixture "${id}" to exist`);
  });
});

test('real chat fixtures stay read-only capture-backed surfaces', () => {
  Object.values(REAL_CHAT_FIXTURES).forEach(id => {
    const fixture = getFixtureById(id);
    assert.equal(fixture.meta.sourceMode, 'sanitized_html');
    assert.equal(fixture.meta.helpers.mutable, false);
  });
});

test('synthetic chat fixtures stay mutable seed surfaces', () => {
  Object.values(SYNTHETIC_CHAT_FIXTURES).forEach(id => {
    const fixture = getFixtureById(id);
    assert.equal(fixture.meta.sourceMode, 'seed');
    assert.equal(fixture.meta.helpers.mutable, true);
  });
});
