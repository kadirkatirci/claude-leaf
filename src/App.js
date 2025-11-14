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
    console.log('🏗️ [ARCHITECTURE] Starting initialization sequence...');

    // STEP 1: Load settings FIRST (critical for all other components)
    console.log('📍 [STEP 1/6] Loading settings BEFORE anything else...');
    const startTime = performance.now();

    try {
      await settingsStore.load();
      console.log('✅ [STEP 1/6] Settings loaded successfully');
    } catch (error) {
      console.error('⚠️ [STEP 1/6] Failed to load settings, using defaults:', error);
      // Continue with defaults
    }

    // Initialize SettingsCache with loaded settings
    const { default: settingsCache } = await import('./core/SettingsCache.js');
    await settingsCache.init(settingsStore);
    console.log('✅ [STEP 1/6] SettingsCache initialized - settings now available SYNCHRONOUSLY');

    const settings = await settingsStore.getAll();

    // STEP 2: Initialize core utilities with settings available
    console.log('📍 [STEP 2/6] Initializing core infrastructure...');
    await DOMUtils.init();

    // Initialize centralized managers
    const { default: asyncManager } = await import('./managers/AsyncManager.js');
    const { default: domManager } = await import('./managers/DOMManager.js');
    const { default: buttonFactory } = await import('./factories/ButtonFactory.js');

    console.log('✅ [STEP 2/6] Centralized managers loaded:');
    console.log('  - AsyncManager: Ready (handles all timers/async)');
    console.log('  - DOMManager: Ready (single MutationObserver)');
    console.log('  - ButtonFactory: Ready (unified button creation)');
    console.log('  - SettingsCache: Ready (synchronous access)');

    // Set debug mode if enabled
    if (settings.general?.debugMode) {
      asyncManager.setDebugMode(true);
      domManager.setDebugMode(true);
      buttonFactory.setDebugMode(true);
      settingsCache.setDebugMode(true);
      console.log('🐛 Debug mode enabled for all managers');
    }

    // Initialize DOM manager
    domManager.init();

    // STEP 3: Initialize managers with settings
    console.log('📍 [STEP 3/6] Initializing application managers...');
    this.initializeManagers();
    this.applySettingsToManagers(settings);
    console.log('✅ [STEP 3/6] Managers initialized with settings');

    // STEP 4: Initialize cross-tab synchronization
    console.log('📍 [STEP 4/6] Setting up cross-tab synchronization...');
    this.initializeCrossTabSync();
    console.log('✅ [STEP 4/6] Cross-tab sync ready');

    // STEP 5: Register and initialize modules
    console.log('📍 [STEP 5/6] Initializing feature modules...');
    this.registerModulesWithDependencies();
    await this.initializeModules();
    console.log('✅ [STEP 5/6] Modules initialized:', Array.from(this.modules.keys()));

    // STEP 6: Setup global event listeners
    console.log('📍 [STEP 6/6] Setting up global listeners...');
    this.setupGlobalListeners();
    console.log('✅ [STEP 6/6] Global listeners ready');

    // Enable debug mode UI if configured
    if (settings.general?.debugMode) {
      this.enableDebugMode();
    }

    const totalTime = Math.round(performance.now() - startTime);
    console.log(`🎉 [ARCHITECTURE] Initialization complete in ${totalTime}ms`);
    console.log('📊 [ARCHITECTURE] System status:');
    console.log('  - No polling intervals (all event-driven)');
    console.log('  - Single MutationObserver active');
    console.log('  - Settings cached for synchronous access');
    console.log('  - All timers centralized in AsyncManager');
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
  async destroy() {
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

    // Clean up new centralized managers
    try {
      const { default: asyncManager } = await import('./managers/AsyncManager.js');
      const { default: domManager } = await import('./managers/DOMManager.js');
      const { default: buttonFactory } = await import('./factories/ButtonFactory.js');
      const { default: settingsCache } = await import('./core/SettingsCache.js');

      asyncManager.destroy();
      domManager.destroy();
      buttonFactory.clearAll();
      settingsCache.clear();
    } catch (error) {
      console.error('Error cleaning up managers:', error);
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
   * Verify architecture implementation
   * Run with: window.claudeProductivity.verifyArchitecture()
   */
  async verifyArchitecture() {
    console.log('🔍 [ARCHITECTURE VERIFICATION] Starting system check...\n');

    const { default: asyncManager } = await import('./managers/AsyncManager.js');
    const { default: domManager } = await import('./managers/DOMManager.js');
    const { default: buttonFactory } = await import('./factories/ButtonFactory.js');
    const { default: settingsCache } = await import('./core/SettingsCache.js');

    // 1. Check AsyncManager
    const asyncStats = asyncManager.getStats();
    const activeOps = asyncManager.listActiveOperations();
    console.log('📊 AsyncManager Status:');
    console.log('  - Timers:', asyncStats.timers);
    console.log('  - Promises:', asyncStats.promises);
    console.log('  - Observers:', asyncStats.observers);

    if (activeOps.timers.length > 0) {
      console.log('  ⚠️ Active timers found:', activeOps.timers);
      const hasPolling = activeOps.timers.some(t =>
        t.type === 'interval' && t.interval < 10000
      );
      if (hasPolling) {
        console.error('  ❌ POLLING DETECTED! Intervals under 10s found');
      }
    } else {
      console.log('  ✅ No active timers (good - all event-driven)');
    }

    // 2. Check DOMManager
    const domStats = domManager.getStats();
    console.log('\n📊 DOMManager Status:');
    console.log('  - Observers registered:', domStats.observers);
    console.log('  - Cached elements:', domStats.cachedElements);
    console.log('  - Observer active:', domStats.isObserving);
    if (domStats.isObserving) {
      console.log('  ✅ Single MutationObserver is active');
    } else {
      console.log('  ⚠️ MutationObserver not active');
    }

    // 3. Check ButtonFactory
    const buttonStats = buttonFactory.getStats();
    console.log('\n📊 ButtonFactory Status:');
    console.log('  - Fixed buttons:', buttonStats.fixedButtons);
    console.log('  - Visibility timers:', buttonStats.visibilityTimers);
    if (buttonStats.visibilityTimers === 0) {
      console.log('  ✅ No visibility polling (event-driven)');
    } else {
      console.log('  ⚠️ Visibility timers found:', buttonStats.visibilityTimers);
    }

    // 4. Check SettingsCache
    const cacheLoaded = settingsCache.isLoaded();
    console.log('\n📊 SettingsCache Status:');
    console.log('  - Cache loaded:', cacheLoaded);
    if (cacheLoaded) {
      // Test synchronous access
      const theme = settingsCache.getTheme();
      const opacity = settingsCache.getOpacity();
      console.log('  ✅ Synchronous access working:');
      console.log('    - Theme:', theme);
      console.log('    - Opacity:', opacity);
    } else {
      console.log('  ❌ Settings not cached!');
    }

    // 5. Check for old intervals
    console.log('\n🔍 Checking for legacy polling...');

    // Check window for any intervals
    const checkForIntervals = () => {
      let intervalCount = 0;
      // This is a heuristic - we can't directly access all intervals
      // but we can check known problem areas

      if (typeof window.__checkInterval !== 'undefined') {
        console.log('  ⚠️ Legacy interval found: window.__checkInterval');
        intervalCount++;
      }

      // Check modules for visibilityCheckInterval
      this.modules.forEach((module, name) => {
        if (module.visibilityCheckInterval) {
          console.log(`  ⚠️ ${name} has visibilityCheckInterval`);
          intervalCount++;
        }
        if (module.scanInterval) {
          console.log(`  ⚠️ ${name} has scanInterval`);
          intervalCount++;
        }
      });

      return intervalCount;
    };

    const intervalCount = checkForIntervals();
    if (intervalCount === 0) {
      console.log('  ✅ No legacy polling intervals found');
    } else {
      console.log(`  ❌ Found ${intervalCount} legacy intervals`);
    }

    // 6. Performance metrics
    console.log('\n📊 Performance Metrics:');
    const memory = performance.memory;
    if (memory) {
      console.log(`  - JS Heap: ${Math.round(memory.usedJSHeapSize / 1024 / 1024)}MB / ${Math.round(memory.jsHeapSizeLimit / 1024 / 1024)}MB`);
    }

    // Summary
    console.log('\n✅ [ARCHITECTURE VERIFICATION] Complete');
    console.log('Run this check with: window.claudeProductivity.verifyArchitecture()');

    return {
      asyncManager: asyncStats,
      domManager: domStats,
      buttonFactory: buttonStats,
      settingsCache: cacheLoaded,
      hasPolling: intervalCount > 0
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