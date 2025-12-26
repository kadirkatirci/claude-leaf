/**
 * SettingsCache - Synchronous settings access
 *
 * Provides synchronous access to settings after initial load.
 * Eliminates the need for await in every getSetting() call.
 *
 * Features:
 * - Load all settings once at startup
 * - Synchronous access throughout the app
 * - Automatic change propagation via events
 * - Type-safe getters with defaults
 * - Memory-efficient caching
 */

import { debugLog } from '../config/debug.js';

class SettingsCache {
  constructor() {
    this.cache = null;
    this.defaults = this.getDefaults();
    this.loaded = false;
    this.loadPromise = null;
    this.listeners = new Map();
    this.debugMode = false;
  }

  /**
   * Get default settings
   */
  getDefaults() {
    return {
      navigation: {
        enabled: true,
        position: 'center',
        showCounter: true,
        keyboardShortcuts: true,
        highlightDuration: 2000,
        scrollBehavior: 'smooth',
        scrollOffset: 100,
      },
      editHistory: {
        enabled: true,
        showBadges: true,
        highlightEdited: true,
        showPanel: true,
        trackVersions: true,
      },
      compactView: {
        enabled: true,
        minHeight: 200,
        maxHeight: 400,
        previewLines: 3,
        autoCollapse: false,
        animationDuration: 300,
      },
      bookmarks: {
        enabled: true,
        keyboardShortcuts: true,
        showInSidebar: true,
        storageType: 'local',
        exportFormat: 'json',
        showTimestamp: true,
      },
      emojiMarkers: {
        enabled: true,
        favoriteEmojis: ['⚠️', '❓', '💡', '⭐', '📌', '🔥'],
        showPanel: true,
        storageType: 'local',
      },
      sidebarCollapse: {
        enabled: true,
        defaultState: 'expanded',
        rememberState: true,
        animationDuration: 300,
      },
      contentFolding: {
        enabled: true,
        headings: true,
        codeBlocks: true,
        messages: true,
        rememberState: true,
        autoCollapseCode: true,
        codeBlockThreshold: 15,
      },
      general: {
        opacity: 0.7,
        colorTheme: 'purple',
        customColor: '#667eea',
        debugMode: false,
        performanceMode: false,
        cacheTimeout: 30000,
      },
    };
  }

  /**
   * Initialize and load settings from storage
   * @param {Object} settingsStore - Settings store instance
   * @returns {Promise<Object>} Loaded settings
   */
  init(settingsStore) {
    if (this.loadPromise) {
      return this.loadPromise;
    }

    this.loadPromise = this.loadSettings(settingsStore);
    return this.loadPromise;
  }

  /**
   * Load settings from store
   * @param {Object} settingsStore - Settings store instance
   * @returns {Promise<Object>} Loaded settings
   */
  async loadSettings(settingsStore) {
    try {
      // Load from store
      const settings = await settingsStore.getAll();

      // Merge with defaults to ensure all keys exist
      this.cache = this.mergeWithDefaults(settings);
      this.loaded = true;

      // Subscribe to changes
      settingsStore.subscribe(newSettings => {
        this.updateCache(newSettings);
      });

      if (this.debugMode) {
        debugLog('settings', 'Settings loaded:', this.cache);
      }

      return this.cache;
    } catch (error) {
      console.error('[SettingsCache] Failed to load settings:', error);

      // Use defaults on error
      this.cache = { ...this.defaults };
      this.loaded = true;

      return this.cache;
    }
  }

  /**
   * Merge settings with defaults
   * @param {Object} settings - Settings object
   * @returns {Object} Merged settings
   */
  mergeWithDefaults(settings) {
    const merged = JSON.parse(JSON.stringify(this.defaults)); // Deep clone

    // Deep merge function
    const deepMerge = (target, source) => {
      for (const key in source) {
        if (source[key] !== null && source[key] !== undefined) {
          if (typeof source[key] === 'object' && !Array.isArray(source[key])) {
            if (!target[key]) {
              target[key] = {};
            }
            deepMerge(target[key], source[key]);
          } else {
            target[key] = source[key];
          }
        }
      }
      return target;
    };

    return deepMerge(merged, settings);
  }

  /**
   * Update cache with new settings
   * @param {Object} newSettings - New settings
   */
  updateCache(newSettings) {
    const oldCache = this.cache;
    this.cache = this.mergeWithDefaults(newSettings);

    // Notify listeners of changes
    this.notifyListeners(oldCache, this.cache);

    if (this.debugMode) {
      debugLog('settings', 'Cache updated:', this.cache);
    }
  }

  /**
   * Get a setting value synchronously
   * @param {string} path - Dot-notation path (e.g., 'navigation.enabled')
   * @param {*} defaultValue - Default value if not found
   * @returns {*} Setting value
   */
  get(path, defaultValue = null) {
    if (!this.loaded) {
      console.warn(`[SettingsCache] Attempting to get '${path}' before settings loaded`);
      return this.getFromDefaults(path, defaultValue);
    }

    const keys = path.split('.');
    let current = this.cache;

    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        return defaultValue !== null ? defaultValue : this.getFromDefaults(path, null);
      }
    }

    return current;
  }

  /**
   * Get from defaults
   * @param {string} path - Dot-notation path
   * @param {*} defaultValue - Default value
   * @returns {*} Default value
   */
  getFromDefaults(path, defaultValue) {
    const keys = path.split('.');
    let current = this.defaults;

    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        return defaultValue;
      }
    }

    return current;
  }

  /**
   * Get module settings synchronously
   * @param {string} moduleName - Module name
   * @returns {Object} Module settings
   */
  getModule(moduleName) {
    return this.get(moduleName, {});
  }

  /**
   * Get all settings synchronously
   * @returns {Object} All settings
   */
  getAll() {
    if (!this.loaded) {
      console.warn('[SettingsCache] Attempting to get all settings before loaded');
      return { ...this.defaults };
    }

    return { ...this.cache };
  }

  /**
   * Check if settings are loaded
   * @returns {boolean} True if loaded
   */
  isLoaded() {
    return this.loaded;
  }

  /**
   * Wait for settings to be loaded
   * @returns {Promise} Resolves when loaded
   */
  async waitForLoad() {
    if (this.loaded) {
      return;
    }
    if (this.loadPromise) {
      await this.loadPromise;
    }
  }

  /**
   * Register a listener for setting changes
   * @param {string} path - Path to watch (or '*' for all)
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  onChange(path, callback) {
    const listenerId = `${path}_${Date.now()}_${Math.random()}`;

    if (!this.listeners.has(path)) {
      this.listeners.set(path, new Map());
    }

    this.listeners.get(path).set(listenerId, callback);

    // Return unsubscribe function
    return () => {
      const pathListeners = this.listeners.get(path);
      if (pathListeners) {
        pathListeners.delete(listenerId);
        if (pathListeners.size === 0) {
          this.listeners.delete(path);
        }
      }
    };
  }

  /**
   * Notify listeners of changes
   * @param {Object} oldSettings - Old settings
   * @param {Object} newSettings - New settings
   */
  notifyListeners(oldSettings, newSettings) {
    // Notify wildcard listeners
    const wildcardListeners = this.listeners.get('*');
    if (wildcardListeners) {
      for (const callback of wildcardListeners.values()) {
        try {
          callback(newSettings, oldSettings);
        } catch (error) {
          console.error('[SettingsCache] Error in wildcard listener:', error);
        }
      }
    }

    // Check each specific path
    for (const [path, pathListeners] of this.listeners.entries()) {
      if (path === '*') {
        continue;
      }

      const oldValue = this.getValueByPath(oldSettings, path);
      const newValue = this.getValueByPath(newSettings, path);

      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        for (const callback of pathListeners.values()) {
          try {
            callback(newValue, oldValue);
          } catch (error) {
            console.error(`[SettingsCache] Error in listener for ${path}:`, error);
          }
        }
      }
    }
  }

  /**
   * Get value by path from object
   * @param {Object} obj - Object to search
   * @param {string} path - Dot-notation path
   * @returns {*} Value at path
   */
  getValueByPath(obj, path) {
    const keys = path.split('.');
    let current = obj;

    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        return undefined;
      }
    }

    return current;
  }

  /**
   * Get specific setting helpers
   */

  isEnabled(moduleName) {
    return this.get(`${moduleName}.enabled`, false);
  }

  getTheme() {
    return this.get('general.colorTheme', 'purple');
  }

  getCustomColor() {
    return this.get('general.customColor', '#667eea');
  }

  getOpacity() {
    return this.get('general.opacity', 0.7);
  }

  isDebugMode() {
    return this.get('general.debugMode', false);
  }

  getNavigationSettings() {
    return this.getModule('navigation');
  }

  getBookmarkSettings() {
    return this.getModule('bookmarks');
  }

  getMarkerSettings() {
    return this.getModule('emojiMarkers');
  }

  getCompactViewSettings() {
    return this.getModule('compactView');
  }

  getEditHistorySettings() {
    return this.getModule('editHistory');
  }

  getSidebarCollapseSettings() {
    return this.getModule('sidebarCollapse');
  }

  getContentFoldingSettings() {
    return this.getModule('contentFolding');
  }

  /**
   * Clear cache (for testing)
   */
  clear() {
    this.cache = null;
    this.loaded = false;
    this.loadPromise = null;
    this.listeners.clear();

    if (this.debugMode) {
      debugLog('settings', 'Cache cleared');
    }
  }

  /**
   * Set debug mode
   */
  setDebugMode(enabled) {
    this.debugMode = enabled;
  }
}

// Export as singleton
const settingsCache = new SettingsCache();
export default settingsCache;
