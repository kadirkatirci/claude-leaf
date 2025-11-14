/**
 * ClaudeProductivityApp - Main application manager
 * Coordinates all modules and manages lifecycle
 */

import { settingsStore, bookmarkStore, markerStore, conversationStateStore } from './stores/index.js';
import { eventBus, Events } from './utils/EventBus.js';
import VisibilityManager from './utils/VisibilityManager.js';
import DOMUtils from './utils/DOMUtils.js';
import ThemeManager from './managers/ThemeManager.js';
import KeyboardManager from './managers/KeyboardManager.js';
import ObserverManager from './managers/ObserverManager.js';
import { storageSync } from './core/StorageSync.js';

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
    this.initializing = false;
    this.initState = {
      status: 'idle', // idle | initializing | ready | failed
      failedModules: [],
      errors: [],
      startTime: null
    };
    this.managers = {
      visibility: null,
      theme: null,
      keyboard: null,
      observer: null
    };
    this.moduleMetadata = new Map(); // Track module dependencies
  }

  /**
   * Initialize the application with timeout and error handling
   */
  async init() {
    // Check for duplicate initialization
    if (this.initialized) {
      console.warn('⚠️ Application already initialized');
      return;
    }

    if (this.initializing) {
      console.warn('⚠️ Application initialization already in progress');
      return;
    }

    console.log('🚀 Claude Productivity Extension starting...');

    this.initializing = true;
    this.initState.status = 'initializing';
    this.initState.startTime = Date.now();

    try {
      // Initialize with timeout protection (10 seconds)
      await this.initializeWithTimeout(10000);

      this.initialized = true;
      this.initializing = false;
      this.initState.status = 'ready';

      console.log('✅ Claude Productivity Extension ready!');
      console.log('📦 Active modules:', Array.from(this.modules.keys()));

      if (this.initState.failedModules.length > 0) {
        console.warn('⚠️ Failed modules:', this.initState.failedModules);
      }
    } catch (error) {
      this.initializing = false;
      this.initState.status = 'failed';
      this.initState.errors.push({
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });

      console.error('❌ Claude Productivity Extension initialization failed:', error);
      this.handleInitializationError(error);
    }
  }

  /**
   * Initialize with timeout protection
   */
  async initializeWithTimeout(timeout) {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error(`Initialization timeout after ${timeout}ms`)),
        timeout
      )
    );

    await Promise.race([this.doInitialize(), timeoutPromise]);
  }

  /**
   * Main initialization sequence
   */
  async doInitialize() {
    // Initialize core utilities
    DOMUtils.init();

    // Initialize managers
    this.initializeManagers();

    // Initialize cross-tab synchronization
    this.initializeCrossTabSync();

    // Load settings (single load, no double load)
    try {
      await settingsStore.load();
    } catch (error) {
      console.error('Failed to load settings, using defaults:', error);
      // Continue with defaults
    }

    const settings = await settingsStore.getAll();

    // Apply settings to managers
    this.applySettingsToManagers(settings);

    // Register feature modules with dependencies
    this.registerModulesWithDependencies();

    // Initialize all modules (respecting dependencies)
    await this.initializeModules();

    // Setup global event listeners
    this.setupGlobalListeners();

    // Enable debug mode if configured
    if (settings.general?.debugMode) {
      this.enableDebugMode();
    }
  }

  /**
   * Initialize cross-tab synchronization
   */
  initializeCrossTabSync() {
    console.log('🔄 Initializing cross-tab synchronization...');

    try {
      // Register all stores for synchronization
      storageSync.registerStore('settings', settingsStore.store);
      storageSync.registerStore('bookmarks', bookmarkStore.store);
      storageSync.registerStore('markers', markerStore.store);
      storageSync.registerStore('conversationState', conversationStateStore.store);

      // Initialize the listener for storage changes
      storageSync.initializeListener();

      console.log('✅ Cross-tab synchronization initialized');
    } catch (error) {
      console.error('⚠️ Failed to initialize cross-tab sync:', error);
      // Continue without cross-tab sync (not critical for functionality)
    }
  }

  /**
   * Handle initialization errors gracefully
   */
  handleInitializationError(error) {
    console.error('🔧 Attempting graceful degradation...');

    // Try to at least set up basic managers
    try {
      if (!this.managers.visibility) {
        this.managers.visibility = VisibilityManager;
      }
      if (!this.managers.theme) {
        this.managers.theme = ThemeManager;
      }

      console.log('⚠️ Operating in degraded mode with basic functionality only');
    } catch (fallbackError) {
      console.error('❌ Even graceful degradation failed:', fallbackError);
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
   * Register all feature modules with dependencies
   */
  registerModulesWithDependencies() {
    // Core navigation (no dependencies)
    this.registerModule('navigation', new NavigationModule(), {
      dependencies: []
    });

    // Content enhancement
    this.registerModule('editHistory', new EditHistoryModule(), {
      dependencies: []
    });
    this.registerModule('compactView', new CompactViewModule(), {
      dependencies: ['navigation'] // Depends on navigation being ready
    });

    // Organization features
    this.registerModule('bookmarks', new BookmarkModule(), {
      dependencies: []
    });
    this.registerModule('emojiMarkers', new EmojiMarkerModule(), {
      dependencies: []
    });

    // UI improvements
    this.registerModule('sidebarCollapse', new SidebarCollapseModule(), {
      dependencies: []
    });
    this.registerModule('contentFolding', new ContentFoldingModule(), {
      dependencies: []
    });
  }

  /**
   * Register a single module with dependency metadata
   * @param {string} name - Module name
   * @param {BaseModule} module - Module instance
   * @param {Object} [metadata] - Module metadata including dependencies
   */
  registerModule(name, module, metadata = {}) {
    if (this.modules.has(name)) {
      console.warn(`⚠️ Module ${name} already registered`);
      return;
    }

    this.modules.set(name, module);
    this.moduleMetadata.set(name, metadata);
    console.log(`📦 Module ${name} registered`);
  }

  /**
   * Topological sort for module initialization order
   */
  topologicalSort(modules) {
    const sorted = [];
    const visited = new Set();
    const visiting = new Set();

    const visit = (name) => {
      if (visited.has(name)) return;
      if (visiting.has(name)) {
        console.warn(`⚠️ Circular dependency detected in module: ${name}`);
        return;
      }

      visiting.add(name);

      const metadata = this.moduleMetadata.get(name) || {};
      const dependencies = metadata.dependencies || [];

      for (const dep of dependencies) {
        if (this.modules.has(dep)) {
          visit(dep);
        }
      }

      visiting.delete(name);
      visited.add(name);
      sorted.push(name);
    };

    for (const name of modules.keys()) {
      visit(name);
    }

    return sorted;
  }

  /**
   * Initialize all registered modules respecting dependencies
   */
  async initializeModules() {
    const initOrder = this.topologicalSort(this.modules);

    for (const moduleName of initOrder) {
      const module = this.modules.get(moduleName);
      const metadata = this.moduleMetadata.get(moduleName) || {};

      try {
        console.log(`🚀 Initializing module: ${moduleName}`);
        await module.init();
        console.log(`✅ Module ${moduleName} initialized`);
      } catch (error) {
        console.error(`❌ Failed to initialize ${moduleName} module:`, error);

        // Track failed module
        this.initState.failedModules.push({
          name: moduleName,
          error: error.message,
          timestamp: new Date().toISOString()
        });

        // Check if dependent modules will be affected
        const dependents = Array.from(this.moduleMetadata.entries())
          .filter(([_, meta]) => meta.dependencies?.includes(moduleName))
          .map(([name, _]) => name);

        if (dependents.length > 0) {
          console.warn(
            `⚠️ Modules ${dependents.join(', ')} depend on failed module ${moduleName}`
          );
        }

        // Continue with other modules (graceful degradation)
      }
    }
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
   * Get health check information
   */
  async healthCheck() {
    return {
      status: this.initState.status,
      initialized: this.initialized,
      initializing: this.initializing,
      initializationTime: this.initState.startTime
        ? Date.now() - this.initState.startTime
        : null,
      failedModules: this.initState.failedModules,
      errors: this.initState.errors,
      managers: {
        visibility: this.managers.visibility ? 'active' : 'inactive',
        theme: this.managers.theme ? 'active' : 'inactive',
        keyboard: this.managers.keyboard ? 'active' : 'inactive',
        observer: this.managers.observer ? 'active' : 'inactive'
      },
      storage: storageSync.getStatus()
    };
  }

  /**
   * Get debug information
   */
  async getDebugInfo() {
    return {
      initialized: this.initialized,
      initState: this.initState,
      modules: Array.from(this.modules.keys()),
      activeModules: Array.from(this.modules.values())
        .filter(m => m.enabled)
        .map(m => m.name || m.constructor.name),
      failedModules: this.initState.failedModules,
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