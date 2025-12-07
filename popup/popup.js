// ============================================
// Claude Productivity - Popup JavaScript
// Refactored for new minimal UI
// ============================================

let currentSettings = null;

// ============================================
// Initialization
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
  console.log('[Popup] Initializing...');
  
  // Setup UI interactions first (responsive immediately)
  setupTabs();
  setupAccordion();
  setupTooltips();
  
  // Load settings
  try {
    await loadSettings();
  } catch (error) {
    console.error('[Popup] Failed to load settings:', error);
  }
  
  // Setup event listeners
  setupEventListeners();
  
  console.log('[Popup] Initialized successfully');
});

// ============================================
// Settings Management
// ============================================
function getDefaultSettings() {
  return {
    navigation: {
      enabled: true,
      position: 'right',
      showCounter: true,
      smoothScroll: true,
      highlightDuration: 2000,
      keyboardShortcuts: true,
    },
    editHistory: {
      enabled: false,
      showBadges: true,
      highlightEdited: true,
    },
    compactView: {
      enabled: false,
      autoCollapse: true,
      keyboardShortcuts: true,
      minLines: 30,
      previewLines: 8,
    },
    bookmarks: {
      enabled: true,
      keyboardShortcuts: true,
      showOnHover: true,
    },
    emojiMarkers: {
      enabled: true,
      favoriteEmojis: ['⚠️', '❓', '💡', '⭐', '📌', '🔥'],
      showBadges: true,
      showOnHover: true,
    },
    sidebarCollapse: {
      enabled: true,
      rememberState: true,
    },
    contentFolding: {
      enabled: true,
      headings: { enabled: true },
      codeBlocks: {
        enabled: true,
        minLines: 15,
        previewLines: 5,
        autoCollapse: false,
      },
      messages: {
        enabled: true,
        previewLines: 3,
      },
      rememberState: true,
    },
    general: {
      opacity: 0.7,
    }
  };
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
      
      const defaultSettings = getDefaultSettings();
      currentSettings = deepMerge(defaultSettings, savedSettings);
      
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
      
      // Notify content script
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, {
            type: 'SETTINGS_UPDATED',
            settings: currentSettings
          }).catch(() => {
            console.log('[Popup] Content script not ready');
          });
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
// UI Update
// ============================================
function updateUI() {
  // Features tab - main toggles
  setChecked('navigation-enabled', currentSettings.navigation.enabled);
  setChecked('editHistory-enabled', currentSettings.editHistory.enabled);
  setChecked('compactView-enabled', currentSettings.compactView?.enabled);
  setChecked('bookmarks-enabled', currentSettings.bookmarks?.enabled);
  setChecked('emojiMarkers-enabled', currentSettings.emojiMarkers?.enabled);
  setChecked('sidebarCollapse-enabled', currentSettings.sidebarCollapse?.enabled);
  setChecked('contentFolding-enabled', currentSettings.contentFolding?.enabled);
  
  // Navigation settings
  setValue('nav-position', currentSettings.navigation.position);
  setChecked('nav-counter', currentSettings.navigation.showCounter);
  setChecked('nav-smooth', currentSettings.navigation.smoothScroll);
  setChecked('nav-keyboard', currentSettings.navigation.keyboardShortcuts);
  setValue('nav-highlight', currentSettings.navigation.highlightDuration);
  setValue('nav-opacity', currentSettings.general.opacity);
  setText('nav-opacity-value', currentSettings.general.opacity.toFixed(1));
  
  // Edit History settings
  setChecked('edit-badges', currentSettings.editHistory.showBadges);
  setChecked('edit-highlight', currentSettings.editHistory.highlightEdited);
  
  // Compact View settings
  setChecked('compact-autoCollapse', currentSettings.compactView?.autoCollapse);
  setChecked('compact-keyboard', currentSettings.compactView?.keyboardShortcuts);
  setValue('compact-minLines', currentSettings.compactView?.minLines || 30);
  setValue('compact-previewLines', currentSettings.compactView?.previewLines || 8);
  
  // Bookmarks settings
  setChecked('bookmarks-keyboard', currentSettings.bookmarks?.keyboardShortcuts);
  setChecked('bookmarks-showOnHover', currentSettings.bookmarks?.showOnHover);
  
  // Emoji Markers settings
  setChecked('emojiMarkers-showBadges', currentSettings.emojiMarkers?.showBadges);
  setChecked('emojiMarkers-showOnHover', currentSettings.emojiMarkers?.showOnHover);
  renderFavoriteEmojis();
  
  // Sidebar Collapse settings
  setChecked('sidebarCollapse-rememberState', currentSettings.sidebarCollapse?.rememberState);
  
  // Content Folding settings
  setChecked('contentFolding-headings-enabled', currentSettings.contentFolding?.headings?.enabled);
  setChecked('contentFolding-codeBlocks-enabled', currentSettings.contentFolding?.codeBlocks?.enabled);
  setValue('contentFolding-minLines', currentSettings.contentFolding?.codeBlocks?.minLines || 15);
  setValue('contentFolding-previewLines', currentSettings.contentFolding?.codeBlocks?.previewLines || 5);
  setChecked('contentFolding-autoCollapse', currentSettings.contentFolding?.codeBlocks?.autoCollapse);
  setChecked('contentFolding-messages-enabled', currentSettings.contentFolding?.messages?.enabled);
  setValue('contentFolding-messages-previewLines', currentSettings.contentFolding?.messages?.previewLines || 3);
  setChecked('contentFolding-rememberState', currentSettings.contentFolding?.rememberState);
}

// Helper functions for UI updates
function setChecked(id, value) {
  const el = document.getElementById(id);
  if (el) el.checked = !!value;
}

function setValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value;
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
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
      
      // Update tabs
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      // Update content
      contents.forEach(c => c.classList.remove('active'));
      const targetContent = document.getElementById(`tab-${tabName}`);
      if (targetContent) {
        targetContent.classList.add('active');
      }
    });
  });
}

// ============================================
// Accordion (Settings Tab)
// ============================================
function setupAccordion() {
  const headers = document.querySelectorAll('.accordion-header');
  
  headers.forEach(header => {
    header.addEventListener('click', () => {
      const item = header.parentElement;
      const isOpen = item.classList.contains('open');
      
      // Close all accordions
      document.querySelectorAll('.accordion-item').forEach(i => {
        i.classList.remove('open');
      });
      
      // Toggle current
      if (!isOpen) {
        item.classList.add('open');
      }
    });
  });
}

// Open specific accordion by module name
function openAccordion(moduleName) {
  const item = document.querySelector(`.accordion-item[data-module="${moduleName}"]`);
  if (item) {
    document.querySelectorAll('.accordion-item').forEach(i => i.classList.remove('open'));
    item.classList.add('open');
    setTimeout(() => {
      item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 50);
  }
}

// ============================================
// Tooltips
// ============================================
function setupTooltips() {
  const tooltip = document.getElementById('tooltip');
  const infoButtons = document.querySelectorAll('.info-btn');
  
  infoButtons.forEach(btn => {
    btn.addEventListener('mouseenter', (e) => {
      const text = btn.dataset.tooltip;
      if (!text) return;
      
      tooltip.textContent = text;
      tooltip.classList.remove('hidden');
      
      // Position tooltip
      const rect = btn.getBoundingClientRect();
      const tooltipRect = tooltip.getBoundingClientRect();
      
      let left = rect.left + rect.width / 2 - tooltipRect.width / 2;
      let top = rect.bottom + 8;
      
      // Keep within viewport
      if (left < 8) left = 8;
      if (left + tooltipRect.width > window.innerWidth - 8) {
        left = window.innerWidth - tooltipRect.width - 8;
      }
      
      tooltip.style.left = `${left}px`;
      tooltip.style.top = `${top}px`;
    });
    
    btn.addEventListener('mouseleave', () => {
      tooltip.classList.add('hidden');
    });
  });
}

// ============================================
// Event Listeners Setup
// ============================================
function setupEventListeners() {
  // Features tab - main toggles
  setupToggle('navigation-enabled', (v) => currentSettings.navigation.enabled = v);
  setupToggle('editHistory-enabled', (v) => currentSettings.editHistory.enabled = v);
  setupToggle('compactView-enabled', (v) => {
    if (!currentSettings.compactView) currentSettings.compactView = {};
    currentSettings.compactView.enabled = v;
  });
  setupToggle('bookmarks-enabled', (v) => {
    if (!currentSettings.bookmarks) currentSettings.bookmarks = {};
    currentSettings.bookmarks.enabled = v;
  });
  setupToggle('emojiMarkers-enabled', (v) => {
    if (!currentSettings.emojiMarkers) currentSettings.emojiMarkers = {};
    currentSettings.emojiMarkers.enabled = v;
  });
  setupToggle('sidebarCollapse-enabled', (v) => {
    if (!currentSettings.sidebarCollapse) currentSettings.sidebarCollapse = {};
    currentSettings.sidebarCollapse.enabled = v;
  });
  setupToggle('contentFolding-enabled', (v) => {
    if (!currentSettings.contentFolding) currentSettings.contentFolding = {};
    currentSettings.contentFolding.enabled = v;
  });
  
  // Settings button clicks - navigate to Settings tab and open accordion
  document.querySelectorAll('.settings-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const module = btn.dataset.module;
      
      // Switch to Settings tab
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelector('.tab[data-tab="settings"]').classList.add('active');
      
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      document.getElementById('tab-settings').classList.add('active');
      
      // Open the accordion
      openAccordion(module);
    });
  });
  
  // Navigation settings
  setupSelect('nav-position', (v) => currentSettings.navigation.position = v);
  setupToggle('nav-counter', (v) => currentSettings.navigation.showCounter = v);
  setupToggle('nav-smooth', (v) => currentSettings.navigation.smoothScroll = v);
  setupToggle('nav-keyboard', (v) => currentSettings.navigation.keyboardShortcuts = v);
  setupNumber('nav-highlight', (v) => currentSettings.navigation.highlightDuration = v);
  setupRange('nav-opacity', 'nav-opacity-value', (v) => currentSettings.general.opacity = v);
  
  // Edit History settings
  setupToggle('edit-badges', (v) => currentSettings.editHistory.showBadges = v);
  setupToggle('edit-highlight', (v) => currentSettings.editHistory.highlightEdited = v);
  
  // Compact View settings
  setupToggle('compact-autoCollapse', (v) => {
    if (!currentSettings.compactView) currentSettings.compactView = {};
    currentSettings.compactView.autoCollapse = v;
  });
  setupToggle('compact-keyboard', (v) => {
    if (!currentSettings.compactView) currentSettings.compactView = {};
    currentSettings.compactView.keyboardShortcuts = v;
  });
  setupNumber('compact-minLines', (v) => {
    if (!currentSettings.compactView) currentSettings.compactView = {};
    currentSettings.compactView.minLines = v;
  });
  setupNumber('compact-previewLines', (v) => {
    if (!currentSettings.compactView) currentSettings.compactView = {};
    currentSettings.compactView.previewLines = v;
  });
  
  // Bookmarks settings
  setupToggle('bookmarks-keyboard', (v) => {
    if (!currentSettings.bookmarks) currentSettings.bookmarks = {};
    currentSettings.bookmarks.keyboardShortcuts = v;
  });
  setupToggle('bookmarks-showOnHover', (v) => {
    if (!currentSettings.bookmarks) currentSettings.bookmarks = {};
    currentSettings.bookmarks.showOnHover = v;
  });
  
  // Emoji Markers settings
  setupToggle('emojiMarkers-showBadges', (v) => {
    if (!currentSettings.emojiMarkers) currentSettings.emojiMarkers = {};
    currentSettings.emojiMarkers.showBadges = v;
  });
  setupToggle('emojiMarkers-showOnHover', (v) => {
    if (!currentSettings.emojiMarkers) currentSettings.emojiMarkers = {};
    currentSettings.emojiMarkers.showOnHover = v;
  });
  
  // Sidebar Collapse settings
  setupToggle('sidebarCollapse-rememberState', (v) => {
    if (!currentSettings.sidebarCollapse) currentSettings.sidebarCollapse = {};
    currentSettings.sidebarCollapse.rememberState = v;
  });
  
  // Content Folding settings
  setupToggle('contentFolding-headings-enabled', (v) => {
    if (!currentSettings.contentFolding) currentSettings.contentFolding = {};
    if (!currentSettings.contentFolding.headings) currentSettings.contentFolding.headings = {};
    currentSettings.contentFolding.headings.enabled = v;
  });
  setupToggle('contentFolding-codeBlocks-enabled', (v) => {
    if (!currentSettings.contentFolding) currentSettings.contentFolding = {};
    if (!currentSettings.contentFolding.codeBlocks) currentSettings.contentFolding.codeBlocks = {};
    currentSettings.contentFolding.codeBlocks.enabled = v;
  });
  setupNumber('contentFolding-minLines', (v) => {
    if (!currentSettings.contentFolding) currentSettings.contentFolding = {};
    if (!currentSettings.contentFolding.codeBlocks) currentSettings.contentFolding.codeBlocks = {};
    currentSettings.contentFolding.codeBlocks.minLines = v;
  });
  setupNumber('contentFolding-previewLines', (v) => {
    if (!currentSettings.contentFolding) currentSettings.contentFolding = {};
    if (!currentSettings.contentFolding.codeBlocks) currentSettings.contentFolding.codeBlocks = {};
    currentSettings.contentFolding.codeBlocks.previewLines = v;
  });
  setupToggle('contentFolding-autoCollapse', (v) => {
    if (!currentSettings.contentFolding) currentSettings.contentFolding = {};
    if (!currentSettings.contentFolding.codeBlocks) currentSettings.contentFolding.codeBlocks = {};
    currentSettings.contentFolding.codeBlocks.autoCollapse = v;
  });
  setupToggle('contentFolding-messages-enabled', (v) => {
    if (!currentSettings.contentFolding) currentSettings.contentFolding = {};
    if (!currentSettings.contentFolding.messages) currentSettings.contentFolding.messages = {};
    currentSettings.contentFolding.messages.enabled = v;
  });
  setupNumber('contentFolding-messages-previewLines', (v) => {
    if (!currentSettings.contentFolding) currentSettings.contentFolding = {};
    if (!currentSettings.contentFolding.messages) currentSettings.contentFolding.messages = {};
    currentSettings.contentFolding.messages.previewLines = v;
  });
  setupToggle('contentFolding-rememberState', (v) => {
    if (!currentSettings.contentFolding) currentSettings.contentFolding = {};
    currentSettings.contentFolding.rememberState = v;
  });
  
  // Emoji favorites
  document.getElementById('emojiMarkers-add-favorite-btn')?.addEventListener('click', showEmojiPicker);
  
  // Save button
  document.getElementById('save-btn')?.addEventListener('click', saveSettings);
  
  // Reset button
  document.getElementById('reset-btn')?.addEventListener('click', resetSettings);
  
  // Data tab buttons
  document.getElementById('export-btn')?.addEventListener('click', handleExport);
  document.getElementById('import-btn')?.addEventListener('click', handleImport);
  document.getElementById('clear-btn')?.addEventListener('click', handleClear);
}

// Helper functions for event setup
function setupToggle(id, callback) {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener('change', (e) => callback(e.target.checked));
  }
}

function setupSelect(id, callback) {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener('change', (e) => callback(e.target.value));
  }
}

function setupNumber(id, callback) {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener('input', (e) => callback(parseInt(e.target.value)));
  }
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
    
    chip.addEventListener('dragend', () => {
      chip.style.opacity = '1';
    });
    
    chip.addEventListener('dragover', (e) => e.preventDefault());
    
    chip.addEventListener('drop', (e) => {
      e.preventDefault();
      const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
      const toIndex = parseInt(chip.dataset.index);
      if (fromIndex !== toIndex) {
        reorderFavoriteEmojis(fromIndex, toIndex);
      }
    });
    
    container.appendChild(chip);
  });
}

function removeFavoriteEmoji(index) {
  if (!currentSettings.emojiMarkers?.favoriteEmojis) return;
  currentSettings.emojiMarkers.favoriteEmojis.splice(index, 1);
  renderFavoriteEmojis();
}

function reorderFavoriteEmojis(fromIndex, toIndex) {
  if (!currentSettings.emojiMarkers?.favoriteEmojis) return;
  const emojis = currentSettings.emojiMarkers.favoriteEmojis;
  const [removed] = emojis.splice(fromIndex, 1);
  emojis.splice(toIndex, 0, removed);
  renderFavoriteEmojis();
}

function addFavoriteEmoji(emoji) {
  if (!currentSettings.emojiMarkers) currentSettings.emojiMarkers = {};
  if (!currentSettings.emojiMarkers.favoriteEmojis) {
    currentSettings.emojiMarkers.favoriteEmojis = [];
  }
  
  if (currentSettings.emojiMarkers.favoriteEmojis.includes(emoji)) {
    showToast('Emoji already in favorites', 'warning');
    return;
  }
  
  currentSettings.emojiMarkers.favoriteEmojis.push(emoji);
  renderFavoriteEmojis();
  showToast(`${emoji} added to favorites`, 'success');
}

function showEmojiPicker() {
  const categories = {
    'Common': ['⚠️', '❓', '💡', '⭐', '📌', '🔥', '✅', '❌', '⚡', '🎯', '🏆', '💯'],
    'Status': ['🟢', '🟡', '🔴', '🔵', '⏳', '✓', '✗', '⏸️', '▶️', '🔄'],
    'Priority': ['🔺', '🔻', '➡️', '⬆️', '⬇️', '1️⃣', '2️⃣', '3️⃣'],
    'Category': ['📝', '📋', '📁', '🗂️', '📊', '💼', '🔧', '🎨', '🧪', '📚'],
  };
  
  // Create modal
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  `;
  
  const picker = document.createElement('div');
  picker.style.cssText = `
    background: white;
    border-radius: 12px;
    padding: 16px;
    max-width: 320px;
    max-height: 400px;
    overflow-y: auto;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
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
        width: 36px;
        height: 36px;
        font-size: 18px;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        background: #f9fafb;
        cursor: pointer;
        transition: all 0.15s;
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
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });
  
  document.body.appendChild(modal);
}

// ============================================
// Data Management
// ============================================
async function handleExport() {
  const exportData = {};
  
  // Check which items to export
  if (document.getElementById('export-editHistory')?.checked) {
    const result = await chrome.storage.local.get(['editHistory']);
    if (result.editHistory?.history) {
      exportData.editHistory = result.editHistory.history;
    }
  }
  
  if (document.getElementById('export-bookmarks')?.checked) {
    const result = await chrome.storage.local.get(['bookmarks']);
    if (result.bookmarks?.bookmarks) {
      exportData.bookmarks = result.bookmarks.bookmarks;
    }
  }
  
  if (document.getElementById('export-emojiMarkers')?.checked) {
    const result = await chrome.storage.local.get(['markers']);
    if (result.markers?.markers) {
      exportData.emojiMarkers = result.markers.markers;
    }
  }
  
  if (document.getElementById('export-settings')?.checked) {
    exportData.settings = currentSettings;
  }
  
  if (Object.keys(exportData).length === 0) {
    showToast('Nothing selected to export', 'warning');
    return;
  }
  
  // Download file
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
        
        // Import edit history
        if (data.editHistory) {
          const existing = await chrome.storage.local.get(['editHistory']);
          const existingHistory = existing.editHistory?.history || [];
          const existingIds = new Set(existingHistory.map(h => h.id));
          const newItems = data.editHistory.filter(h => !existingIds.has(h.id));
          
          if (newItems.length > 0) {
            await chrome.storage.local.set({
              editHistory: {
                __meta: { version: 1, updatedAt: new Date().toISOString() },
                history: [...existingHistory, ...newItems]
              }
            });
            importCount += newItems.length;
          }
        }
        
        // Import bookmarks
        if (data.bookmarks) {
          const existing = await chrome.storage.local.get(['bookmarks']);
          const existingBookmarks = existing.bookmarks?.bookmarks || [];
          const existingIds = new Set(existingBookmarks.map(b => b.id));
          const newItems = data.bookmarks.filter(b => !existingIds.has(b.id));
          
          if (newItems.length > 0) {
            await chrome.storage.local.set({
              bookmarks: {
                __meta: { version: 2, updatedAt: new Date().toISOString() },
                bookmarks: [...existingBookmarks, ...newItems]
              }
            });
            importCount += newItems.length;
          }
        }
        
        // Import emoji markers
        if (data.emojiMarkers) {
          const existing = await chrome.storage.local.get(['markers']);
          const existingMarkers = existing.markers?.markers || [];
          const existingIds = new Set(existingMarkers.map(m => m.id));
          const newItems = data.emojiMarkers.filter(m => !existingIds.has(m.id));
          
          if (newItems.length > 0) {
            await chrome.storage.local.set({
              markers: {
                __meta: { version: 2, updatedAt: new Date().toISOString() },
                markers: [...existingMarkers, ...newItems]
              }
            });
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
        
        // Notify content script
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, { type: 'DATA_IMPORTED' }).catch(() => {});
          }
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
  
  if (document.getElementById('clear-editHistory')?.checked) toClear.push('editHistory');
  if (document.getElementById('clear-bookmarks')?.checked) toClear.push('bookmarks');
  if (document.getElementById('clear-emojiMarkers')?.checked) toClear.push('markers');
  
  if (toClear.length === 0) {
    showToast('Nothing selected to clear', 'warning');
    return;
  }
  
  const confirmed = confirm(
    `⚠️ This will permanently delete:\n\n${toClear.join(', ')}\n\nThis cannot be undone. Continue?`
  );
  
  if (!confirmed) return;
  
  try {
    await chrome.storage.local.remove(toClear);
    
    // Uncheck the boxes
    toClear.forEach(key => {
      const checkbox = document.getElementById(`clear-${key === 'markers' ? 'emojiMarkers' : key}`);
      if (checkbox) checkbox.checked = false;
    });
    
    showToast('Data cleared successfully', 'success');
    
    // Notify content script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'DATA_CLEARED' }).catch(() => {});
      }
    });
    
  } catch (error) {
    console.error('[Popup] Clear error:', error);
    showToast('Failed to clear data', 'error');
  }
}

// ============================================
// Toast Notification
// ============================================
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  
  toast.textContent = message;
  toast.className = `toast ${type}`;
  
  setTimeout(() => {
    toast.classList.add('hidden');
  }, 3000);
}
