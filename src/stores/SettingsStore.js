/**
 * SettingsStore - Application settings management
 * Uses chrome.storage.sync for cross-device sync
 */

import { stateManager } from '../core/StateManager.js';

export class SettingsStore {
  constructor() {
    // Default settings structure
    this.defaults = {
      navigation: {
        enabled: true,
        position: 'right',
        showCounter: true,
        smoothScroll: true,
        highlightDuration: 2000,
        keyboardShortcuts: true,
      },
      editHistory: {
        enabled: true,
        showBadges: true,
        highlightEdited: true,
      },
      compactView: {
        enabled: true,
        minHeight: 300,
        previewLines: 10,
        fadeHeight: 50,
        autoCollapse: true,
        autoCollapseEnabled: false,
        keyboardShortcuts: true,
      },
      bookmarks: {
        enabled: true,
        keyboardShortcuts: true,
        showOnHover: true,
        storageType: 'local',
      },
      emojiMarkers: {
        enabled: true,
        favoriteEmojis: ['⚠️', '❓', '💡', '⭐', '📌', '🔥'],
        showBadges: true,
        showOnHover: true,
        storageType: 'sync',
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
      general: {
        opacity: 0.7,
        colorTheme: 'native',
        customColor: '#667eea',
        debugMode: false,
      }
    };

    // Create store with sync adapter (settings should sync across devices)
    this.store = stateManager.createStore('settings', {
      adapter: 'sync',
      version: 1,
      defaultData: this.defaults,
      cacheTTL: 30000 // Cache for 30 seconds (settings don't change frequently)
    });
  }

  /**
   * Load settings (auto-called on first get)
   */
  async load() {
    return this.get();
  }

  /**
   * Get setting value
   * Supports dot notation: 'navigation.enabled' or 'general.colorTheme'
   * @param {string} [path] - Path to setting (optional, returns all if omitted)
   * @returns {Promise<any>}
   */
  async get(path = null) {
    const settings = await this.store.get();
    const merged = this.mergeWithDefaults(settings);

    if (!path) {
      return merged;
    }

    // Support dot notation
    return path.split('.').reduce((obj, key) => obj?.[key], merged);
  }

  /**
   * Get all settings
   */
  async getAll() {
    return this.get();
  }

  /**
   * Set setting value
   * Supports dot notation: set('navigation.enabled', true)
   * Or full update: set({ navigation: {...} })
   * @param {string|Object} pathOrData - Setting path or full settings object
   * @param {*} [value] - Value (if pathOrData is a path)
   */
  async set(pathOrData, value = undefined) {
    if (typeof pathOrData === 'object' && value === undefined) {
      // Full update: set({ navigation: {...} })
      return this.store.set(pathOrData);
    }

    // Partial update with dot notation
    return this.store.update((data) => {
      const keys = pathOrData.split('.');
      const updated = { ...data };
      let current = updated;

      // Navigate to nested object
      for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        if (!current[key]) {
          current[key] = {};
        }
        // Create a new object to maintain immutability
        current[key] = { ...current[key] };
        current = current[key];
      }

      // Set the value
      const lastKey = keys[keys.length - 1];
      current[lastKey] = value;

      return updated;
    });
  }

  /**
   * Toggle a feature on/off
   * @param {string} feature - Feature name (e.g., 'navigation')
   */
  async toggleFeature(feature) {
    const currentValue = await this.get(`${feature}.enabled`);
    await this.set(`${feature}.enabled`, !currentValue);
    return !currentValue;
  }

  /**
   * Reset all settings to defaults
   */
  async reset() {
    return this.store.set(this.defaults);
  }

  /**
   * Reset specific feature to defaults
   * @param {string} feature - Feature name
   */
  async resetFeature(feature) {
    if (!this.defaults[feature]) {
      throw new Error(`Unknown feature: ${feature}`);
    }

    return this.store.update((data) => ({
      ...data,
      [feature]: { ...this.defaults[feature] }
    }));
  }

  /**
   * Subscribe to settings changes
   * @param {Function} callback - Called when settings change
   * @returns {Function} - Unsubscribe function
   */
  subscribe(callback) {
    return this.store.subscribe(callback);
  }

  /**
   * Merge settings with defaults (fills in missing values)
   */
  mergeWithDefaults(settings) {
    const merged = JSON.parse(JSON.stringify(this.defaults));

    const deepMerge = (target, source) => {
      if (!source) return;

      for (const key in source) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          if (!target[key]) {
            target[key] = {};
          }
          deepMerge(target[key], source[key]);
        } else {
          target[key] = source[key];
        }
      }
    };

    deepMerge(merged, settings);
    return merged;
  }

  /**
   * Export settings
   */
  async exportSettings() {
    const exported = await this.store.export();
    return JSON.stringify(exported, null, 2);
  }

  /**
   * Import settings
   * @param {string} jsonString - JSON string of exported settings
   */
  async importSettings(jsonString) {
    try {
      const imported = JSON.parse(jsonString);

      // Validate structure
      if (!imported.data) {
        throw new Error('Invalid settings file format');
      }

      // Merge with defaults to ensure all keys exist
      const merged = this.mergeWithDefaults(imported.data);

      await this.store.set(merged);
      return { success: true };
    } catch (error) {
      console.error('[SettingsStore] Import failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get storage info
   */
  async getStorageInfo() {
    return this.store.getStorageInfo();
  }
}

// Singleton instance
export const settingsStore = new SettingsStore();
