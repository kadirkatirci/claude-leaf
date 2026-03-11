import test from 'node:test';
import assert from 'node:assert/strict';
import {
  deepMerge,
  getDefaultSettings,
  getSettingValue,
  setSettingValue,
} from '../popup/popupState.js';
import {
  getInitialTabId,
  renderDataSection,
  renderFeatures,
  renderTabs,
  showToast,
} from '../popup/popupRenderers.js';
import { setupDom } from '../test-support/dom.js';

test('popup state helpers preserve nested merge and path updates', () => {
  const defaults = {
    navigation: { enabled: true, mode: 'all' },
    bookmarks: { enabled: false },
  };

  const merged = deepMerge(defaults, {
    navigation: { mode: 'unread' },
  });

  assert.deepEqual(getDefaultSettings({ defaultSettings: defaults }), defaults);
  assert.equal(merged.navigation.enabled, true);
  assert.equal(merged.navigation.mode, 'unread');

  setSettingValue(merged, 'display.opacity', 0.7);
  assert.equal(getSettingValue(merged, 'display.opacity'), 0.7);
});

test('popup renderers preserve existing tab, feature, data and toast markup contracts', () => {
  const cleanup = setupDom(`
    <div id="tabs-nav"></div>
    <div id="feature-list"></div>
    <div id="data-section"></div>
    <div id="toast" class="toast hidden"></div>
  `);
  const originalSetTimeout = globalThis.setTimeout;

  try {
    globalThis.setTimeout = callback => {
      callback();
      return 0;
    };

    const config = {
      tabs: [
        { id: 'features', label: 'Features', icon: 'M1 1' },
        { id: 'shortcuts', label: 'Shortcuts', icon: 'M1 1' },
        { id: 'data', label: 'Data', icon: 'M1 1' },
      ],
      modules: {
        bookmarks: {
          name: 'Bookmarks',
          tooltip: 'Mark important messages',
          icon: 'M2 2',
        },
      },
      icons: {
        info: 'M3 3',
        export: 'M4 4',
        import: 'M5 5',
        trash: 'M6 6',
      },
      dataOptions: {
        export: [{ id: 'export-bookmarks', label: 'Bookmarks', key: 'bookmarks' }],
        clear: [{ id: 'clear-bookmarks', label: 'Bookmarks', storageKey: 'bookmarks' }],
      },
    };

    let toggled = null;
    renderTabs(config);
    renderFeatures({
      config,
      currentSettings: { bookmarks: { enabled: true } },
      devConfig: { disabledModules: [] },
      onToggle: (moduleId, enabled) => {
        toggled = { moduleId, enabled };
      },
      onSettingsClick: () => {},
    });
    renderDataSection(config);

    assert.equal(getInitialTabId(config), 'features');
    assert.equal(document.querySelectorAll('.tab').length, 2);
    assert.equal(document.querySelector('.feature-item')?.dataset.module, 'bookmarks');

    const toggle = document.getElementById('bookmarks-enabled');
    toggle.checked = false;
    toggle.dispatchEvent(new Event('change', { bubbles: true }));
    assert.deepEqual(toggled, { moduleId: 'bookmarks', enabled: false });

    assert.ok(document.getElementById('export-btn'));
    showToast('Saved!', 'success');
    assert.equal(document.getElementById('toast').className, 'toast success hidden');
  } finally {
    globalThis.setTimeout = originalSetTimeout;
    cleanup();
  }
});
