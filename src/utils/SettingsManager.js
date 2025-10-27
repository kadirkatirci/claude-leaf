/**
 * SettingsManager - Kullanıcı tercihlerini yönetir
 * Chrome Storage API kullanır
 */
import { eventBus, Events } from './EventBus.js';

class SettingsManager {
  constructor() {
    this.settings = null;
    this.defaults = {
      // Navigation settings
      navigation: {
        enabled: true,
        position: 'right', // 'left' | 'right'
        showCounter: true,
        smoothScroll: true,
        highlightDuration: 2000,
        keyboardShortcuts: true,
      },
      
      // Table of Contents (future)
      toc: {
        enabled: false,
        position: 'right', // 'left' | 'right'
        autoCollapse: false,
        showOnHover: false,
      },
      
      // Edit History
      editHistory: {
        enabled: false,
        showBadges: true,
        highlightEdited: true,
      },
      
      // Compact View
      compactView: {
        enabled: false,
        minHeight: 300,
        previewLines: 10,
        fadeHeight: 50,
        autoCollapse: true,
        autoCollapseEnabled: false,
        keyboardShortcuts: true,
      },

      // Bookmarks
      bookmarks: {
        enabled: true,
        keyboardShortcuts: true,
        showOnHover: true,
        storageType: 'local', // 'local' | 'sync'
      },

      // Emoji Markers
      emojiMarkers: {
        enabled: true,
        favoriteEmojis: ['⚠️', '❓', '💡', '⭐', '📌', '🔥'],
        showBadges: true,
        showOnHover: true,
        storageType: 'sync', // 'local' | 'sync'
      },

      // Sidebar Collapse
      sidebarCollapse: {
        enabled: true,
        defaultState: 'expanded', // 'collapsed' | 'expanded'
        rememberState: true,
      },

      // Content Folding
      contentFolding: {
        enabled: true,
        headings: {
          enabled: true,
          levels: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
        },
        codeBlocks: {
          enabled: true,
          minLines: 15,           // Min lines to show collapse button
          previewLines: 5,        // Lines shown when collapsed
          autoCollapse: false,    // Auto-collapse long code blocks
        },
        messages: {
          enabled: true,
          previewLines: 3,        // Lines shown when collapsed
          autoCollapse: false,    // Auto-collapse messages
          autoCollapseThreshold: 5, // Keep last N messages expanded
        },
        rememberState: true,      // Remember fold states
      },

      // Export (future)
      export: {
        enabled: false,
        defaultFormat: 'markdown', // 'markdown' | 'pdf' | 'json'
        includeTimestamps: true,
      },
      
      // Search (future)
      search: {
        enabled: false,
        caseSensitive: false,
        regexSupport: false,
      },
      
      // General
      general: {
        opacity: 0.7,
        colorTheme: 'purple',
        customColor: '#667eea',
      }
    };
  }

  /**
   * Settings'i yükle
   */
  async load() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(['settings'], (result) => {
        this.settings = result.settings || this.defaults;
        // Eksik ayarları defaults ile doldur
        this.settings = this.mergeWithDefaults(this.settings);
        console.log('⚙️ Settings yüklendi:', this.settings);
        resolve(this.settings);
      });
    });
  }

  /**
   * Settings'i kaydet
   */
  async save() {
    return new Promise((resolve) => {
      chrome.storage.sync.set({ settings: this.settings }, () => {
        console.log('💾 Settings kaydedildi');
        eventBus.emit(Events.SETTINGS_CHANGED, this.settings);
        resolve();
      });
    });
  }

  /**
   * Belirli bir ayarı getir
   * @param {string} path - Ayar yolu (örn: 'navigation.enabled')
   */
  get(path) {
    const keys = path.split('.');
    let value = this.settings;
    
    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return undefined;
      }
    }
    
    return value;
  }

  /**
   * Belirli bir ayarı değiştir
   * @param {string} path - Ayar yolu
   * @param {*} value - Yeni değer
   */
  async set(path, value) {
    const keys = path.split('.');
    let current = this.settings;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current)) {
        current[key] = {};
      }
      current = current[key];
    }
    
    const lastKey = keys[keys.length - 1];
    current[lastKey] = value;
    
    await this.save();
  }

  /**
   * Bir özelliği aç/kapat
   * @param {string} feature - Özellik adı (örn: 'navigation')
   */
  async toggleFeature(feature) {
    const currentValue = this.get(`${feature}.enabled`);
    await this.set(`${feature}.enabled`, !currentValue);
    
    eventBus.emit(Events.FEATURE_TOGGLED, {
      feature,
      enabled: !currentValue
    });
  }

  /**
   * Tüm ayarları sıfırla
   */
  async reset() {
    this.settings = JSON.parse(JSON.stringify(this.defaults));
    await this.save();
  }

  /**
   * Tüm ayarları getir
   */
  async getAll() {
    if (!this.settings) {
      await this.load();
    }
    return this.settings;
  }

  /**
   * Settings'i defaults ile birleştir (eksik değerleri ekle)
   */
  mergeWithDefaults(settings) {
    const merged = JSON.parse(JSON.stringify(this.defaults));
    
    const merge = (target, source) => {
      for (const key in source) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          if (!target[key]) target[key] = {};
          merge(target[key], source[key]);
        } else {
          target[key] = source[key];
        }
      }
    };
    
    merge(merged, settings);
    return merged;
  }

  /**
   * Ayarları export et (JSON)
   */
  exportSettings() {
    return JSON.stringify(this.settings, null, 2);
  }

  /**
   * Ayarları import et (JSON)
   */
  async importSettings(jsonString) {
    try {
      const imported = JSON.parse(jsonString);
      this.settings = this.mergeWithDefaults(imported);
      await this.save();
      return true;
    } catch (error) {
      console.error('Settings import hatası:', error);
      return false;
    }
  }
}

// Singleton instance
const settingsManager = new SettingsManager();

export default settingsManager;
