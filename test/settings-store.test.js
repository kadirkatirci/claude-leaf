import test from 'node:test';
import assert from 'node:assert/strict';
import { setupDom } from '../test-support/dom.js';

test('settings store backfills showFloatingUI for legacy settings', async () => {
  const cleanup = setupDom();

  try {
    const { SettingsStore } = await import('../src/stores/SettingsStore.js');
    const store = new SettingsStore();

    const merged = store.mergeWithDefaults({
      navigation: { enabled: false },
      bookmarks: { enabled: true },
      emojiMarkers: { enabled: true, showFloatingUI: false },
    });

    assert.equal(merged.navigation.showFloatingUI, true);
    assert.equal(merged.bookmarks.showFloatingUI, true);
    assert.equal(merged.emojiMarkers.showFloatingUI, false);
    assert.equal(merged.editHistory.showFloatingUI, true);
  } finally {
    cleanup();
  }
});
