// ============================================
// Claude Productivity - Popup JavaScript
// Fully Dynamic Config-Driven UI
// ============================================

let config = null;
let currentSettings = null;
let devConfig = { disabledModules: [] };

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

    // Set version
    document.getElementById('version').textContent = `v${config.version}`;

    // Generate UI from config
    renderTabs();
    renderFeatures();
    renderShortcuts();
    renderDataSection();
    renderSettingsAccordion();

    // Load settings and update UI
    await loadSettings();

    // Setup interactions
    setupTabListeners();
    setupTooltips();
    setupActionButtons();

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

// --- Settings Tab ---
function renderSettingsAccordion() {
  const container = document.getElementById('settings-accordion');

  // Settings have been simplified - show informational message
  container.innerHTML = `
    <div style="padding: 40px 20px; text-align: center; color: var(--text-secondary);">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin: 0 auto 16px; opacity: 0.5;">
        <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20ZM12 16v-4m0-4h.01"/>
      </svg>
      <h3 style="font-size: 14px; font-weight: 600; margin-bottom: 8px; color: var(--text-primary);">Settings Simplified</h3>
      <p style="font-size: 13px; line-height: 1.5;">Module settings have been simplified.</p>
      <p style="font-size: 13px; line-height: 1.5;">Use the <strong>Features</strong> tab to enable/disable modules.</p>
    </div>
  `;
}

function renderFields(fields, moduleId) {
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

function setupFieldListeners(fields, moduleId) {
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

function switchToTab(tabId) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`.tab[data-tab="${tabId}"]`)?.classList.add('active');

  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.getElementById(`tab-${tabId}`)?.classList.add('active');
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
  return new Promise(resolve => {
    chrome.storage.sync.get(['settings'], result => {
      let savedSettings = {};
      let isFirstTime = false;

      if (result.settings) {
        if (result.settings.data?.settings) {
          savedSettings = result.settings.data.settings;
        } else if (typeof result.settings === 'object' && !result.settings.data) {
          savedSettings = result.settings;
        }
      } else {
        // First time - no settings in storage
        isFirstTime = true;
      }

      currentSettings = deepMerge(getDefaultSettings(), savedSettings);
      console.log('[Popup] Settings loaded:', currentSettings);
      updateUI();

      // Auto-save defaults on first load
      if (isFirstTime) {
        console.log('[Popup] First time - saving defaults to storage');
        const storeData = { version: 1, data: { settings: currentSettings } };
        chrome.storage.sync.set({ settings: storeData }, () => {
          console.log('[Popup] Default settings saved');
          resolve();
        });
      } else {
        resolve();
      }
    });
  });
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

    // Notify content script
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: 'SETTINGS_UPDATED',
          settings: currentSettings,
        });
      }
    });
  } catch (error) {
    console.error('[Popup] ❌ Failed to save settings:', error);
    showToast('Failed to save settings', 'error');
  }
}

async function resetSettings() {
  if (confirm('Reset all settings to defaults? This cannot be undone.')) {
    currentSettings = getDefaultSettings();
    updateUI();
    await saveSettings();
    showToast('Settings reset!', 'success');
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
  document.getElementById('reset-btn')?.addEventListener('click', resetSettings);
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
        } else {
          currentSettings.emojiMarkers.favoriteEmojis.push(emoji);
          renderFavoriteEmojis();
          showToast(`${emoji} added`, 'success');
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
// Data Management
// ============================================
async function handleExport() {
  const exportData = {};

  for (const opt of config.dataOptions.export) {
    if (!document.getElementById(opt.id)?.checked) {
      continue;
    }

    if (opt.key === 'settings') {
      exportData.settings = currentSettings;
    } else {
      const result = await chrome.storage.local.get([opt.storageKey]);
      const data = result[opt.storageKey]?.[opt.dataPath];
      if (data) {
        exportData[opt.key] = data;
      }
    }
  }

  if (Object.keys(exportData).length === 0) {
    showToast('Nothing selected', 'warning');
    return;
  }

  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `claude-productivity-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);

  showToast('Exported successfully!', 'success');
}

async function handleImport() {
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
      let count = 0;

      for (const opt of config.dataOptions.export) {
        if (!data[opt.key] || opt.key === 'settings') {
          continue;
        }

        const existing = await chrome.storage.local.get([opt.storageKey]);
        const existingData = existing[opt.storageKey]?.[opt.dataPath] || [];
        const existingIds = new Set(existingData.map(i => i.id));
        const newItems = data[opt.key].filter(i => !existingIds.has(i.id));

        if (newItems.length > 0) {
          await chrome.storage.local.set({
            [opt.storageKey]: {
              __meta: { version: 2, updatedAt: new Date().toISOString() },
              [opt.dataPath]: [...existingData, ...newItems],
            },
          });
          count += newItems.length;
        }
      }

      if (data.settings) {
        currentSettings = deepMerge(getDefaultSettings(), data.settings);
        await saveSettings();
        updateUI();
      }

      showToast(`Imported ${count} items`, 'success');

      chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, { type: 'DATA_IMPORTED' }).catch(() => {});
        }
      });
    } catch (err) {
      console.error('[Popup] Import error:', err);
      showToast('Invalid file', 'error');
    }
  };

  input.click();
}

async function handleClear() {
  const keys = config.dataOptions.clear
    .filter(opt => document.getElementById(opt.id)?.checked)
    .map(opt => opt.storageKey);

  if (keys.length === 0) {
    showToast('Nothing selected', 'warning');
    return;
  }

  if (!confirm('⚠️ Permanently delete selected data?')) {
    return;
  }

  try {
    await chrome.storage.local.remove(keys);
    config.dataOptions.clear.forEach(opt => {
      const cb = document.getElementById(opt.id);
      if (cb) {
        cb.checked = false;
      }
    });
    showToast('Data cleared', 'success');

    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'DATA_CLEARED' }).catch(() => {});
      }
    });
  } catch (err) {
    showToast('Failed to clear', 'error');
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
