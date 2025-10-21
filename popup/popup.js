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
    chrome.storage.sync.get(['settings'], (result) => {
      currentSettings = result.settings || getDefaultSettings();
      console.log('Settings yüklendi:', currentSettings);
      
      // UI'ı güncelle
      updateUI();
      resolve();
    });
  });
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
      theme: 'auto',
      opacity: 0.7,
      showNotifications: true,
      colorTheme: 'purple',
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
  
  // Navigation settings
  document.getElementById('nav-position').value = currentSettings.navigation.position;
  document.getElementById('nav-counter').checked = currentSettings.navigation.showCounter;
  document.getElementById('nav-smooth').checked = currentSettings.navigation.smoothScroll;
  document.getElementById('nav-keyboard').checked = currentSettings.navigation.keyboardShortcuts;
  document.getElementById('nav-highlight').value = currentSettings.navigation.highlightDuration;
  document.getElementById('nav-opacity').value = currentSettings.general.opacity;
  document.getElementById('nav-opacity-value').textContent = currentSettings.general.opacity;

  // General settings
  document.getElementById('general-theme').value = currentSettings.general.theme;
  document.getElementById('general-notifications').checked = currentSettings.general.showNotifications;
  
  // General color theme
  const colorTheme = currentSettings.general.colorTheme || 'purple';
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

  // General theme
  document.getElementById('general-theme').addEventListener('change', (e) => {
    currentSettings.general.theme = e.target.value;
  });

  // General notifications
  document.getElementById('general-notifications').addEventListener('change', (e) => {
    currentSettings.general.showNotifications = e.target.checked;
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
}

/**
 * Tab switching
 */
function setupTabs() {
  const tabs = document.querySelectorAll('.tab:not(.disabled)');
  const tabContents = document.querySelectorAll('.tab-content');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.tab;

      // Tüm tab'ları pasif yap
      tabs.forEach(t => t.classList.remove('active'));
      tabContents.forEach(tc => tc.classList.add('hidden'));

      // Seçili tab'ı aktif yap
      tab.classList.add('active');
      document.getElementById(`tab-${tabName}`).classList.remove('hidden');
    });
  });
}

/**
 * Settings'i kaydet
 */
async function saveSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.set({ settings: currentSettings }, () => {
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

  let gradient;
  
  if (theme === 'native') {
    // Claude Native
    gradient = 'linear-gradient(135deg, #CC785C 0%, #8B7355 100%)';
  } else if (theme === 'purple') {
    // Purple
    gradient = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
  } else if (theme === 'custom' && customColor) {
    // Custom - rengi biraz koyulaştır
    const darkenColor = (hex) => {
      const r = parseInt(hex.substr(1, 2), 16);
      const g = parseInt(hex.substr(3, 2), 16);
      const b = parseInt(hex.substr(5, 2), 16);
      const darken = (val) => Math.max(0, val - 30);
      return `#${darken(r).toString(16).padStart(2, '0')}${darken(g).toString(16).padStart(2, '0')}${darken(b).toString(16).padStart(2, '0')}`;
    };
    const darker = darkenColor(customColor);
    gradient = `linear-gradient(135deg, ${customColor} 0%, ${darker} 100%)`;
  }

  preview.style.background = gradient;
}
