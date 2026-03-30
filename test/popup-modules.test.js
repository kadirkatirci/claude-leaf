import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
  renderHelpSection,
  renderTabs,
  syncFloatingVisibilityButton,
  showToast,
} from '../popup/popupRenderers.js';
import { handleImport, saveSettings } from '../popup/popupActions.js';
import { setupDom } from '../test-support/dom.js';

test('popup css includes floating visibility button theme styles', () => {
  const css = readFileSync(new URL('../popup/popup.css', import.meta.url), 'utf8');

  assert.match(css, /\.visibility-btn\s*\{/);
  assert.match(css, /\.visibility-btn\[data-visible='true'\]\s*\{/);
  assert.match(css, /@media \(prefers-color-scheme: dark\)/);
});

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
          supportsFloatingVisibility: true,
        },
      },
      icons: {
        info: 'M3 3',
        eye: 'M7 7',
        eyeOff: 'M8 8',
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
    let visibilityToggled = null;
    renderTabs(config);
    renderFeatures({
      config,
      currentSettings: { bookmarks: { enabled: true, showFloatingUI: false } },
      devConfig: { disabledModules: [] },
      onToggle: (moduleId, enabled) => {
        toggled = { moduleId, enabled };
      },
      onVisibilityToggle: (moduleId, visible) => {
        visibilityToggled = { moduleId, visible };
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

    const visibilityButton = document.getElementById('bookmarks-floating-ui');
    assert.equal(visibilityButton?.dataset.visible, 'false');
    visibilityButton.dispatchEvent(new Event('click', { bubbles: true }));
    assert.deepEqual(visibilityToggled, { moduleId: 'bookmarks', visible: true });
    assert.equal(visibilityButton?.dataset.visible, 'true');

    assert.ok(document.getElementById('export-btn'));
    showToast('Saved!', 'success');
    assert.equal(document.getElementById('toast').className, 'toast success hidden');
  } finally {
    globalThis.setTimeout = originalSetTimeout;
    cleanup();
  }
});

test('popup floating visibility controls sync button state and save payload', async () => {
  const cleanup = setupDom('<div id="feature-list"></div>');
  const originalChrome = globalThis.chrome;
  const originalDataService = globalThis.window?.DataService;

  try {
    const storedPayloads = [];
    const sentMessages = [];
    const toasts = [];
    const trackedEvents = [];

    globalThis.window.DataService = {
      findClaudeTab() {
        return Promise.resolve({ id: 42 });
      },
    };

    globalThis.chrome = {
      storage: {
        sync: {
          set(payload) {
            storedPayloads.push(payload);
            return Promise.resolve();
          },
          get() {
            return Promise.resolve({});
          },
        },
      },
      tabs: {
        sendMessage(tabId, message) {
          sentMessages.push({ tabId, message });
          return Promise.resolve();
        },
      },
    };

    const currentSettings = {
      bookmarks: {
        enabled: true,
        showFloatingUI: false,
      },
    };

    await saveSettings({
      config: {
        modules: {
          bookmarks: {
            name: 'Bookmarks',
          },
        },
      },
      currentSettings,
      lastSavedSettings: {
        bookmarks: {
          enabled: true,
          showFloatingUI: true,
        },
      },
      devConfig: { disabledModules: [] },
      trackEvent: (name, params) => trackedEvents.push({ name, params }),
      showToast: (message, type) => toasts.push({ message, type }),
    });

    assert.deepEqual(storedPayloads, [{ settings: currentSettings }]);
    assert.deepEqual(sentMessages, [
      {
        tabId: 42,
        message: {
          type: 'SETTINGS_UPDATED',
          settings: currentSettings,
        },
      },
    ]);
    assert.deepEqual(toasts, [{ message: 'Settings saved!', type: 'success' }]);
    assert.equal(trackedEvents[0]?.name, 'popup_settings_save');
  } finally {
    if (originalChrome === undefined) {
      delete globalThis.chrome;
    } else {
      globalThis.chrome = originalChrome;
    }

    if (originalDataService === undefined) {
      delete globalThis.window.DataService;
    } else {
      globalThis.window.DataService = originalDataService;
    }

    cleanup();
  }
});

test('settings export preserves showFloatingUI values', async () => {
  const cleanup = setupDom();
  const originalFetch = globalThis.fetch;

  try {
    globalThis.fetch = () =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            stores: {
              settings: {
                storageType: 'sync',
                version: 1,
                exportable: true,
                label: 'Settings',
              },
            },
          }),
      });

    await import('../popup/dataService.js');

    const exported = await window.DataService.exportData(['settings'], {
      navigation: {
        enabled: true,
        showFloatingUI: false,
      },
      bookmarks: {
        enabled: true,
        showFloatingUI: true,
      },
    });

    assert.equal(exported.settings.navigation.showFloatingUI, false);
    assert.equal(exported.settings.bookmarks.showFloatingUI, true);
  } finally {
    if (originalFetch === undefined) {
      delete globalThis.fetch;
    } else {
      globalThis.fetch = originalFetch;
    }
    cleanup();
  }
});

test('settings import backfills showFloatingUI for legacy backups', async () => {
  const cleanup = setupDom();
  const originalChrome = globalThis.chrome;
  const originalCreateElement = document.createElement.bind(document);
  const originalDataService = globalThis.window?.DataService;

  try {
    let capturedInput = null;
    let nextSettings = null;
    let saveCount = 0;
    let updateCount = 0;
    const toasts = [];

    document.createElement = tagName => {
      const element = originalCreateElement(tagName);
      if (tagName === 'input') {
        capturedInput = element;
      }
      return element;
    };

    globalThis.window.DataService = {
      importData() {
        return Promise.resolve({
          success: true,
          imported: {
            settings: true,
          },
          errors: [],
        });
      },
      findClaudeTab() {
        return Promise.resolve(null);
      },
    };

    globalThis.chrome = {
      tabs: {
        sendMessage() {
          return Promise.resolve();
        },
      },
    };

    handleImport({
      getDefaultSettings: () => ({
        navigation: { enabled: true, showFloatingUI: true },
        bookmarks: { enabled: true, showFloatingUI: true },
      }),
      deepMerge,
      saveCurrentSettings: () => {
        saveCount += 1;
        return Promise.resolve();
      },
      setCurrentSettings: settings => {
        nextSettings = settings;
      },
      updateUI: () => {
        updateCount += 1;
      },
      trackEvent: () => {},
      showToast: (message, type) => {
        toasts.push({ message, type });
      },
    });

    assert.ok(capturedInput);

    await capturedInput.onchange({
      target: {
        files: [
          {
            text: () =>
              Promise.resolve(
                JSON.stringify({
                  __export: {
                    version: 2,
                  },
                  settings: {
                    bookmarks: {
                      enabled: false,
                    },
                  },
                })
              ),
          },
        ],
      },
    });

    assert.deepEqual(nextSettings, {
      navigation: { enabled: true, showFloatingUI: true },
      bookmarks: { enabled: false, showFloatingUI: true },
    });
    assert.equal(saveCount, 1);
    assert.equal(updateCount, 1);
    assert.deepEqual(toasts, [{ message: 'Imported 0 items', type: 'success' }]);
  } finally {
    document.createElement = originalCreateElement;

    if (originalChrome === undefined) {
      delete globalThis.chrome;
    } else {
      globalThis.chrome = originalChrome;
    }

    if (originalDataService === undefined) {
      delete globalThis.window.DataService;
    } else {
      globalThis.window.DataService = originalDataService;
    }

    cleanup();
  }
});

test('popup floating visibility button helper updates aria and icon state', () => {
  const cleanup = setupDom('<button id="floating-ui"></button>');

  try {
    const button = document.getElementById('floating-ui');
    const config = {
      icons: {
        eye: 'M1 1',
        eyeOff: 'M2 2',
      },
    };

    syncFloatingVisibilityButton(button, config, false);
    assert.equal(button.dataset.visible, 'false');
    assert.equal(button.getAttribute('aria-pressed'), 'false');
    assert.match(button.innerHTML, /M2 2/);

    syncFloatingVisibilityButton(button, config, true);
    assert.equal(button.dataset.visible, 'true');
    assert.equal(button.getAttribute('aria-pressed'), 'true');
    assert.match(button.innerHTML, /M1 1/);
  } finally {
    cleanup();
  }
});

test('popup help links include tracking params and stable analytics ids', () => {
  const cleanup = setupDom(`<div id="help-section"></div>`);
  const originalChrome = globalThis.chrome;

  try {
    const createdTabs = [];
    const trackedEvents = [];

    globalThis.chrome = {
      tabs: {
        create({ url }) {
          createdTabs.push(url);
        },
      },
    };

    renderHelpSection((name, params) => {
      trackedEvents.push({ name, params });
    });

    const helpItems = document.querySelectorAll('.help-item');
    assert.equal(helpItems.length, 4);

    helpItems[0].dispatchEvent(new Event('click', { bubbles: true }));
    helpItems[3].dispatchEvent(new Event('click', { bubbles: true }));

    assert.deepEqual(trackedEvents, [
      {
        name: 'popup_help_click',
        params: {
          module: 'popup',
          link_id: 'documentation',
        },
      },
      {
        name: 'popup_help_click',
        params: {
          module: 'popup',
          link_id: 'support',
        },
      },
    ]);

    assert.equal(
      createdTabs[0],
      'https://www.tedaitesnim.com/extensions/claude-extension?utm_source=claude_leaf_extension&utm_medium=extension_popup&utm_campaign=help_links&utm_content=documentation&source=extension-popup-help&link_id=documentation#documentation'
    );
    assert.equal(
      createdTabs[1],
      'https://buymeacoffee.com/tedaitesnim?utm_source=claude_leaf_extension&utm_medium=extension_popup&utm_campaign=help_links&utm_content=support'
    );
  } finally {
    if (originalChrome === undefined) {
      delete globalThis.chrome;
    } else {
      globalThis.chrome = originalChrome;
    }
    cleanup();
  }
});
