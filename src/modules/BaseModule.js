/**
 * BaseModule - Base class for all feature modules
 * Every module extends this class
 */
import { eventBus, Events } from '../utils/EventBus.js';
import { settingsStore } from '../stores/index.js';
import DOMUtils from '../utils/DOMUtils.js';
import { getThemeColors } from '../config/themes.js';
import { debugLog } from '../config/debug.js';
import errorTracker from '../utils/ErrorTracker.js';

class BaseModule {
  /**
   * @param {string} name - Module name (e.g., 'navigation')
   * @param {Object} options - Module options
   */
  constructor(name, options = {}) {
    this.name = name;
    this.options = options;
    this.enabled = false;
    this.initialized = false;
    this.settings = {};
    this.previousSettings = {};
    this.elements = {}; // DOM elements storage
    this.unsubscribers = []; // Event cleanup functions
    this._settingsSubscriptionActive = false;
    this._urlSubscriptionActive = false;
  }

  /**
   * Initialize module - Subclasses should override
   */
  async init() {
    if (this.initialized) {
      debugLog('module', `${this.name} already initialized`);
      return;
    }

    debugLog('module', `${this.name} initializing...`);

    try {
      // CHECK ENABLED FIRST - before ANY initialization
      debugLog('module', `${this.name} loading settings from storage...`);
      await settingsStore.load();

      const allSettings = await settingsStore.get();
      this.previousSettings = this.settings;
      this.settings = allSettings || {};

      const enabled = allSettings?.[this.name]?.enabled;
      debugLog('module', `${this.name} enabled check: ${enabled}`);

      if (enabled !== true) {
        debugLog('module', `${this.name} disabled (enabled=${enabled})`);
        this.enabled = false;
        this.initialized = false;

        // Still subscribe to settings to detect re-enabling
        this.subscribeToSettings();
        return; // Exit immediately - no initialization
      }

      debugLog('module', `${this.name} enabled, proceeding with initialization`);

      // Now safe to initialize
      this.initialized = true;
      this.enabled = true;

      // Listen to settings changes
      this.subscribeToSettings();

      // Listen to centralized SPA navigation events
      this.subscribeToURLChanges();
    } catch (error) {
      console.error(`❌ Failed to initialize ${this.name} module:`, error);
      errorTracker.trackModuleError(this.name, error, 'init');
      this.enabled = false;
      this.initialized = false;
      throw error; // Re-throw for App.js to track
    }
  }

  /**
   * Destroy module - Subclasses should override
   */
  destroy() {
    debugLog('module', `${this.name} destroying...`);

    // Clean up event listeners
    this.unsubscribers.forEach(unsub => unsub());
    this.unsubscribers = [];
    this._settingsSubscriptionActive = false;
    this._urlSubscriptionActive = false;

    // Clean up DOM elements
    Object.values(this.elements).forEach(element => {
      if (element && element.remove) {
        element.remove();
      }
    });
    this.elements = {};

    this.enabled = false;
    this.initialized = false;
  }

  /**
   * Restart module
   */
  async restart() {
    this.destroy();
    await this.init();
  }

  /**
   * Load settings
   */
  async loadSettings() {
    await settingsStore.load();
    // No caching! settingsStore handles caching internally
  }

  /**
   * Get module settings
   */
  async getSettings() {
    return (await settingsStore.get(this.name)) || {};
  }

  /**
   * Get a specific setting
   * @param {string} key - Setting name
   */
  getSetting(key) {
    return settingsStore.get(`${this.name}.${key}`);
  }

  /**
   * Set a specific setting
   * @param {string} key - Setting name
   * @param {*} value - New value
   */
  async setSetting(key, value) {
    await settingsStore.set(`${this.name}.${key}`, value);
  }

  /**
   * Check if module is enabled
   */
  async isEnabled() {
    const enabled = await this.getSetting('enabled');
    return enabled === true;
  }

  /**
   * Toggle module on/off
   */
  async toggle() {
    const currentState = this.isEnabled();
    await this.setSetting('enabled', !currentState);

    if (!currentState) {
      await this.init();
    } else {
      this.destroy();
    }

    return !currentState;
  }

  /**
   * Listen to settings changes
   */
  subscribeToSettings() {
    if (this._settingsSubscriptionActive) {
      return;
    }

    this._settingsSubscriptionActive = true;

    // Subscribe to settingsStore changes
    const storeUnsub = settingsStore.subscribe(async settings => {
      try {
        const previousSettings = this.settings || {};
        this.previousSettings = previousSettings;
        this.settings = settings || {};
        const moduleSettings = this.settings[this.name];

        if (!moduleSettings) {
          return;
        }

        // If module was disabled, destroy it
        if (!moduleSettings.enabled && this.enabled) {
          this.destroy();
          return;
        }

        // If module was enabled and hasn't started yet, initialize it
        if (moduleSettings.enabled && !this.enabled) {
          try {
            await this.init();
          } catch (error) {
            console.error(`❌ Failed to re-enable ${this.name} module:`, error);
          }
          return;
        }

        // Notify module when settings are updated
        if (this.enabled) {
          this.onSettingsChanged(this.settings);
        }
      } catch (error) {
        console.error(`❌ Error in settings subscription for ${this.name}:`, error);
      }
    });

    this.unsubscribers.push(storeUnsub);

    // Also listen to EventBus for backward compatibility (App.js emits this)
    const eventUnsub = eventBus.on('settings:changed', settings => {
      try {
        const moduleSettings = settings?.[this.name];
        if (moduleSettings && this.enabled) {
          this.previousSettings = this.settings || {};
          this.settings = settings;
          this.onSettingsChanged(settings);
        }
      } catch (error) {
        console.error(`❌ Error in EventBus settings handler for ${this.name}:`, error);
      }
    });

    this.unsubscribers.push(eventUnsub);
  }

  /**
   * Called when settings change - Subclasses can override
   * @param {Object} _settings - New settings
   */
  onSettingsChanged(_settings) {
    // Can be overridden
  }

  /**
   * Subscribe to event and store unsubscriber
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   */
  subscribe(event, callback) {
    const unsub = eventBus.on(event, callback);
    this.unsubscribers.push(unsub);
    return unsub;
  }

  /**
   * Emit event
   * @param {string} event - Event name
   * @param {*} data - Event data
   */
  emit(event, data) {
    eventBus.emit(event, data);
  }

  /**
   * Access to DOM Utils
   */
  get dom() {
    return DOMUtils;
  }

  /**
   * Get theme colors
   * @returns {Object} Theme colors
   */
  getTheme() {
    // Get theme from settingsStore synchronously (using cache)
    // This is safe because settingsStore caches the data
    let themeName = 'purple';
    let customColor = '#667eea';

    // Try to get from store cache (synchronous access)
    if (settingsStore.store.cache) {
      const general = settingsStore.store.cache.general || {};
      themeName = general.colorTheme || 'purple';
      customColor = general.customColor || '#667eea';
    }

    return getThemeColors(themeName, customColor);
  }

  /**
   * Log helper
   */
  log(...args) {
    debugLog('module', `[${this.name}]`, ...args);
  }

  /**
   * Warning helper
   */
  warn(...args) {
    console.warn(`[${this.name}]`, ...args);
  }

  /**
   * Error helper
   */
  error(...args) {
    console.error(`[${this.name}]`, ...args);
  }

  /**
   * Subscribe to centralized URL change events from App
   */
  subscribeToURLChanges() {
    if (this._urlSubscriptionActive) {
      return;
    }

    this._urlSubscriptionActive = true;

    const unsub = eventBus.on(Events.URL_CHANGED, newUrl => {
      this.log(`📩 Received URL_CHANGED event: ${newUrl}`);
      this.onUrlChanged(newUrl);
    });

    this.unsubscribers.push(unsub);
  }

  /**
   * Called when URL changes (SPA navigation) - Subclasses can override
   * @param {string} _newUrl - New URL
   */
  onUrlChanged(_newUrl) {
    // Default behavior: reinitialize UI
    this.log('🔄 Reinitializing due to URL change...');
    this.reinitializeUI();
  }

  /**
   * Reinitialize UI without full restart - Subclasses can override
   * This is called automatically on SPA navigation after page stabilizes
   */
  reinitializeUI() {
    // Default behavior - can be overridden by specific modules
    this.log('⚠️ Module should override reinitializeUI() for robust SPA support');
  }

  /**
   * Check if element is visible (has offsetParent or is body/html)
   * Elements in stale DOM trees will have offsetParent = null
   */
  isElementVisible(element) {
    if (!element) {
      return false;
    }

    // offsetParent is null for hidden elements
    // BUT it's also null for body/html and position:fixed elements, so check for those
    if (element.offsetParent !== null) {
      return true;
    }
    if (element === document.body || element === document.documentElement) {
      return true;
    }

    // Check element's own styles
    const elementStyle = window.getComputedStyle(element);
    if (elementStyle.display === 'none' || elementStyle.visibility === 'hidden') {
      return false;
    }

    // position:fixed elements also have null offsetParent but are visible
    if (elementStyle.position === 'fixed') {
      return true;
    }

    // If offsetParent is null and element is not fixed/body/html,
    // check if it's because a parent is hidden
    let parent = element.parentElement;
    while (parent && parent !== document.body) {
      const style = window.getComputedStyle(parent);
      if (style.display === 'none' || style.visibility === 'hidden') {
        return false;
      }
      parent = parent.parentElement;
    }

    // If we got here and element has no offsetParent, it's likely detached/stale
    // unless it has position:fixed which we already checked
    return element.offsetParent !== null || elementStyle.position === 'fixed';
  }

  /**
   * Check if specific settings changed
   * @param {Array<string>} keys - Settings keys to check
   * @param {Object} newSettings - New settings object
   * @returns {boolean} True if any of the specified settings changed
   */
  settingsChanged(keys, newSettings) {
    const previousSettings = this.previousSettings || {};
    return keys.some(key => {
      const newValue = key.includes('.')
        ? key.split('.').reduce((obj, k) => obj?.[k], newSettings)
        : newSettings[key];
      const oldValue = key.includes('.')
        ? key.split('.').reduce((obj, k) => obj?.[k], previousSettings)
        : previousSettings[key];
      return newValue !== oldValue;
    });
  }
}

export default BaseModule;
