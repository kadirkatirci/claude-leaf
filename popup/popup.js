/* eslint-disable no-console */

import { loadPopupDevConfig } from './devConfig.js';
import { handleClear, handleExport, handleImport, saveSettings } from './popupActions.js';
import { deepMerge, getDefaultSettings, getSettingValue, setSettingValue } from './popupState.js';
import {
  getInitialTabId,
  renderDataSection,
  renderFavoriteEmojis,
  renderFeatures,
  renderHelpSection,
  renderShortcuts,
  syncFloatingVisibilityButton,
  renderTabs,
  setupActionButtons,
  setupTabListeners,
  setupTooltips,
  showEmojiPicker,
  showToast,
} from './popupRenderers.js';

let config = null;
let currentSettings = null;
let devConfig = { disabledModules: [] };
const trackEvent = window.PopupAnalytics?.trackEvent || (() => {});
let activeTabId = null;
let lastSavedSettings = null;

document.addEventListener('DOMContentLoaded', async () => {
  console.log('[Popup] Initializing...');

  try {
    config = await loadConfig();
    devConfig = await loadPopupDevConfig();
    console.log('[Popup] Config loaded');

    const manifest = chrome.runtime.getManifest();
    document.getElementById('version').textContent = `v${manifest.version}`;

    renderUI();
    await loadSettings();

    setupListeners();

    activeTabId = getInitialTabId(config);
    switchToTab(activeTabId, { track: false });
    trackEvent('popup_open', { tab_id: activeTabId });
    trackEvent('popup_tab_view', { tab_id: activeTabId });

    console.log('[Popup] Initialized successfully');
  } catch (error) {
    console.error('[Popup] Initialization failed:', error);
  }
});

async function loadConfig() {
  const response = await fetch('./config.json');
  if (!response.ok) {
    throw new Error('Failed to load config.json');
  }
  return response.json();
}

function renderUI() {
  renderTabs(config);
  renderFeatures({
    config,
    currentSettings: currentSettings || {},
    devConfig,
    onToggle: handleModuleToggle,
    onVisibilityToggle: handleFloatingVisibilityToggle,
    onSettingsClick: moduleId => {
      switchToTab('settings');
      openAccordion(moduleId);
    },
  });
  renderDataSection(config);
  renderHelpSection(trackEvent);
  renderShortcuts(config, devConfig);
}

function setupListeners() {
  setupTabListeners(tabId => switchToTab(tabId));
  setupTooltips();
  setupActionButtons({
    onSave: async () => {
      console.log('[Popup] 💾 Save button clicked');
      await saveCurrentSettings();
    },
    onExport: () =>
      handleExport({
        config,
        currentSettings,
        trackEvent,
        showToast,
      }),
    onImport: () =>
      handleImport({
        getDefaultSettings: () => getDefaultSettings(config),
        deepMerge,
        saveCurrentSettings,
        setCurrentSettings: nextSettings => {
          currentSettings = nextSettings;
          updateUI();
        },
        updateUI,
        trackEvent,
        showToast,
      }),
    onClear: () =>
      handleClear({
        config,
        trackEvent,
        showToast,
      }),
  });
}

function handleModuleToggle(moduleId, enabled) {
  if (!currentSettings[moduleId]) {
    currentSettings[moduleId] = {};
  }
  currentSettings[moduleId].enabled = enabled;
  console.log(`[Popup] Toggle changed: ${moduleId}.enabled =`, enabled);
}

function handleFloatingVisibilityToggle(moduleId, visible) {
  if (!currentSettings[moduleId]) {
    currentSettings[moduleId] = {};
  }
  currentSettings[moduleId].showFloatingUI = visible;
  console.log(`[Popup] Toggle changed: ${moduleId}.showFloatingUI =`, visible);
}

async function loadSettings() {
  const result = await chrome.storage.sync.get(['settings']);
  let savedSettings = {};
  let isFirstTime = false;

  if (result.settings) {
    if (result.settings.data?.settings) {
      savedSettings = result.settings.data.settings;
    } else if (typeof result.settings === 'object' && !result.settings.data) {
      savedSettings = result.settings;
    }
  } else {
    isFirstTime = true;
  }

  currentSettings = deepMerge(getDefaultSettings(config), savedSettings);
  lastSavedSettings = JSON.parse(JSON.stringify(currentSettings));
  console.log('[Popup] Settings loaded:', currentSettings);
  updateUI();

  if (isFirstTime) {
    console.log('[Popup] First time - saving defaults to storage');
    await chrome.storage.sync.set({ settings: currentSettings });
    console.log('[Popup] Default settings saved');
  }
}

async function saveCurrentSettings() {
  const result = await saveSettings({
    config,
    currentSettings,
    lastSavedSettings,
    devConfig,
    trackEvent,
    showToast,
  });

  if (result.ok) {
    lastSavedSettings = result.snapshot;
  }

  return result;
}

function updateUI() {
  Object.keys(config.modules).forEach(id => {
    const toggle = document.getElementById(`${id}-enabled`);
    if (toggle) {
      toggle.checked = currentSettings[id]?.enabled ?? false;
    }

    const visibilityToggle = document.getElementById(`${id}-floating-ui`);
    if (visibilityToggle) {
      syncFloatingVisibilityButton(
        visibilityToggle,
        config,
        currentSettings[id]?.showFloatingUI !== false
      );
    }
  });

  Object.entries(config.settingsSchema).forEach(([moduleId, schema]) => {
    const allFields = schema.fields || [];
    if (schema.subgroups) {
      schema.subgroups.forEach(sub => allFields.push(...sub.fields));
    }

    allFields.forEach(field => {
      const el = document.getElementById(field.id);
      if (!el) {
        return;
      }

      const value = field.global
        ? getSettingValue(currentSettings, field.key)
        : getSettingValue(currentSettings, field.key, moduleId);

      if (value === undefined) {
        return;
      }

      switch (field.type) {
        case 'toggle':
          el.checked = !!value;
          break;
        case 'select':
        case 'number':
          el.value = value;
          break;
        case 'range': {
          el.value = value;
          const display = document.getElementById(field.displayId);
          if (display) {
            display.textContent = value.toFixed?.(1) ?? value;
          }
          break;
        }
      }
    });
  });

  renderEmojiFavorites();
}

function renderEmojiFavorites() {
  renderFavoriteEmojis({
    currentSettings,
    trackEvent,
    onFavoritesChanged: () => renderEmojiFavorites(),
  });
}

function openEmojiPicker() {
  showEmojiPicker({
    config,
    currentSettings,
    trackEvent,
    showToast,
    onFavoritesChanged: () => renderEmojiFavorites(),
  });
}

function switchToTab(tabId, { track = true } = {}) {
  const tabEl = document.querySelector(`.tab[data-tab="${tabId}"]`);
  const contentEl = document.getElementById(`tab-${tabId}`);
  if (!tabEl || !contentEl) {
    return;
  }

  if (track && tabId && tabId !== activeTabId) {
    activeTabId = tabId;
    trackEvent('popup_tab_view', { tab_id: tabId });
  } else if (!activeTabId) {
    activeTabId = tabId;
  }

  document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
  tabEl.classList.add('active');

  document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
  contentEl.classList.add('active');

  const saveBtn = document.getElementById('save-btn');
  if (saveBtn) {
    saveBtn.style.display = tabId === 'features' ? 'inline-flex' : 'none';
  }
}

function openAccordion(moduleId) {
  const item = document.querySelector(`.accordion-item[data-module="${moduleId}"]`);
  if (item) {
    document.querySelectorAll('.accordion-item').forEach(i => i.classList.remove('open'));
    item.classList.add('open');
    setTimeout(() => item.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
  }
}

function _renderFields(fields) {
  return fields
    .map(field => {
      switch (field.type) {
        case 'toggle':
          return `
          <div class="setting-row">
            <label>${field.label}</label>
            <label class="toggle toggle-sm">
              <input type="checkbox" id="${field.id}">
              <span class="toggle-slider"></span>
            </label>
          </div>
        `;
        case 'select':
          return `
          <div class="setting-row">
            <label>${field.label}</label>
            <select id="${field.id}">
              ${field.options.map(opt => `<option value="${opt.value}">${opt.label}</option>`).join('')}
            </select>
          </div>
        `;
        case 'number':
          return `
          <div class="setting-row">
            <label>${field.label}</label>
            <input type="number" id="${field.id}" min="${field.min}" max="${field.max}" step="${field.step}">
          </div>
        `;
        case 'range':
          return `
          <div class="setting-row">
            <label>${field.label}</label>
            <div class="range-wrapper">
              <input type="range" id="${field.id}" min="${field.min}" max="${field.max}" step="${field.step}">
              <span id="${field.displayId}">0.7</span>
            </div>
          </div>
        `;
        case 'emoji-list':
          return `
          <div class="setting-row setting-row-vertical">
            <label>${field.label}</label>
            <div class="emoji-favorites" id="emojiMarkers-favorites-container"></div>
            <button class="btn btn-secondary btn-sm" id="emojiMarkers-add-favorite-btn">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Add Emoji
            </button>
          </div>
        `;
        default:
          return '';
      }
    })
    .join('');
}

function _setupFieldListeners(fields, moduleId) {
  fields.forEach(field => {
    const el = document.getElementById(field.id);
    if (!el) {
      return;
    }

    const setValue = value => {
      if (field.global) {
        setSettingValue(currentSettings, field.key, value);
      } else {
        setSettingValue(currentSettings, field.key, value, moduleId);
      }
      console.log(
        `[Popup] Setting changed: ${field.key} =`,
        value,
        `(Module: ${moduleId || 'global'})`
      );
    };

    switch (field.type) {
      case 'toggle':
        el.addEventListener('change', event => setValue(event.target.checked));
        break;
      case 'select':
        el.addEventListener('change', event => setValue(event.target.value));
        break;
      case 'number':
        el.addEventListener('input', event => setValue(parseInt(event.target.value)));
        break;
      case 'range':
        el.addEventListener('input', event => {
          const value = parseFloat(event.target.value);
          setValue(value);
          const display = document.getElementById(field.displayId);
          if (display) {
            display.textContent = value.toFixed(1);
          }
        });
        break;
    }
  });

  const addEmojiBtn = document.getElementById('emojiMarkers-add-favorite-btn');
  if (addEmojiBtn) {
    addEmojiBtn.addEventListener('click', openEmojiPicker);
  }
}
