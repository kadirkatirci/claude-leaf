/* eslint-disable no-console */
// ============================================
// Claude Productivity - Popup JavaScript
// Fully Dynamic Config-Driven UI
// ============================================

let config = null;
let currentSettings = null;
let devConfig = { disabledModules: [] };
const trackEvent = window.PopupAnalytics?.trackEvent || (() => {});
let activeTabId = null;
let lastSavedSettings = null;

// ============================================
// Initialization
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
  console.log('[Popup] Initializing...');

  try {
    // Load config first
    config = await loadConfig();
    devConfig = await loadDevConfig();
    console.log('[Popup] Config loaded');

    // Set version from manifest
    const manifest = chrome.runtime.getManifest();
    document.getElementById('version').textContent = `v${manifest.version}`;

    // Generate UI from config
    renderTabs();
    renderFeatures();
    // renderShortcuts(); // Commented out shortcuts
    renderDataSection();
    renderHelpSection();

    // Load settings and update UI
    await loadSettings();

    // Setup interactions
    setupTabListeners();
    setupTooltips();
    setupActionButtons();

    // Track popup open + initial tab
    activeTabId = getInitialTabId();
    switchToTab(activeTabId, { track: false });
    trackEvent('popup_open', { tab_id: activeTabId });
    trackEvent('popup_tab_view', { tab_id: activeTabId });

    console.log('[Popup] Initialized successfully');
  } catch (error) {
    console.error('[Popup] Initialization failed:', error);
  }
});

// ============================================
// Config Loading
// ============================================
async function loadConfig() {
  const response = await fetch('./config.json');
  if (!response.ok) {
    throw new Error('Failed to load config.json');
  }
  return response.json();
}

async function loadDevConfig() {
  try {
    const response = await fetch('./devConfig.json');
    if (!response.ok) {
      return { disabledModules: [] };
    }
    return response.json();
  } catch {
    return { disabledModules: [] };
  }
}

function isModuleDevDisabled(moduleId) {
  return devConfig.disabledModules.includes(moduleId);
}

// ============================================
// UI Rendering
// ============================================

// --- Tabs ---
function renderTabs() {
  const container = document.getElementById('tabs-nav');
  container.innerHTML = config.tabs
    .filter(tab => tab.id !== 'shortcuts') // Hide shortcuts tab
    .map(
      (tab, index) => `
    <button class="tab ${index === 0 ? 'active' : ''}" data-tab="${tab.id}">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="${tab.icon}"/>
      </svg>
      <span>${tab.label}</span>
    </button>
  `
    )
    .join('');
}

function getInitialTabId() {
  const first = config.tabs.find(tab => tab.id !== 'shortcuts');
  return first ? first.id : 'features';
}

// --- Features Tab ---
function renderFeatures() {
  const container = document.getElementById('feature-list');

  // Filter out dev-disabled modules
  const enabledModules = Object.entries(config.modules).filter(([id]) => !isModuleDevDisabled(id));

  container.innerHTML = enabledModules
    .map(
      ([id, module]) => `
    <div class="feature-item" data-module="${id}">
      <div class="feature-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="${module.iconFill ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="${module.icon}"/>
        </svg>
      </div>
      <div class="feature-info">
        <span class="feature-name">${module.name}</span>
        <button class="info-btn" data-tooltip="${module.tooltip}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="${config.icons.info}"/>
          </svg>
        </button>
      </div>
      <div class="feature-actions">
        <label class="toggle">
          <input type="checkbox" id="${id}-enabled">
          <span class="toggle-slider"></span>
        </label>
      </div>
    </div>
  `
    )
    .join('');

  // Setup feature toggle listeners (NO AUTO-SAVE) - only for enabled modules
  enabledModules.forEach(([id]) => {
    const toggle = document.getElementById(`${id}-enabled`);
    if (toggle) {
      toggle.addEventListener('change', e => {
        if (!currentSettings[id]) {
          currentSettings[id] = {};
        }
        currentSettings[id].enabled = e.target.checked;
        console.log(`[Popup] Toggle changed: ${id}.enabled =`, e.target.checked);
      });
    }
  });

  // Setup settings button listeners
  document.querySelectorAll('.settings-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const moduleId = btn.dataset.module;
      switchToTab('settings');
      openAccordion(moduleId);
    });
  });
}

// --- Shortcuts Tab ---
function renderShortcuts() {
  const container = document.getElementById('shortcuts-list');

  // Filter out shortcuts for dev-disabled modules
  const enabledShortcuts = config.shortcuts.filter(
    group => !group.module || !isModuleDevDisabled(group.module)
  );

  container.innerHTML = enabledShortcuts
    .map(
      group => `
    <div class="shortcut-group">
      <h3 class="shortcut-group-title">${group.group}</h3>
      ${group.items
        .map(
          item => `
        <div class="shortcut-item">
          <span class="shortcut-keys">
            ${item.keys.map(key => `<kbd>${key}</kbd>`).join(' + ')}
          </span>
          <span class="shortcut-desc">${item.description}</span>
        </div>
      `
        )
        .join('')}
    </div>
  `
    )
    .join('');
}

// --- Data Tab ---
function renderDataSection() {
  const container = document.getElementById('data-section');
  const { export: exportOpts, clear: clearOpts } = config.dataOptions;

  container.innerHTML = `
    <!-- Export Section -->
    <div class="data-group">
      <h3 class="data-group-title">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="${config.icons.export}"/>
        </svg>
        Export
      </h3>
      <div class="checkbox-group">
        ${exportOpts
          .map(
            opt => `
          <label class="checkbox-item">
            <input type="checkbox" id="${opt.id}" checked>
            <span>${opt.label}</span>
          </label>
        `
          )
          .join('')}
      </div>
      <button class="btn btn-primary" id="export-btn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="${config.icons.export}"/>
        </svg>
        Export Selected
      </button>
    </div>
    
    <!-- Import Section -->
    <div class="data-group">
      <h3 class="data-group-title">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="${config.icons.import}"/>
        </svg>
        Import
      </h3>
      <button class="btn btn-secondary" id="import-btn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="${config.icons.import}"/>
        </svg>
        Import from File
      </button>
    </div>
    
    <!-- Clear Section -->
    <div class="data-group data-group-danger">
      <h3 class="data-group-title">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="${config.icons.trash}"/>
        </svg>
        Clear Data
      </h3>
      <div class="checkbox-group">
        ${clearOpts
          .map(
            opt => `
          <label class="checkbox-item">
            <input type="checkbox" id="${opt.id}">
            <span>${opt.label}</span>
          </label>
        `
          )
          .join('')}
      </div>
      <button class="btn btn-danger" id="clear-btn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="${config.icons.trash}"/>
        </svg>
        Clear Selected
      </button>
    </div>
  `;
}

// --- Help Tab ---
function renderHelpSection() {
  const container = document.getElementById('help-section');

  const helpItems = [
    {
      url: 'https://github.com/anthropics/claude-code/issues',
      icon: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20 M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z',
      title: 'Documentation',
      description: 'Learn how to use Claude Productivity features and keyboard shortcuts.',
      linkText: 'Read the Docs',
    },
    {
      url: 'https://github.com/anthropics/claude-code/issues/new?labels=bug',
      icon: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 14v-4m0-4h.01',
      title: 'Report an Issue',
      description: 'Found a bug or something not working as expected? Let us know.',
      linkText: 'Report Issue',
    },
    {
      url: 'https://github.com/anthropics/claude-code/issues/new?labels=enhancement',
      icon: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
      title: 'Request a Feature',
      description: 'Have a great idea? Suggest new features or improvements.',
      linkText: 'Request Feature',
    },
    {
      url: 'https://buymeacoffee.com/tedaitesnim',
      icon: 'M18 8h1a4 4 0 0 1 0 8h-1M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z M6 1v3 M9 1v3 M12 1v3',
      title: 'Buy Me a Coffee',
      description: 'Support the development of Claude Productivity with a coffee ☕',
      linkText: 'Support via Buy Me a Coffee',
    },
  ];

  container.innerHTML = `
    <div class="help-container">
      ${helpItems
        .map(
          (item, index) => `
        <div class="help-item${index === helpItems.length - 1 ? ' help-item-featured' : ''}" data-url="${item.url}" data-index="${index}">
          <div class="help-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="${item.icon}"/>
            </svg>
          </div>
          <div class="help-content">
            <h3>${item.title}</h3>
            <p>${item.description}</p>
            <a href="javascript:void(0)" class="help-link" onclick="event.stopPropagation()">
              ${item.linkText}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                <polyline points="15 3 21 3 21 9"/>
                <line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
            </a>
          </div>
        </div>
      `
        )
        .join('')}
    </div>
  `;

  // Add click handlers to make entire card clickable
  document.querySelectorAll('.help-item').forEach(item => {
    item.addEventListener('click', () => {
      const url = item.getAttribute('data-url');
      if (url) {
        const index = item.getAttribute('data-index') || 'unknown';
        trackEvent('popup_help_click', {
          module: 'popup',
          link_id: index,
        });
        chrome.tabs.create({ url });
      }
    });
    item.style.cursor = 'pointer';
  });
}

// Reserved for future advanced settings UI
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

// Reserved for future advanced settings UI
function _setupFieldListeners(fields, moduleId) {
  fields.forEach(field => {
    const el = document.getElementById(field.id);
    if (!el) {
      return;
    }

    const setValue = value => {
      if (field.global) {
        setSettingValue(field.key, value);
      } else {
        setSettingValue(field.key, value, moduleId);
      }
      console.log(
        `[Popup] Setting changed: ${field.key} =`,
        value,
        `(Module: ${moduleId || 'global'})`
      );
    };

    switch (field.type) {
      case 'toggle':
        el.addEventListener('change', e => setValue(e.target.checked));
        break;
      case 'select':
        el.addEventListener('change', e => setValue(e.target.value));
        break;
      case 'number':
        el.addEventListener('input', e => setValue(parseInt(e.target.value)));
        break;
      case 'range':
        el.addEventListener('input', e => {
          const value = parseFloat(e.target.value);
          setValue(value);
          const display = document.getElementById(field.displayId);
          if (display) {
            display.textContent = value.toFixed(1);
          }
        });
        break;
    }
  });

  // Emoji favorites special handling
  const addEmojiBtn = document.getElementById('emojiMarkers-add-favorite-btn');
  if (addEmojiBtn) {
    addEmojiBtn.addEventListener('click', showEmojiPicker);
  }
}

// ============================================
// Tab Navigation
// ============================================
function setupTabListeners() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => switchToTab(tab.dataset.tab));
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

  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  tabEl.classList.add('active');

  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  contentEl.classList.add('active');

  // Show/hide save button only on features tab
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

// ============================================
// Tooltips
// ============================================
function setupTooltips() {
  const tooltip = document.getElementById('tooltip');

  document.querySelectorAll('.info-btn').forEach(btn => {
    btn.addEventListener('mouseenter', () => {
      const text = btn.dataset.tooltip;
      if (!text) {
        return;
      }

      tooltip.textContent = text;
      tooltip.classList.remove('hidden');

      const rect = btn.getBoundingClientRect();
      let left = rect.left + rect.width / 2 - tooltip.offsetWidth / 2;
      const top = rect.bottom + 8;

      if (left < 8) {
        left = 8;
      }
      if (left + tooltip.offsetWidth > window.innerWidth - 8) {
        left = window.innerWidth - tooltip.offsetWidth - 8;
      }

      tooltip.style.left = `${left}px`;
      tooltip.style.top = `${top}px`;
    });

    btn.addEventListener('mouseleave', () => tooltip.classList.add('hidden'));
  });
}

// ============================================
// Settings Management
// ============================================
function getDefaultSettings() {
  return JSON.parse(JSON.stringify(config.defaultSettings));
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
    // No settings in storage - this is first time
    isFirstTime = true;
  }

  currentSettings = deepMerge(getDefaultSettings(), savedSettings);
  lastSavedSettings = JSON.parse(JSON.stringify(currentSettings));
  console.log('[Popup] Settings loaded:', currentSettings);
  updateUI();

  // Auto-save defaults on first load
  if (isFirstTime) {
    console.log('[Popup] First time - saving defaults to storage');
    await chrome.storage.sync.set({ settings: currentSettings });
    console.log('[Popup] Default settings saved');
  }
}

function deepMerge(target, source) {
  const result = { ...target };
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

function getSettingValue(key, moduleId = null) {
  const parts = key.split('.');
  let value = moduleId ? currentSettings[moduleId] : currentSettings;
  for (const part of parts) {
    if (value === undefined || value === null) {
      return undefined;
    }
    value = value[part];
  }
  return value;
}

function setSettingValue(key, value, moduleId = null) {
  const parts = key.split('.');
  let target = moduleId
    ? currentSettings[moduleId] || (currentSettings[moduleId] = {})
    : currentSettings;

  for (let i = 0; i < parts.length - 1; i++) {
    if (!target[parts[i]]) {
      target[parts[i]] = {};
    }
    target = target[parts[i]];
  }
  target[parts[parts.length - 1]] = value;
}

function updateUI() {
  // Update main toggles
  Object.keys(config.modules).forEach(id => {
    const toggle = document.getElementById(`${id}-enabled`);
    if (toggle) {
      toggle.checked = currentSettings[id]?.enabled ?? false;
    }
  });

  // Update all setting fields
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
        ? getSettingValue(field.key)
        : getSettingValue(field.key, moduleId);

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
        case 'range':
          el.value = value;
          const display = document.getElementById(field.displayId);
          if (display) {
            display.textContent = value.toFixed?.(1) ?? value;
          }
          break;
      }
    });
  });

  // Update emoji favorites
  renderFavoriteEmojis();
}

async function saveSettings() {
  console.log('[Popup] 💾 Saving settings to chrome.storage.sync...');
  console.log('[Popup] 📦 Settings to save:', JSON.stringify(currentSettings, null, 2));

  try {
    // Save directly matching the Store structure (flat object matching defaults)
    // Store.js will add __meta automatically on next load/save if missing
    await chrome.storage.sync.set({ settings: currentSettings });
    console.log('[Popup] ✅ Settings saved successfully');

    // Verify what was saved
    const saved = await chrome.storage.sync.get(null);
    console.log('[Popup] 🔍 Verification - storage contents:', saved);

    showToast('Settings saved!', 'success');
    const enabledCount = Object.values(currentSettings || {}).filter(
      v => v && typeof v === 'object' && v.enabled === true
    ).length;
    trackEvent('popup_settings_save', {
      module: 'popup',
      result: 'success',
      count: enabledCount,
    });

    // Track only real (persisted) module changes
    if (lastSavedSettings) {
      Object.keys(config.modules)
        .filter(id => !isModuleDevDisabled(id))
        .forEach(id => {
          const prevEnabled = lastSavedSettings?.[id]?.enabled ?? false;
          const nextEnabled = currentSettings?.[id]?.enabled ?? false;
          if (prevEnabled !== nextEnabled) {
            trackEvent('popup_module_toggle', {
              module: id,
              state: nextEnabled ? 'enabled' : 'disabled',
              method: 'save',
            });
          }
        });
    }

    // Update last saved snapshot after successful persistence
    lastSavedSettings = JSON.parse(JSON.stringify(currentSettings));

    // Notify content script
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      const tab = tabs[0];
      if (tab && tab.id && tab.url && tab.url.includes('claude.ai')) {
        chrome.tabs
          .sendMessage(tab.id, {
            type: 'SETTINGS_UPDATED',
            settings: currentSettings,
          })
          .catch(() => {});
      }
    });
  } catch (error) {
    console.error('[Popup] ❌ Failed to save settings:', error);
    showToast('Failed to save settings', 'error');
    trackEvent('popup_settings_save', {
      module: 'popup',
      result: 'error',
    });
  }
}

async function resetSettings() {
  if (confirm('Reset all settings to defaults? This cannot be undone.')) {
    currentSettings = getDefaultSettings();
    updateUI();
    await saveSettings();
    showToast('Settings reset!', 'success');
    trackEvent('popup_settings_reset', {
      module: 'popup',
      result: 'success',
    });
  }
}

// ============================================
// Action Buttons
// ============================================
function setupActionButtons() {
  document.getElementById('save-btn')?.addEventListener('click', async () => {
    console.log('[Popup] 💾 Save button clicked');
    await saveSettings();
  });
  document.getElementById('export-btn')?.addEventListener('click', handleExport);
  document.getElementById('import-btn')?.addEventListener('click', handleImport);
  document.getElementById('clear-btn')?.addEventListener('click', handleClear);
}

// ============================================
// Emoji Favorites
// ============================================
function renderFavoriteEmojis() {
  const container = document.getElementById('emojiMarkers-favorites-container');
  if (!container) {
    return;
  }

  const emojis = currentSettings.emojiMarkers?.favoriteEmojis || [];
  container.innerHTML = '';

  emojis.forEach((emoji, index) => {
    const chip = document.createElement('div');
    chip.className = 'emoji-chip';
    chip.draggable = true;
    chip.dataset.index = index;
    chip.innerHTML = `<span>${emoji}</span><button title="Remove">×</button>`;

    chip.querySelector('button').addEventListener('click', e => {
      e.stopPropagation();
      currentSettings.emojiMarkers.favoriteEmojis.splice(index, 1);
      renderFavoriteEmojis();
      trackEvent('popup_emoji_favorite_remove', {
        module: 'popup',
        count: currentSettings.emojiMarkers.favoriteEmojis.length,
      });
    });

    // Drag & drop
    chip.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text/plain', index);
      chip.style.opacity = '0.5';
    });
    chip.addEventListener('dragend', () => (chip.style.opacity = '1'));
    chip.addEventListener('dragover', e => e.preventDefault());
    chip.addEventListener('drop', e => {
      e.preventDefault();
      const from = parseInt(e.dataTransfer.getData('text/plain'));
      const to = parseInt(chip.dataset.index);
      if (from !== to) {
        const arr = currentSettings.emojiMarkers.favoriteEmojis;
        const [item] = arr.splice(from, 1);
        arr.splice(to, 0, item);
        renderFavoriteEmojis();
      }
    });

    container.appendChild(chip);
  });
}

function showEmojiPicker() {
  trackEvent('popup_emoji_picker_open', { module: 'popup' });
  const modal = document.createElement('div');
  modal.className = 'emoji-modal';
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.4); display: flex;
    align-items: center; justify-content: center; z-index: 10000;
  `;

  const picker = document.createElement('div');
  picker.style.cssText = `
    background: white; border-radius: 12px; padding: 16px;
    max-width: 320px; max-height: 400px; overflow-y: auto;
    box-shadow: 0 8px 32px rgba(0,0,0,0.2);
  `;
  picker.innerHTML =
    '<h3 style="margin:0 0 12px;font-size:14px;font-weight:600;">Select Emoji</h3>';

  Object.entries(config.emojiCategories).forEach(([name, emojis]) => {
    const section = document.createElement('div');
    section.innerHTML = `<div style="font-size:11px;color:#86868b;margin:12px 0 8px;font-weight:500;">${name}</div>`;

    const grid = document.createElement('div');
    grid.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;';

    emojis.forEach(emoji => {
      const btn = document.createElement('button');
      btn.textContent = emoji;
      btn.style.cssText = `
        width:36px;height:36px;font-size:18px;border:1px solid #e5e7eb;
        border-radius:8px;background:#f9fafb;cursor:pointer;transition:all 0.15s;
      `;
      btn.addEventListener('mouseenter', () => {
        btn.style.background = '#e5e7eb';
        btn.style.transform = 'scale(1.1)';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.background = '#f9fafb';
        btn.style.transform = 'scale(1)';
      });
      btn.addEventListener('click', () => {
        if (!currentSettings.emojiMarkers) {
          currentSettings.emojiMarkers = {};
        }
        if (!currentSettings.emojiMarkers.favoriteEmojis) {
          currentSettings.emojiMarkers.favoriteEmojis = [];
        }

        if (currentSettings.emojiMarkers.favoriteEmojis.includes(emoji)) {
          showToast('Already in favorites', 'warning');
          trackEvent('popup_emoji_favorite_add', {
            module: 'popup',
            result: 'duplicate',
            count: currentSettings.emojiMarkers.favoriteEmojis.length,
          });
        } else {
          currentSettings.emojiMarkers.favoriteEmojis.push(emoji);
          renderFavoriteEmojis();
          showToast(`${emoji} added`, 'success');
          trackEvent('popup_emoji_favorite_add', {
            module: 'popup',
            result: 'success',
            count: currentSettings.emojiMarkers.favoriteEmojis.length,
          });
        }
        modal.remove();
      });
      grid.appendChild(btn);
    });

    section.appendChild(grid);
    picker.appendChild(section);
  });

  modal.appendChild(picker);
  modal.addEventListener('click', e => {
    if (e.target === modal) {
      modal.remove();
    }
  });
  document.body.appendChild(modal);
}

// ============================================
// Data Management (using DataService)
// ============================================

/**
 * Map config export options to DataService store IDs
 */
function getStoreIdFromConfig(configKey) {
  const keyMap = {
    editHistory: 'editHistory',
    bookmarks: 'bookmarks',
    emojiMarkers: 'markers',
    settings: 'settings',
  };
  return keyMap[configKey] || null;
}

async function handleExport() {
  // Collect selected store IDs
  const selectedStores = [];

  for (const opt of config.dataOptions.export) {
    if (!document.getElementById(opt.id)?.checked) {
      continue;
    }

    const storeId = getStoreIdFromConfig(opt.key);
    if (storeId) {
      selectedStores.push(storeId);
    }
  }

  if (selectedStores.length === 0) {
    showToast('Nothing selected', 'warning');
    trackEvent('popup_data_export', {
      module: 'popup',
      result: 'none_selected',
    });
    return;
  }

  try {
    // Use DataService for export
    const exportData = await window.DataService.exportData(selectedStores, currentSettings);

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `claude-productivity-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    showToast('Exported successfully!', 'success');
    console.log('[Popup] Exported stores:', selectedStores);
    trackEvent('popup_data_export', {
      module: 'popup',
      result: 'success',
      count: selectedStores.length,
      data_type: selectedStores.join(','),
    });
  } catch (error) {
    console.error('[Popup] Export error:', error);
    showToast('Export failed', 'error');
    trackEvent('popup_data_export', {
      module: 'popup',
      result: 'error',
      count: selectedStores.length,
      data_type: selectedStores.join(','),
    });
  }
}

function handleImport() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';

  input.onchange = async e => {
    const file = e.target.files[0];
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const dataTypes = Object.keys(data || {}).join(',');

      // Use DataService for import
      const result = await window.DataService.importData(data, true);

      // Handle settings separately (needs UI update)
      if (data.settings) {
        currentSettings = deepMerge(getDefaultSettings(), data.settings);
        await saveSettings();
        updateUI();
      }

      // Build result message
      const importedCount = Object.values(result.imported).reduce((sum, val) => {
        return sum + (typeof val === 'number' ? val : 0);
      }, 0);

      if (result.success) {
        showToast(`Imported ${importedCount} items`, 'success');
        console.log('[Popup] Import result:', result);
        trackEvent('popup_data_import', {
          module: 'popup',
          result: 'success',
          count: importedCount,
          data_type: dataTypes,
        });
      } else {
        showToast('Import completed with errors', 'warning');
        console.warn('[Popup] Import errors:', result.errors);
        trackEvent('popup_data_import', {
          module: 'popup',
          result: 'partial',
          count: importedCount,
          data_type: dataTypes,
        });
      }

      // Notify content script
      chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, { type: 'DATA_IMPORTED' }).catch(() => {});
        }
      });
    } catch (err) {
      console.error('[Popup] Import error:', err);
      showToast('Invalid file', 'error');
      trackEvent('popup_data_import', {
        module: 'popup',
        result: 'error',
      });
    }
  };

  input.click();
}

async function handleClear() {
  // Collect selected stores to clear
  const selectedStores = [];

  // Map storageKey to storeId
  const storeMap = {
    editHistory: 'editHistory',
    bookmarks: 'bookmarks',
    markers: 'markers',
  };

  for (const opt of config.dataOptions.clear) {
    if (document.getElementById(opt.id)?.checked) {
      const mappedId = storeMap[opt.storageKey];
      if (mappedId) {
        selectedStores.push(mappedId);
      }
    }
  }

  if (selectedStores.length === 0) {
    showToast('Nothing selected', 'warning');
    trackEvent('popup_data_clear', {
      module: 'popup',
      result: 'none_selected',
    });
    return;
  }

  if (!confirm('⚠️ Permanently delete selected data?')) {
    trackEvent('popup_data_clear', {
      module: 'popup',
      result: 'cancel',
      count: selectedStores.length,
      data_type: selectedStores.join(','),
    });
    return;
  }

  try {
    // Use DataService to clear stores
    for (const storeId of selectedStores) {
      await window.DataService.clearStore(storeId, false);
    }

    // Uncheck all clear checkboxes
    config.dataOptions.clear.forEach(opt => {
      const cb = document.getElementById(opt.id);
      if (cb) {
        cb.checked = false;
      }
    });

    showToast('Data cleared', 'success');
    console.log('[Popup] Cleared stores:', selectedStores);
    trackEvent('popup_data_clear', {
      module: 'popup',
      result: 'success',
      count: selectedStores.length,
      data_type: selectedStores.join(','),
    });

    // Notify content script
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'DATA_CLEARED' }).catch(() => {});
      }
    });
  } catch (error) {
    console.error('[Popup] Clear error:', error);
    showToast('Failed to clear', 'error');
    trackEvent('popup_data_clear', {
      module: 'popup',
      result: 'error',
      count: selectedStores.length,
      data_type: selectedStores.join(','),
    });
  }
}

// ============================================
// Toast
// ============================================
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  if (!toast) {
    return;
  }
  toast.textContent = message;
  toast.className = `toast ${type}`;
  setTimeout(() => toast.classList.add('hidden'), 3000);
}
