// Popup JavaScript - Settings UI Logic

let currentSettings = null;

// Sayfa yüklendiğinde
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Popup yükleniyor...');
  
  // Settings'i yükle
  await loadSettings();
  
  // Event listener'ları kur
  setupEventListeners();
  
  // Tab switching
  setupTabs();
});

/**
 * Settings'i Chrome Storage'dan yükle
 */
async function loadSettings() {
  return new Promise((resolve) => {
    // Use new storage key format
    chrome.storage.sync.get(['settings'], (result) => {
      let savedSettings = {};

      // Check if data exists in new format
      if (result.settings) {
        // New format: extract settings object
        if (result.settings.data && result.settings.data.settings) {
          savedSettings = result.settings.data.settings;
        } else if (typeof result.settings === 'object' && !result.settings.data) {
          // Old format compatibility
          savedSettings = result.settings;
        }
      }

      const defaultSettings = getDefaultSettings();

      // Deep merge: default settings + saved settings
      currentSettings = deepMerge(defaultSettings, savedSettings);

      console.log('Settings yüklendi:', currentSettings);

      // UI'ı güncelle
      updateUI();
      resolve();
    });
  });
}

/**
 * Deep merge iki objeyi birleştirir
 */
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

/**
 * Default settings
 */
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
    toc: {
      enabled: false,
      position: 'right',
      autoCollapse: false,
      showOnHover: false,
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
      position: 'right',
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
      defaultState: 'expanded',
      rememberState: true,
    },
    contentFolding: {
      enabled: true,
      headings: {
        enabled: true,
        levels: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
      },
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
    export: {
      enabled: false,
      defaultFormat: 'markdown',
      includeTimestamps: true,
    },
    search: {
      enabled: false,
      caseSensitive: false,
      regexSupport: false,
    },
    general: {
      opacity: 0.7,
      colorTheme: 'native',
      customColor: '#667eea',
    }
  };
}

/**
 * UI'ı current settings'e göre güncelle
 */
function updateUI() {
  // Navigation settings
  document.getElementById('navigation-enabled').checked = currentSettings.navigation.enabled;
  
  // Edit History settings
  document.getElementById('editHistory-enabled').checked = currentSettings.editHistory.enabled;
  document.getElementById('edit-badges').checked = currentSettings.editHistory.showBadges;
  document.getElementById('edit-highlight').checked = currentSettings.editHistory.highlightEdited;
  
  // Compact View settings
  const compactView = currentSettings.compactView || {};
  document.getElementById('compactView-enabled').checked = compactView.enabled || false;
  document.getElementById('compact-autoCollapse').checked = compactView.autoCollapse !== undefined ? compactView.autoCollapse : true;
  document.getElementById('compact-keyboard').checked = compactView.keyboardShortcuts !== undefined ? compactView.keyboardShortcuts : true;
  document.getElementById('compact-minLines').value = compactView.minLines || 30;
  document.getElementById('compact-previewLines').value = compactView.previewLines || 8;

  // Bookmarks settings
  const bookmarks = currentSettings.bookmarks || {};
  document.getElementById('bookmarks-enabled').checked = bookmarks.enabled !== undefined ? bookmarks.enabled : true;
  document.getElementById('bookmarks-keyboard').checked = bookmarks.keyboardShortcuts !== undefined ? bookmarks.keyboardShortcuts : true;
  document.getElementById('bookmarks-showOnHover').checked = bookmarks.showOnHover !== undefined ? bookmarks.showOnHover : true;

  // Emoji Markers settings
  const emojiMarkers = currentSettings.emojiMarkers || {};
  document.getElementById('emojiMarkers-enabled').checked = emojiMarkers.enabled !== undefined ? emojiMarkers.enabled : true;
  document.getElementById('emojiMarkers-showBadges').checked = emojiMarkers.showBadges !== undefined ? emojiMarkers.showBadges : true;
  document.getElementById('emojiMarkers-showOnHover').checked = emojiMarkers.showOnHover !== undefined ? emojiMarkers.showOnHover : true;

  // Render favorite emojis
  renderFavoriteEmojis();

  // Sidebar Collapse settings
  const sidebarCollapse = currentSettings.sidebarCollapse || {};
  document.getElementById('sidebarCollapse-enabled').checked = sidebarCollapse.enabled !== undefined ? sidebarCollapse.enabled : true;
  document.getElementById('sidebarCollapse-rememberState').checked = sidebarCollapse.rememberState !== undefined ? sidebarCollapse.rememberState : true;

  // Content Folding settings
  const contentFolding = currentSettings.contentFolding || {};
  document.getElementById('contentFolding-enabled').checked = contentFolding.enabled !== undefined ? contentFolding.enabled : true;
  document.getElementById('contentFolding-headings-enabled').checked = contentFolding.headings?.enabled !== undefined ? contentFolding.headings.enabled : true;
  document.getElementById('contentFolding-codeBlocks-enabled').checked = contentFolding.codeBlocks?.enabled !== undefined ? contentFolding.codeBlocks.enabled : true;
  document.getElementById('contentFolding-minLines').value = contentFolding.codeBlocks?.minLines || 15;
  document.getElementById('contentFolding-previewLines').value = contentFolding.codeBlocks?.previewLines || 5;
  document.getElementById('contentFolding-autoCollapse').checked = contentFolding.codeBlocks?.autoCollapse || false;
  document.getElementById('contentFolding-messages-enabled').checked = contentFolding.messages?.enabled !== undefined ? contentFolding.messages.enabled : true;
  document.getElementById('contentFolding-messages-previewLines').value = contentFolding.messages?.previewLines || 3;
  document.getElementById('contentFolding-rememberState').checked = contentFolding.rememberState !== undefined ? contentFolding.rememberState : true;

  // Navigation settings
  document.getElementById('nav-position').value = currentSettings.navigation.position;
  document.getElementById('nav-counter').checked = currentSettings.navigation.showCounter;
  document.getElementById('nav-smooth').checked = currentSettings.navigation.smoothScroll;
  document.getElementById('nav-keyboard').checked = currentSettings.navigation.keyboardShortcuts;
  document.getElementById('nav-highlight').value = currentSettings.navigation.highlightDuration;
  document.getElementById('nav-opacity').value = currentSettings.general.opacity;
  document.getElementById('nav-opacity-value').textContent = currentSettings.general.opacity;
  
  // General color theme
  const colorTheme = currentSettings.general.colorTheme || 'native';
  const customColor = currentSettings.general.customColor || '#667eea';
  document.getElementById('general-color-theme').value = colorTheme;
  document.getElementById('general-custom-color').value = customColor;
  document.getElementById('general-custom-color-hex').value = customColor;
  
  // Custom color container göster/gizle
  document.getElementById('general-custom-color-container').style.display = 
    colorTheme === 'custom' ? 'flex' : 'none';
  
  // Theme preview güncelle
  updateThemePreview(colorTheme, customColor);
}

/**
 * Event listener'ları kur
 */
function setupEventListeners() {
  // Navigation enabled toggle
  document.getElementById('navigation-enabled').addEventListener('change', (e) => {
    currentSettings.navigation.enabled = e.target.checked;
  });

  // Edit History enabled toggle
  document.getElementById('editHistory-enabled').addEventListener('change', (e) => {
    currentSettings.editHistory.enabled = e.target.checked;
  });

  // Edit badges
  document.getElementById('edit-badges').addEventListener('change', (e) => {
    currentSettings.editHistory.showBadges = e.target.checked;
  });

  // Edit highlight
  document.getElementById('edit-highlight').addEventListener('change', (e) => {
    currentSettings.editHistory.highlightEdited = e.target.checked;
  });

  // Compact View enabled toggle
  document.getElementById('compactView-enabled').addEventListener('change', (e) => {
    if (!currentSettings.compactView) currentSettings.compactView = {};
    currentSettings.compactView.enabled = e.target.checked;
  });

  // Compact auto-collapse
  document.getElementById('compact-autoCollapse').addEventListener('change', (e) => {
    if (!currentSettings.compactView) currentSettings.compactView = {};
    currentSettings.compactView.autoCollapse = e.target.checked;
  });

  // Compact keyboard shortcuts
  document.getElementById('compact-keyboard').addEventListener('change', (e) => {
    if (!currentSettings.compactView) currentSettings.compactView = {};
    currentSettings.compactView.keyboardShortcuts = e.target.checked;
  });

  // Compact min lines
  document.getElementById('compact-minLines').addEventListener('input', (e) => {
    if (!currentSettings.compactView) currentSettings.compactView = {};
    currentSettings.compactView.minLines = parseInt(e.target.value);
  });

  // Compact preview lines
  document.getElementById('compact-previewLines').addEventListener('input', (e) => {
    if (!currentSettings.compactView) currentSettings.compactView = {};
    currentSettings.compactView.previewLines = parseInt(e.target.value);
  });

  // Bookmarks enabled toggle
  document.getElementById('bookmarks-enabled').addEventListener('change', (e) => {
    if (!currentSettings.bookmarks) currentSettings.bookmarks = {};
    currentSettings.bookmarks.enabled = e.target.checked;
  });

  // Bookmarks keyboard shortcuts
  document.getElementById('bookmarks-keyboard').addEventListener('change', (e) => {
    if (!currentSettings.bookmarks) currentSettings.bookmarks = {};
    currentSettings.bookmarks.keyboardShortcuts = e.target.checked;
  });

  // Bookmarks show on hover
  document.getElementById('bookmarks-showOnHover').addEventListener('change', (e) => {
    if (!currentSettings.bookmarks) currentSettings.bookmarks = {};
    currentSettings.bookmarks.showOnHover = e.target.checked;
  });

  // Emoji Markers enabled toggle
  document.getElementById('emojiMarkers-enabled').addEventListener('change', (e) => {
    if (!currentSettings.emojiMarkers) currentSettings.emojiMarkers = {};
    currentSettings.emojiMarkers.enabled = e.target.checked;
  });

  // Emoji Markers show badges
  document.getElementById('emojiMarkers-showBadges').addEventListener('change', (e) => {
    if (!currentSettings.emojiMarkers) currentSettings.emojiMarkers = {};
    currentSettings.emojiMarkers.showBadges = e.target.checked;
  });

  // Emoji Markers show on hover
  document.getElementById('emojiMarkers-showOnHover').addEventListener('change', (e) => {
    if (!currentSettings.emojiMarkers) currentSettings.emojiMarkers = {};
    currentSettings.emojiMarkers.showOnHover = e.target.checked;
  });

  // Emoji Markers add favorite button
  document.getElementById('emojiMarkers-add-favorite-btn').addEventListener('click', showEmojiPickerForFavorites);

  // Sidebar Collapse enabled toggle
  document.getElementById('sidebarCollapse-enabled').addEventListener('change', (e) => {
    if (!currentSettings.sidebarCollapse) currentSettings.sidebarCollapse = {};
    currentSettings.sidebarCollapse.enabled = e.target.checked;
  });

  // Sidebar Collapse remember state
  document.getElementById('sidebarCollapse-rememberState').addEventListener('change', (e) => {
    if (!currentSettings.sidebarCollapse) currentSettings.sidebarCollapse = {};
    currentSettings.sidebarCollapse.rememberState = e.target.checked;
  });

  // Content Folding enabled toggle
  document.getElementById('contentFolding-enabled').addEventListener('change', (e) => {
    if (!currentSettings.contentFolding) currentSettings.contentFolding = {};
    currentSettings.contentFolding.enabled = e.target.checked;
  });

  // Content Folding headings enabled
  document.getElementById('contentFolding-headings-enabled').addEventListener('change', (e) => {
    if (!currentSettings.contentFolding) currentSettings.contentFolding = {};
    if (!currentSettings.contentFolding.headings) currentSettings.contentFolding.headings = {};
    currentSettings.contentFolding.headings.enabled = e.target.checked;
  });

  // Content Folding code blocks enabled
  document.getElementById('contentFolding-codeBlocks-enabled').addEventListener('change', (e) => {
    if (!currentSettings.contentFolding) currentSettings.contentFolding = {};
    if (!currentSettings.contentFolding.codeBlocks) currentSettings.contentFolding.codeBlocks = {};
    currentSettings.contentFolding.codeBlocks.enabled = e.target.checked;
  });

  // Content Folding min lines
  document.getElementById('contentFolding-minLines').addEventListener('input', (e) => {
    if (!currentSettings.contentFolding) currentSettings.contentFolding = {};
    if (!currentSettings.contentFolding.codeBlocks) currentSettings.contentFolding.codeBlocks = {};
    currentSettings.contentFolding.codeBlocks.minLines = parseInt(e.target.value);
  });

  // Content Folding preview lines
  document.getElementById('contentFolding-previewLines').addEventListener('input', (e) => {
    if (!currentSettings.contentFolding) currentSettings.contentFolding = {};
    if (!currentSettings.contentFolding.codeBlocks) currentSettings.contentFolding.codeBlocks = {};
    currentSettings.contentFolding.codeBlocks.previewLines = parseInt(e.target.value);
  });

  // Content Folding auto collapse
  document.getElementById('contentFolding-autoCollapse').addEventListener('change', (e) => {
    if (!currentSettings.contentFolding) currentSettings.contentFolding = {};
    if (!currentSettings.contentFolding.codeBlocks) currentSettings.contentFolding.codeBlocks = {};
    currentSettings.contentFolding.codeBlocks.autoCollapse = e.target.checked;
  });

  // Content Folding messages enabled
  document.getElementById('contentFolding-messages-enabled').addEventListener('change', (e) => {
    if (!currentSettings.contentFolding) currentSettings.contentFolding = {};
    if (!currentSettings.contentFolding.messages) currentSettings.contentFolding.messages = {};
    currentSettings.contentFolding.messages.enabled = e.target.checked;
  });

  // Content Folding messages preview lines
  document.getElementById('contentFolding-messages-previewLines').addEventListener('input', (e) => {
    if (!currentSettings.contentFolding) currentSettings.contentFolding = {};
    if (!currentSettings.contentFolding.messages) currentSettings.contentFolding.messages = {};
    currentSettings.contentFolding.messages.previewLines = parseInt(e.target.value);
  });

  // Content Folding remember state
  document.getElementById('contentFolding-rememberState').addEventListener('change', (e) => {
    if (!currentSettings.contentFolding) currentSettings.contentFolding = {};
    currentSettings.contentFolding.rememberState = e.target.checked;
  });

  // Nav position
  document.getElementById('nav-position').addEventListener('change', (e) => {
    currentSettings.navigation.position = e.target.value;
  });

  // Nav counter
  document.getElementById('nav-counter').addEventListener('change', (e) => {
    currentSettings.navigation.showCounter = e.target.checked;
  });

  // Nav smooth scroll
  document.getElementById('nav-smooth').addEventListener('change', (e) => {
    currentSettings.navigation.smoothScroll = e.target.checked;
  });

  // Nav keyboard shortcuts
  document.getElementById('nav-keyboard').addEventListener('change', (e) => {
    currentSettings.navigation.keyboardShortcuts = e.target.checked;
  });

  // Nav highlight duration
  document.getElementById('nav-highlight').addEventListener('input', (e) => {
    currentSettings.navigation.highlightDuration = parseInt(e.target.value);
  });

  // Nav opacity
  document.getElementById('nav-opacity').addEventListener('input', (e) => {
    const value = parseFloat(e.target.value);
    currentSettings.general.opacity = value;
    document.getElementById('nav-opacity-value').textContent = value.toFixed(1);
  });

  // General color theme
  document.getElementById('general-color-theme').addEventListener('change', (e) => {
    const theme = e.target.value;
    currentSettings.general.colorTheme = theme;
    
    // Custom color container göster/gizle
    document.getElementById('general-custom-color-container').style.display = 
      theme === 'custom' ? 'flex' : 'none';
    
    // Preview güncelle
    updateThemePreview(theme, currentSettings.general.customColor);
  });

  // General custom color (color picker)
  document.getElementById('general-custom-color').addEventListener('input', (e) => {
    const color = e.target.value;
    currentSettings.general.customColor = color;
    document.getElementById('general-custom-color-hex').value = color;
    updateThemePreview('custom', color);
  });

  // General custom color (hex input)
  document.getElementById('general-custom-color-hex').addEventListener('input', (e) => {
    const color = e.target.value;
    // Validate hex color
    if (/^#[0-9A-F]{6}$/i.test(color)) {
      currentSettings.general.customColor = color;
      document.getElementById('general-custom-color').value = color;
      updateThemePreview('custom', color);
    }
  });

  // Save button
  document.getElementById('save-btn').addEventListener('click', saveSettings);

  // Reset button
  document.getElementById('reset-btn').addEventListener('click', resetSettings);

  // Bookmarks Export button
  document.getElementById('bookmarks-export-btn').addEventListener('click', exportBookmarks);

  // Bookmarks Import button
  document.getElementById('bookmarks-import-btn').addEventListener('click', importBookmarks);

  // Bookmarks Clear button
  document.getElementById('bookmarks-clear-btn').addEventListener('click', clearAllBookmarks);

  // Emoji Markers Export button
  document.getElementById('emojiMarkers-export-btn').addEventListener('click', exportEmojiMarkers);

  // Emoji Markers Import button
  document.getElementById('emojiMarkers-import-btn').addEventListener('click', importEmojiMarkers);

  // Emoji Markers Clear button
  document.getElementById('emojiMarkers-clear-btn').addEventListener('click', clearAllEmojiMarkers);
}

/**
 * Tab switching
 */
function setupTabs() {
  const tabs = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tab-content');

  console.log('[Tabs] Found tabs:', tabs.length);
  console.log('[Tabs] Found tab contents:', tabContents.length);

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.tab;
      console.log('[Tabs] Clicked tab:', tabName);

      // Tüm tab'ları pasif yap
      tabs.forEach(t => t.classList.remove('active'));
      tabContents.forEach(tc => tc.classList.add('hidden'));

      // Seçili tab'ı aktif yap
      tab.classList.add('active');
      const targetContent = document.getElementById(`tab-${tabName}`);

      if (targetContent) {
        targetContent.classList.remove('hidden');
        console.log('[Tabs] Showing content for:', tabName);
      } else {
        console.error('[Tabs] Content not found for:', tabName);
      }
    });
  });
}

/**
 * Settings'i kaydet
 */
async function saveSettings() {
  return new Promise((resolve) => {
    // Save in new store format
    const storeData = {
      version: 1,
      data: {
        settings: currentSettings
      }
    };

    chrome.storage.sync.set({ settings: storeData }, () => {
      console.log('Settings kaydedildi:', currentSettings);

      // Toast göster
      showToast('Ayarlar kaydedildi! ✅', 'success');

      // Content script'e mesaj gönder (sayfayı yenilemesi için)
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, {
            type: 'SETTINGS_UPDATED',
            settings: currentSettings
          }).catch(() => {
            // Content script henüz yüklenmemiş olabilir
            console.log('Content script\'e mesaj gönderilemedi (sayfa yenilenecek)');
          });
        }
      });

      resolve();
    });
  });
}

/**
 * Settings'i sıfırla
 */
async function resetSettings() {
  if (confirm('Tüm ayarları varsayılana döndürmek istediğinize emin misiniz?')) {
    currentSettings = getDefaultSettings();
    updateUI();
    await saveSettings();
    showToast('Ayarlar sıfırlandı! 🔄', 'success');
  }
}

/**
 * Toast notification göster
 */
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type}`;
  
  setTimeout(() => {
    toast.classList.add('hidden');
  }, 3000);
}

/**
 * Theme preview güncelle
 */
function updateThemePreview(theme, customColor) {
  const preview = document.getElementById('general-theme-preview');
  if (!preview) return;

  let background;

  if (theme === 'native') {
    // Claude Native - uses Claude's turuncu color (solid, no gradient)
    background = 'hsl(var(--accent-main-000))';
  } else if (theme === 'orange') {
    // Orange - basit turuncu (solid, no gradient)
    background = 'hsl(var(--accent-main-000))';
  } else if (theme === 'custom' && customColor) {
    // Custom - solid color (no gradient)
    background = customColor;
  }

  preview.style.background = background;
}

/**
 * Export bookmarks to JSON file
 */
async function exportBookmarks() {
  try {
    // Load bookmarks from Chrome storage (new format)
    const result = await new Promise((resolve) => {
      chrome.storage.local.get(['bookmarks'], resolve);
    });

    let bookmarks = [];
    // Store format: { bookmarks: { __meta: {...}, bookmarks: [...] } }
    if (result.bookmarks && result.bookmarks.bookmarks) {
      bookmarks = result.bookmarks.bookmarks;
    }

    if (bookmarks.length === 0) {
      showToast('Henüz bookmark yok! ⚠️', 'warning');
      return;
    }

    // Create JSON file
    const dataStr = JSON.stringify(bookmarks, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);

    // Download file
    const link = document.createElement('a');
    link.href = url;
    link.download = `claude-bookmarks-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast(`${bookmarks.length} bookmark export edildi! 📤`, 'success');
  } catch (error) {
    console.error('Export error:', error);
    showToast('Export başarısız! ❌', 'error');
  }
}

/**
 * Import bookmarks from JSON file
 */
async function importBookmarks() {
  try {
    // Create file input
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';

    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const imported = JSON.parse(event.target.result);

          if (!Array.isArray(imported)) {
            throw new Error('Invalid bookmark file format');
          }

          // Load existing bookmarks (Store format)
          const result = await new Promise((resolve) => {
            chrome.storage.local.get(['bookmarks'], resolve);
          });

          let existingBookmarks = [];
          // Store format: { bookmarks: { __meta: {...}, bookmarks: [...] } }
          if (result.bookmarks && result.bookmarks.bookmarks) {
            existingBookmarks = result.bookmarks.bookmarks;
          }

          // Merge bookmarks (avoid duplicates)
          const existingIds = new Set(existingBookmarks.map(b => b.id));
          const newBookmarks = imported.filter(b => !existingIds.has(b.id));

          if (newBookmarks.length === 0) {
            showToast('Hiçbir yeni bookmark bulunamadı! ⚠️', 'warning');
            return;
          }

          const mergedBookmarks = [...existingBookmarks, ...newBookmarks];

          // Save to Chrome storage (Store format)
          const storeData = {
            __meta: result.bookmarks?.__meta || {
              version: 2,
              createdAt: new Date().toISOString()
            },
            bookmarks: mergedBookmarks
          };
          storeData.__meta.updatedAt = new Date().toISOString();

          await new Promise((resolve) => {
            chrome.storage.local.set({ bookmarks: storeData }, resolve);
          });

          showToast(`${newBookmarks.length} bookmark import edildi! 📥`, 'success');

          // Notify content script to refresh
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
              chrome.tabs.sendMessage(tabs[0].id, {
                type: 'BOOKMARKS_UPDATED'
              }).catch(() => {
                console.log('Content script not ready');
              });
            }
          });
        } catch (error) {
          console.error('Import error:', error);
          showToast('Import başarısız: Geçersiz dosya! ❌', 'error');
        }
      };

      reader.readAsText(file);
    };

    input.click();
  } catch (error) {
    console.error('Import error:', error);
    showToast('Import başarısız! ❌', 'error');
  }
}

/**
 * Render favorite emojis
 */
function renderFavoriteEmojis() {
  const container = document.getElementById('emojiMarkers-favorites-container');
  if (!container) return;

  const favoriteEmojis = currentSettings.emojiMarkers?.favoriteEmojis || ['⚠️', '❓', '💡', '⭐', '📌', '🔥'];

  container.innerHTML = '';

  favoriteEmojis.forEach((emoji, index) => {
    const chip = document.createElement('div');
    chip.className = 'emoji-chip';
    chip.draggable = true;
    chip.dataset.index = index;
    chip.style.cssText = `
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 6px 10px;
      background: white;
      border: 1px solid #ddd;
      border-radius: 6px;
      cursor: move;
      user-select: none;
    `;

    const emojiSpan = document.createElement('span');
    emojiSpan.textContent = emoji;
    emojiSpan.style.fontSize = '20px';

    const removeBtn = document.createElement('button');
    removeBtn.innerHTML = '×';
    removeBtn.style.cssText = `
      background: none;
      border: none;
      cursor: pointer;
      font-size: 18px;
      color: #999;
      padding: 0;
      margin-left: 4px;
    `;
    removeBtn.title = 'Remove';

    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeFavoriteEmoji(index);
    });

    chip.appendChild(emojiSpan);
    chip.appendChild(removeBtn);

    // Drag & drop events
    chip.addEventListener('dragstart', (e) => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', index);
      chip.style.opacity = '0.5';
    });

    chip.addEventListener('dragend', () => {
      chip.style.opacity = '1';
    });

    chip.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    });

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

/**
 * Remove favorite emoji
 */
function removeFavoriteEmoji(index) {
  if (!currentSettings.emojiMarkers) currentSettings.emojiMarkers = {};
  if (!currentSettings.emojiMarkers.favoriteEmojis) return;

  currentSettings.emojiMarkers.favoriteEmojis.splice(index, 1);
  renderFavoriteEmojis();
}

/**
 * Reorder favorite emojis (drag & drop)
 */
function reorderFavoriteEmojis(fromIndex, toIndex) {
  if (!currentSettings.emojiMarkers) currentSettings.emojiMarkers = {};
  if (!currentSettings.emojiMarkers.favoriteEmojis) return;

  const emojis = currentSettings.emojiMarkers.favoriteEmojis;
  const [removed] = emojis.splice(fromIndex, 1);
  emojis.splice(toIndex, 0, removed);

  renderFavoriteEmojis();
}

/**
 * Show emoji picker for adding favorites
 */
function showEmojiPickerForFavorites() {
  // Simple emoji categories for popup
  const categories = {
    'Symbols': ['⚠️', '❓', '💡', '⭐', '📌', '🔥', '✅', '❌', '⚡', '🎯', '🏆', '💯', '🎉', '🎊', '💥', '✨', '🌟', '💫', '⭕', '🔴', '🟡', '🟢', '🔵', '🟣'],
    'Smileys': ['😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳'],
    'Gestures': ['👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '👇', '☝️', '✋', '🤚', '🖐️', '🖖', '👋', '🤝', '🙏', '💪'],
    'Objects': ['📝', '📋', '📌', '📍', '🗒️', '📄', '📃', '📑', '🔖', '🏷️', '💼', '📂', '📁', '🗂️', '📊', '📈', '📉', '💡', '🔦', '🔍', '🔎'],
    'Hearts': ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝'],
  };

  // Create modal
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  `;

  const picker = document.createElement('div');
  picker.style.cssText = `
    background: white;
    border-radius: 12px;
    padding: 20px;
    max-width: 400px;
    max-height: 500px;
    overflow-y: auto;
  `;

  const title = document.createElement('h3');
  title.textContent = 'Emoji Seç';
  title.style.marginTop = '0';
  picker.appendChild(title);

  Object.entries(categories).forEach(([categoryName, emojis]) => {
    const categoryTitle = document.createElement('h4');
    categoryTitle.textContent = categoryName;
    categoryTitle.style.fontSize = '12px';
    categoryTitle.style.color = '#666';
    categoryTitle.style.marginBottom = '8px';
    picker.appendChild(categoryTitle);

    const emojiGrid = document.createElement('div');
    emojiGrid.style.cssText = `
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-bottom: 16px;
    `;

    emojis.forEach(emoji => {
      const btn = document.createElement('button');
      btn.textContent = emoji;
      btn.style.cssText = `
        width: 36px;
        height: 36px;
        font-size: 20px;
        border: 1px solid #ddd;
        border-radius: 6px;
        background: #f5f5f5;
        cursor: pointer;
        transition: all 0.2s;
      `;

      btn.addEventListener('mouseenter', () => {
        btn.style.background = '#e5e5e5';
        btn.style.transform = 'scale(1.1)';
      });

      btn.addEventListener('mouseleave', () => {
        btn.style.background = '#f5f5f5';
        btn.style.transform = 'scale(1)';
      });

      btn.addEventListener('click', () => {
        addFavoriteEmoji(emoji);
        modal.remove();
      });

      emojiGrid.appendChild(btn);
    });

    picker.appendChild(emojiGrid);
  });

  modal.appendChild(picker);

  // Close on outside click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });

  document.body.appendChild(modal);
}

/**
 * Add favorite emoji
 */
function addFavoriteEmoji(emoji) {
  if (!currentSettings.emojiMarkers) currentSettings.emojiMarkers = {};
  if (!currentSettings.emojiMarkers.favoriteEmojis) {
    currentSettings.emojiMarkers.favoriteEmojis = [];
  }

  // Check if already exists
  if (currentSettings.emojiMarkers.favoriteEmojis.includes(emoji)) {
    showToast('Bu emoji zaten favori listede! ⚠️', 'warning');
    return;
  }

  currentSettings.emojiMarkers.favoriteEmojis.push(emoji);
  renderFavoriteEmojis();
  showToast(`${emoji} favori emojilere eklendi! ✅`, 'success');
}

/**
 * Export emoji markers to JSON file
 */
async function exportEmojiMarkers() {
  try {
    // Read from local storage only
    const result = await new Promise((resolve) => {
      chrome.storage.local.get(['markers'], resolve);
    });

    let markers = [];

    // Store format: { markers: { __meta: {...}, markers: [...] } }
    if (result.markers && result.markers.markers) {
      markers = result.markers.markers;
    }

    if (markers.length === 0) {
      showToast('Henüz emoji marker yok! ⚠️', 'warning');
      return;
    }

    console.log(`[Export] Found ${markers.length} markers in local storage`);

    // Create JSON file
    const dataStr = JSON.stringify(markers, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);

    // Download file
    const link = document.createElement('a');
    link.href = url;
    link.download = `claude-emoji-markers-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast(`${markers.length} emoji marker export edildi! 📤`, 'success');
  } catch (error) {
    console.error('Export error:', error);
    showToast('Export başarısız! ❌', 'error');
  }
}

/**
 * Import emoji markers from JSON file
 */
async function importEmojiMarkers() {
  try {
    // Create file input
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';

    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const imported = JSON.parse(event.target.result);

          if (!Array.isArray(imported)) {
            throw new Error('Invalid marker file format');
          }

          // Load existing markers from local storage (Store format)
          const result = await new Promise((resolve) => {
            chrome.storage.local.get(['markers'], resolve);
          });

          let existingMarkers = [];
          // Store format: { markers: { __meta: {...}, markers: [...] } }
          if (result.markers && result.markers.markers) {
            existingMarkers = result.markers.markers;
          }

          // Merge markers (avoid duplicates)
          const existingIds = new Set(existingMarkers.map(m => m.id));
          const newMarkers = imported.filter(m => !existingIds.has(m.id));

          if (newMarkers.length === 0) {
            showToast('Hiçbir yeni marker bulunamadı! ⚠️', 'warning');
            return;
          }

          const mergedMarkers = [...existingMarkers, ...newMarkers];

          // Save to Chrome storage (Store format)
          const storeData = {
            __meta: result.markers?.__meta || {
              version: 2,
              createdAt: new Date().toISOString()
            },
            markers: mergedMarkers
          };
          storeData.__meta.updatedAt = new Date().toISOString();

          await new Promise((resolve) => {
            chrome.storage.local.set({ markers: storeData }, resolve);
          });

          showToast(`${newMarkers.length} emoji marker import edildi! 📥`, 'success');

          // Notify content script to refresh
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
              chrome.tabs.sendMessage(tabs[0].id, {
                type: 'EMOJI_MARKERS_UPDATED'
              }).catch(() => {
                console.log('Content script not ready');
              });
            }
          });
        } catch (error) {
          console.error('Import error:', error);
          showToast('Import başarısız: Geçersiz dosya! ❌', 'error');
        }
      };

      reader.readAsText(file);
    };

    input.click();
  } catch (error) {
    console.error('Import error:', error);
    showToast('Import başarısız! ❌', 'error');
  }
}

/**
 * Clear all bookmarks
 */
async function clearAllBookmarks() {
  const confirmed = confirm(
    '⚠️ TÜM BOOKMARK\'LAR SİLİNECEK!\n\n' +
    'Bu işlem geri alınamaz. Devam etmek istediğinizden emin misiniz?\n\n' +
    'İpucu: Silmeden önce Export yaparak yedek alabilirsiniz.'
  );

  if (!confirmed) return;

  try {
    // Clear from both local and sync storage (support both storage types)
    await new Promise((resolve) => {
      chrome.storage.local.remove(['bookmarks', 'claude-bookmarks'], resolve);
    });

    await new Promise((resolve) => {
      chrome.storage.sync.remove(['bookmarks', 'claude-bookmarks'], resolve);
    });

    showToast('Tüm bookmark\'lar silindi! 🗑️', 'success');

    // Notify content script to refresh
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: 'BOOKMARKS_UPDATED'
        }).catch(() => {
          console.log('Content script not ready');
        });
      }
    });

    console.log('All bookmarks cleared (including old keys)');
  } catch (error) {
    console.error('Clear bookmarks error:', error);
    showToast('Silme işlemi başarısız! ❌', 'error');
  }
}

/**
 * Clear all emoji markers
 */
async function clearAllEmojiMarkers() {
  const confirmed = confirm(
    '⚠️ TÜM EMOJİ MARKER\'LAR SİLİNECEK!\n\n' +
    'Bu işlem geri alınamaz. Devam etmek istediğinizden emin misiniz?\n\n' +
    'İpucu: Silmeden önce Export yaparak yedek alabilirsiniz.'
  );

  if (!confirmed) return;

  try {
    // Clear from both local and sync storage (support both storage types)
    await new Promise((resolve) => {
      chrome.storage.local.remove(['markers', 'claude-emoji-markers'], resolve);
    });

    await new Promise((resolve) => {
      chrome.storage.sync.remove(['markers', 'claude-emoji-markers'], resolve);
    });

    showToast('Tüm emoji marker\'lar silindi! 🗑️', 'success');

    // Notify content script to refresh
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: 'EMOJI_MARKERS_UPDATED'
        }).catch(() => {
          console.log('Content script not ready');
        });
      }
    });

    console.log('All emoji markers cleared (including old keys)');
  } catch (error) {
    console.error('Clear markers error:', error);
    showToast('Silme işlemi başarısız! ❌', 'error');
  }
}

