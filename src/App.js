/**
 * ClaudeProductivityApp - Main application manager
 * Coordinates all modules and manages lifecycle
 */

import { settingsStore } from './stores/index.js';
import { eventBus, Events } from './utils/EventBus.js';
import VisibilityManager from './utils/VisibilityManager.js';
import DOMUtils from './utils/DOMUtils.js';
import ThemeManager from './managers/ThemeManager.js';
import KeyboardManager from './managers/KeyboardManager.js';
import ObserverManager from './managers/ObserverManager.js';

// Import feature modules
import NavigationModule from './modules/NavigationModule.js';
import EditHistoryModule from './modules/EditHistoryModule.js';
import CompactViewModule from './modules/CompactViewModule.js';
import BookmarkModule from './modules/BookmarkModule.js';
import EmojiMarkerModule from './modules/EmojiMarkerModule.js';
import SidebarCollapseModule from './modules/SidebarCollapseModule.js';
import ContentFoldingModule from './modules/ContentFoldingModule.js';

class ClaudeProductivityApp {
  constructor() {
    this.modules = new Map();
    this.initialized = false;
    this.managers = {
      visibility: null,
      theme: null,
      keyboard: null,
      observer: null
    };
  }

  /**
   * Initialize the application
   */
  async init() {
    if (this.initialized) {
      console.warn('⚠️ Application already initialized');
      return;
    }

    console.log('🚀 Claude Productivity Extension starting...');

    // Initialize core utilities
    DOMUtils.init();

    // Initialize managers
    this.initializeManagers();

    // Load settings
    await settingsStore.load();
    const settings = await settingsStore.getAll();

    // Apply settings to managers
    this.applySettingsToManagers(settings);

    // Register feature modules
    this.registerModules();

    // Initialize all modules
    await this.initializeModules();

    // Setup global event listeners
    this.setupGlobalListeners();

    this.initialized = true;

    console.log('✅ Claude Productivity Extension ready!');
    console.log('📦 Active modules:', Array.from(this.modules.keys()));

    // Enable debug mode if configured
    if (settings.general?.debugMode) {
      this.enableDebugMode();
    }
  }

  /**
   * Initialize singleton managers
   */
  initializeManagers() {
    this.managers.visibility = VisibilityManager;
    this.managers.theme = ThemeManager;
    this.managers.keyboard = KeyboardManager;
    this.managers.observer = ObserverManager;

    // Initialize keyboard manager
    KeyboardManager.init();
  }

  /**
   * Apply settings to managers
   */
  applySettingsToManagers(settings) {
    // Initialize theme with settings
    ThemeManager.init(settings);

    // Set debug mode if enabled
    const debugMode = settings.general?.debugMode || false;
    if (debugMode) {
      VisibilityManager.setDebugMode(true);
      KeyboardManager.setDebugMode(true);
      ObserverManager.setDebugMode(true);
    }
  }

  /**
   * Register all feature modules
   */
  registerModules() {
    // Core navigation
    this.registerModule('navigation', new NavigationModule());

    // Content enhancement
    this.registerModule('editHistory', new EditHistoryModule());
    this.registerModule('compactView', new CompactViewModule());

    // Organization features
    this.registerModule('bookmarks', new BookmarkModule());
    this.registerModule('emojiMarkers', new EmojiMarkerModule());

    // UI improvements
    this.registerModule('sidebarCollapse', new SidebarCollapseModule());
    this.registerModule('contentFolding', new ContentFoldingModule());
  }

  /**
   * Register a single module
   * @param {string} name - Module name
   * @param {BaseModule} module - Module instance
   */
  registerModule(name, module) {
    if (this.modules.has(name)) {
      console.warn(`⚠️ Module ${name} already registered`);
      return;
    }

    this.modules.set(name, module);
    console.log(`📦 Module ${name} registered`);
  }

  /**
   * Initialize all registered modules
   */
  async initializeModules() {
    const promises = Array.from(this.modules.entries()).map(([name, module]) =>
      module.init().catch(err => {
        console.error(`❌ Failed to initialize ${name} module:`, err);
      })
    );

    await Promise.all(promises);
  }

  /**
   * Get a specific module
   * @param {string} name - Module name
   * @returns {BaseModule|undefined}
   */
  getModule(name) {
    return this.modules.get(name);
  }

  /**
   * Get all modules
   * @returns {Map<string, BaseModule>}
   */
  getAllModules() {
    return new Map(this.modules);
  }

  /**
   * Setup global event listeners
   */
  setupGlobalListeners() {
    console.log('🔧 Setting up global listeners...');

    // Clean up before page unload
    window.addEventListener('beforeunload', () => {
      this.destroy();
    });

    // Handle settings changes
    eventBus.on(Events.SETTINGS_CHANGED, async (settings) => {
      console.log('⚙️ Settings updated');

      // Update managers with new settings
      this.applySettingsToManagers(settings);

      // Re-apply theme if changed
      if (settings.general) {
        ThemeManager.setTheme(
          settings.general.colorTheme,
          settings.general.customColor
        );
        ThemeManager.setOpacity(settings.general.opacity);
      }
    });

    // Log feature toggles
    eventBus.on(Events.FEATURE_TOGGLED, ({ feature, enabled }) => {
      console.log(`🔄 Feature ${feature} ${enabled ? 'enabled' : 'disabled'}`);
    });

    // Handle navigation updates
    eventBus.on(Events.MESSAGES_UPDATED, () => {
      const count = DOMUtils.findMessages().length;
      console.log(`📬 Messages updated: ${count} messages found`);
    });
  }

  /**
   * Enable debug mode for all components
   */
  enableDebugMode() {
    console.log('🐛 Debug mode enabled');

    // Enable debug in managers
    VisibilityManager.setDebugMode(true);
    KeyboardManager.setDebugMode(true);
    ObserverManager.setDebugMode(true);

    // Log keyboard shortcuts
    const shortcuts = KeyboardManager.getShortcuts();
    console.table(shortcuts);

    // Log observer status
    const observers = ObserverManager.getAllStatuses();
    console.log('Active observers:', observers);
  }

  /**
   * Disable debug mode
   */
  disableDebugMode() {
    console.log('🐛 Debug mode disabled');

    VisibilityManager.setDebugMode(false);
    KeyboardManager.setDebugMode(false);
    ObserverManager.setDebugMode(false);
  }

  /**
   * Stop the application
   */
  destroy() {
    if (!this.initialized) return;

    console.log('🗑️ Stopping Claude Productivity Extension...');

    // Destroy all modules
    this.modules.forEach((module, name) => {
      try {
        module.destroy();
        console.log(`✅ Module ${name} destroyed`);
      } catch (err) {
        console.error(`❌ Error destroying ${name}:`, err);
      }
    });

    // Clear modules
    this.modules.clear();

    // Clean up managers
    if (this.managers.visibility) {
      this.managers.visibility.destroy();
    }
    if (this.managers.theme) {
      this.managers.theme.destroy();
    }
    if (this.managers.keyboard) {
      this.managers.keyboard.destroy();
    }
    if (this.managers.observer) {
      this.managers.observer.destroy();
    }

    // Clear event bus
    eventBus.clear();

    this.initialized = false;
    console.log('✅ Claude Productivity Extension stopped');
  }

  /**
   * Restart the application
   */
  async restart() {
    console.log('🔄 Restarting application...');
    this.destroy();
    await new Promise(resolve => setTimeout(resolve, 100)); // Brief delay
    await this.init();
    console.log('✅ Application restarted');
  }

  /**
   * Get debug information
   */
  async getDebugInfo() {
    return {
      initialized: this.initialized,
      modules: Array.from(this.modules.keys()),
      activeModules: Array.from(this.modules.values())
        .filter(m => m.enabled)
        .map(m => m.name || m.constructor.name),
      managers: {
        visibility: this.managers.visibility ? 'active' : 'inactive',
        theme: this.managers.theme ? 'active' : 'inactive',
        keyboard: this.managers.keyboard ? 'active' : 'inactive',
        observer: this.managers.observer ? 'active' : 'inactive'
      },
      settings: await settingsStore.getAll(),
      observers: ObserverManager.getAllStatuses(),
      shortcuts: KeyboardManager.getShortcuts()
    };
  }

  /**
   * Get application version
   */
  getVersion() {
    return '2.0.0'; // Refactored version
  }
}

// Create singleton instance
const app = new ClaudeProductivityApp();

// Add to global scope for debugging
window.claudeProductivity = app;

// Export singleton
export default app;