// ============================================
// Claude Productivity - Popup JavaScript
// Config-driven minimal UI
// ============================================

let config = null;
let currentSettings = null;

// ============================================
// Initialization
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
  console.log('[Popup] Initializing...');
  
  try {
    // Load config first
    config = await loadConfig();
    console.log('[Popup] Config loaded');
    
    // Load settings
    await loadSettings();
    
    // Setup UI
    setupTabs();
    setupAccordion();
    setupTooltips();
    setupEventListeners();
    
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

// ============================================
// Settings Management
// ============================================
function getDefaultSettings() {
  return config?.defaultSettings || {};
}

async function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['settings'], (result) => {
      let savedSettings = {};
      
      if (result.settings) {
        if (result.settings.data && result.settings.data.settings) {
          savedSettings = result.settings.data.settings;
        } else if (typeof result.settings === 'object' && !result.settings.data) {
          savedSettings = result.settings;
        }
      }
      
      currentSettings = deepMerge(getDefaultSettings(), savedSettings);
      console.log('[Popup] Settings loaded:', currentSettings);
      updateUI();
      resolve();
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

async function saveSettings() {
  return new Promise((resolve) => {
    const storeData = {
      version: 1,
      data: { settings: currentSettings }
    };
    
    chrome.storage.sync.set({ settings: storeData }, () => {
      console.log('[Popup] Settings saved');
      showToast('Settings saved!', 'success');
      
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, {
            type: 'SETTINGS_UPDATED',
            settings: currentSettings
          }).catch(() => {});
        }
      });
      
      resolve();
    });
  });
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
// Settings Value Helpers
// ============================================
function getSettingValue(key, moduleName = null) {
  const parts = key.split('.');
  let value = moduleName ? currentSettings[moduleName] : currentSettings;
  
  for (const part of parts) {
    if (value === undefined || value === null) return undefined;
    value = value[part];
  }
  
  return value;
}

function setSettingValue(key, value, moduleName = null) {
  const parts = key.split('.');
  let target = moduleName ? currentSettings[moduleName] : currentSettings;
  
  // Ensure module exists
  if (moduleName && !currentSettings[moduleName]) {
    currentSettings[moduleName] = {};
    target = currentSettings[moduleName];
  }
  
  // Navigate to the parent of the final key
  for (let i = 0; i < parts.length - 1; i++) {
    if (!target[parts[i]]) {
      target[parts[i]] = {};
    }
    target = target[parts[i]];
  }
  
  // Set the value
  target[parts[parts.length - 1]] = value;
}

// ============================================
// UI Update
// ============================================
function updateUI() {
  // Update main toggles in Features tab
  Object.keys(config.modules).forEach(moduleId => {
    setChecked(`${moduleId}-enabled`, currentSettings[moduleId]?.enabled);
  });
  
  // Update all settings fields
  Object.entries(config.settingsSchema).forEach(([moduleId, schema]) => {
    if (schema.fields) {
      updateFieldsUI(schema.fields, moduleId);
    }
    if (schema.subgroups) {
      schema.subgroups.forEach(subgroup => {
        updateFieldsUI(subgroup.fields, moduleId);
      });
    }
  });
}

function updateFieldsUI(fields, moduleId) {
  fields.forEach(field => {
    const value = getSettingValue(field.key, moduleId);
    
    switch (field.type) {
      case 'toggle':
        setChecked(field.id, value);
        break;
      case 'select':
      case 'number':
        setValue(field.id, value);
        break;
      case 'range':
        setValue(field.id, value);
        if (field.displayId) {
          setText(field.displayId, value?.toFixed?.(1) || value);
        }
        break;
      case 'emoji-list':
        renderFavoriteEmojis();
        break;
    }
  });
}

function setChecked(id, value) {
  const el = document.getElementById(id);
  if (el) el.checked = !!value;
}

function setValue(id, value) {
  const el = document.getElementById(id);
  if (el && value !== undefined) el.value = value;
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el && value !== undefined) el.textContent = value;
}

// ============================================
// Tab Navigation
// ============================================
function setupTabs() {
  const tabs = document.querySelectorAll('.tab');
  const contents = document.querySelectorAll('.tab-content');
  
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.tab;
      
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      contents.forEach(c => c.classList.remove('active'));
      document.getElementById(`tab-${tabName}`)?.classList.add('active');
    });
  });
}

// ============================================
// Accordion
// ============================================
function setupAccordion() {
  document.querySelectorAll('.accordion-header').forEach(header => {
    header.addEventListener('click', () => {
      const item = header.parentElement;
      const isOpen = item.classList.contains('open');
      
      document.querySelectorAll('.accordion-item').forEach(i => i.classList.remove('open'));
      
      if (!isOpen) {
        item.classList.add('open');
      }
    });
  });
}

function openAccordion(moduleName) {
  const item = document.querySelector(`.accordion-item[data-module="${moduleName}"]`);
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
      if (!text) return;
      
      tooltip.textContent = text;
      tooltip.classList.remove('hidden');
      
      const rect = btn.getBoundingClientRect();
      let left = rect.left + rect.width / 2 - tooltip.offsetWidth / 2;
      let top = rect.bottom + 8;
      
      if (left < 8) left = 8;
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
// Event Listeners
// ============================================
function setupEventListeners() {
  // Main module toggles
  Object.keys(config.modules).forEach(moduleId => {
    setupToggle(`${moduleId}-enabled`, (v) => {
      if (!currentSettings[moduleId]) currentSettings[moduleId] = {};
      currentSettings[moduleId].enabled = v;
    });
  });
  
  // Settings button clicks
  document.querySelectorAll('.settings-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const module = btn.dataset.module;
      
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelector('.tab[data-tab="settings"]').classList.add('active');
      
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      document.getElementById('tab-settings').classList.add('active');
      
      openAccordion(module);
    });
  });
  
  // Setup all settings fields from schema
  Object.entries(config.settingsSchema).forEach(([moduleId, schema]) => {
    if (schema.fields) {
      setupFieldListeners(schema.fields, moduleId);
    }
    if (schema.subgroups) {
      schema.subgroups.forEach(subgroup => {
        setupFieldListeners(subgroup.fields, moduleId);
      });
    }
  });
  
  // Emoji favorites
  document.getElementById('emojiMarkers-add-favorite-btn')?.addEventListener('click', showEmojiPicker);
  
  // Action buttons
  document.getElementById('save-btn')?.addEventListener('click', saveSettings);
  document.getElementById('reset-btn')?.addEventListener('click', resetSettings);
  document.getElementById('export-btn')?.addEventListener('click', handleExport);
  document.getElementById('import-btn')?.addEventListener('click', handleImport);
  document.getElementById('clear-btn')?.addEventListener('click', handleClear);
}

function setupFieldListeners(fields, moduleId) {
  fields.forEach(field => {
    switch (field.type) {
      case 'toggle':
        setupToggle(field.id, (v) => setSettingValue(field.key, v, moduleId));
        break;
      case 'select':
        setupSelect(field.id, (v) => setSettingValue(field.key, v, moduleId));
        break;
      case 'number':
        setupNumber(field.id, (v) => setSettingValue(field.key, v, moduleId));
        break;
      case 'range':
        setupRange(field.id, field.displayId, (v) => setSettingValue(field.key, v, moduleId));
        break;
    }
  });
}

function setupToggle(id, callback) {
  const el = document.getElementById(id);
  if (el) el.addEventListener('change', (e) => callback(e.target.checked));
}

function setupSelect(id, callback) {
  const el = document.getElementById(id);
  if (el) el.addEventListener('change', (e) => callback(e.target.value));
}

function setupNumber(id, callback) {
  const el = document.getElementById(id);
  if (el) el.addEventListener('input', (e) => callback(parseInt(e.target.value)));
}

function setupRange(id, displayId, callback) {
  const el = document.getElementById(id);
  const display = document.getElementById(displayId);
  if (el) {
    el.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      callback(value);
      if (display) display.textContent = value.toFixed(1);
    });
  }
}

// ============================================
// Emoji Favorites
// ============================================
function renderFavoriteEmojis() {
  const container = document.getElementById('emojiMarkers-favorites-container');
  if (!container) return;
  
  const emojis = currentSettings.emojiMarkers?.favoriteEmojis || [];
  container.innerHTML = '';
  
  emojis.forEach((emoji, index) => {
    const chip = document.createElement('div');
    chip.className = 'emoji-chip';
    chip.draggable = true;
    chip.dataset.index = index;
    
    const emojiSpan = document.createElement('span');
    emojiSpan.textContent = emoji;
    
    const removeBtn = document.createElement('button');
    removeBtn.innerHTML = '×';
    removeBtn.title = 'Remove';
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeFavoriteEmoji(index);
    });
    
    chip.appendChild(emojiSpan);
    chip.appendChild(removeBtn);
    
    // Drag & drop
    chip.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', index);
      chip.style.opacity = '0.5';
    });
    chip.addEventListener('dragend', () => chip.style.opacity = '1');
    chip.addEventListener('dragover', (e) => e.preventDefault());
    chip.addEventListener('drop', (e) => {
      e.preventDefault();
      const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
      const toIndex = parseInt(chip.dataset.index);
      if (fromIndex !== toIndex) reorderFavoriteEmojis(fromIndex, toIndex);
    });
    
    container.appendChild(chip);
  });
}

function removeFavoriteEmoji(index) {
  currentSettings.emojiMarkers?.favoriteEmojis?.splice(index, 1);
  renderFavoriteEmojis();
}

function reorderFavoriteEmojis(fromIndex, toIndex) {
  const emojis = currentSettings.emojiMarkers?.favoriteEmojis;
  if (!emojis) return;
  const [removed] = emojis.splice(fromIndex, 1);
  emojis.splice(toIndex, 0, removed);
  renderFavoriteEmojis();
}

function addFavoriteEmoji(emoji) {
  if (!currentSettings.emojiMarkers) currentSettings.emojiMarkers = {};
  if (!currentSettings.emojiMarkers.favoriteEmojis) currentSettings.emojiMarkers.favoriteEmojis = [];
  
  if (currentSettings.emojiMarkers.favoriteEmojis.includes(emoji)) {
    showToast('Emoji already in favorites', 'warning');
    return;
  }
  
  currentSettings.emojiMarkers.favoriteEmojis.push(emoji);
  renderFavoriteEmojis();
  showToast(`${emoji} added to favorites`, 'success');
}

function showEmojiPicker() {
  const categories = config.emojiCategories;
  
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
  
  const title = document.createElement('h3');
  title.textContent = 'Select Emoji';
  title.style.cssText = 'margin: 0 0 12px; font-size: 14px; font-weight: 600;';
  picker.appendChild(title);
  
  Object.entries(categories).forEach(([categoryName, emojis]) => {
    const categoryTitle = document.createElement('div');
    categoryTitle.textContent = categoryName;
    categoryTitle.style.cssText = 'font-size: 11px; color: #86868b; margin: 12px 0 8px; font-weight: 500;';
    picker.appendChild(categoryTitle);
    
    const grid = document.createElement('div');
    grid.style.cssText = 'display: flex; flex-wrap: wrap; gap: 4px;';
    
    emojis.forEach(emoji => {
      const btn = document.createElement('button');
      btn.textContent = emoji;
      btn.style.cssText = `
        width: 36px; height: 36px; font-size: 18px;
        border: 1px solid #e5e7eb; border-radius: 8px;
        background: #f9fafb; cursor: pointer; transition: all 0.15s;
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
        addFavoriteEmoji(emoji);
        modal.remove();
      });
      grid.appendChild(btn);
    });
    
    picker.appendChild(grid);
  });
  
  modal.appendChild(picker);
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}

// ============================================
// Data Management
// ============================================
async function handleExport() {
  const exportData = {};
  const options = config.dataExportOptions;
  
  for (const opt of options) {
    const checkbox = document.getElementById(opt.id);
    if (!checkbox?.checked) continue;
    
    if (opt.key === 'settings') {
      exportData.settings = currentSettings;
    } else {
      const result = await chrome.storage.local.get([opt.storageKey]);
      const data = result[opt.storageKey]?.[opt.dataPath];
      if (data) exportData[opt.key] = data;
    }
  }
  
  if (Object.keys(exportData).length === 0) {
    showToast('Nothing selected to export', 'warning');
    return;
  }
  
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `claude-productivity-backup-${Date.now()}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  
  showToast('Data exported successfully!', 'success');
}

async function handleImport() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json';
  
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target.result);
        let importCount = 0;
        
        // Import using config
        for (const opt of config.dataExportOptions) {
          if (!data[opt.key] || opt.key === 'settings') continue;
          
          const existing = await chrome.storage.local.get([opt.storageKey]);
          const existingData = existing[opt.storageKey]?.[opt.dataPath] || [];
          const existingIds = new Set(existingData.map(item => item.id));
          const newItems = data[opt.key].filter(item => !existingIds.has(item.id));
          
          if (newItems.length > 0) {
            const storeData = {
              __meta: { version: 2, updatedAt: new Date().toISOString() },
              [opt.dataPath]: [...existingData, ...newItems]
            };
            await chrome.storage.local.set({ [opt.storageKey]: storeData });
            importCount += newItems.length;
          }
        }
        
        // Import settings
        if (data.settings) {
          currentSettings = deepMerge(getDefaultSettings(), data.settings);
          await saveSettings();
          updateUI();
        }
        
        showToast(`Imported ${importCount} items`, 'success');
        
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]) chrome.tabs.sendMessage(tabs[0].id, { type: 'DATA_IMPORTED' }).catch(() => {});
        });
        
      } catch (error) {
        console.error('[Popup] Import error:', error);
        showToast('Import failed: Invalid file', 'error');
      }
    };
    
    reader.readAsText(file);
  };
  
  input.click();
}

async function handleClear() {
  const toClear = [];
  
  config.dataClearOptions.forEach(opt => {
    if (document.getElementById(opt.id)?.checked) {
      toClear.push(opt.storageKey);
    }
  });
  
  if (toClear.length === 0) {
    showToast('Nothing selected to clear', 'warning');
    return;
  }
  
  if (!confirm(`⚠️ This will permanently delete selected data. Continue?`)) return;
  
  try {
    await chrome.storage.local.remove(toClear);
    
    // Uncheck boxes
    config.dataClearOptions.forEach(opt => {
      const cb = document.getElementById(opt.id);
      if (cb) cb.checked = false;
    });
    
    showToast('Data cleared successfully', 'success');
    
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) chrome.tabs.sendMessage(tabs[0].id, { type: 'DATA_CLEARED' }).catch(() => {});
    });
    
  } catch (error) {
    console.error('[Popup] Clear error:', error);
    showToast('Failed to clear data', 'error');
  }
}

// ============================================
// Toast
// ============================================
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  
  toast.textContent = message;
  toast.className = `toast ${type}`;
  
  setTimeout(() => toast.classList.add('hidden'), 3000);
}
