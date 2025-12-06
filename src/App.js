/**
 * ClaudeProductivityApp - Main application manager
 * Coordinates all modules and manages lifecycle
 * 
 * v2.2.0 - Fixed import order for NavigationInterceptor/VisibilityManager
 */

// CRITICAL: Import NavigationInterceptor FIRST before anything else
// This ensures window.__navigationInterceptor is set before VisibilityManager initializes
import navigationInterceptor, { PageType } from './core/NavigationInterceptor.js';

// Now import VisibilityManager - it will find NavigationInterceptor on window
import VisibilityManager from './utils/VisibilityManager.js';

// Rest of imports
import { settingsStore, bookmarkStore, markerStore, conversationStateStore } from './stores/index.js';
import { eventBus, Events } from './utils/EventBus.js';
import DOMUtils from './utils/DOMUtils.js';
import ThemeManager from './managers/ThemeManager.js';
import KeyboardManager from './managers/KeyboardManager.js';
import ObserverManager from './managers/ObserverManager.js';
import { storageSync } from './core/StorageSync.js';
import MessageRegistry from './core/MessageRegistry.js';
import domReadyChecker from './utils/DOMReadyChecker.js';

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
    this.destroying = false;
    this.initState = {
      status: 'idle',
      failedModules: [],
      errors: [],
      startTime: null
    };
    this.managers = {
      visibility: null,
      theme: null,
      keyboard: null,
      observer: null,
      messageRegistry: null
    };
    this.moduleMetadata = new Map();
    
    // Navigation handling
    this.navigationUnsubscribe = null;
    this.restartDebounceTimer = null;
    this.lastNavigationTime = 0;
  }

  async init() {
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
      await this.initializeWithTimeout(15000);

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

  async initializeWithTimeout(timeout) {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error(`Initialization timeout after ${timeout}ms`)),
        timeout
      )
    );

    await Promise.race([this.doInitialize(), timeoutPromise]);
  }

  async doInitialize() {
    console.log('🏗️ [ARCHITECTURE] Starting initialization sequence...');
    const startTime = performance.now();

    // STEP 0: Verify NavigationInterceptor is ready
    console.log('📍 [STEP 0/7] Verifying NavigationInterceptor...');
    const navState = navigationInterceptor.getState();
    console.log(`  - NavigationInterceptor ready: ${!!window.__navigationInterceptor}`);
    console.log(`  - Current page: ${navState.pageType}`);
    console.log(`  - Is conversation: ${navState.isConversationPage}`);
    
    // Setup App's navigation listener
    this.setupNavigationListener();
    console.log('✅ [STEP 0/7] NavigationInterceptor verified');

    // STEP 1: Load settings
    console.log('📍 [STEP 1/7] Loading settings...');

    try {
      await settingsStore.load();
      console.log('✅ [STEP 1/7] Settings loaded successfully');
    } catch (error) {
      console.error('⚠️ [STEP 1/7] Failed to load settings, using defaults:', error);
    }

    const { default: settingsCache } = await import('./core/SettingsCache.js');
    await settingsCache.init(settingsStore);
    const settings = await settingsStore.getAll();

    // STEP 2: Wait for DOM
    console.log('📍 [STEP 2/7] Waiting for DOM...');
    
    if (navState.isConversationPage) {
      console.log('  - Waiting for conversation DOM...');
      const isReady = await domReadyChecker.waitForConversationReady({ maxWait: 5000 });
      console.log(`  - Conversation DOM ready: ${isReady}`);
    } else if (navState.isNewChatPage) {
      console.log('  - On /new page, waiting for basic DOM...');
      await domReadyChecker.waitForReady({ maxWait: 2000 });
    } else {
      console.log('  - Other page, waiting for basic DOM...');
      await domReadyChecker.waitForReady({ maxWait: 2000 });
    }
    console.log('✅ [STEP 2/7] DOM ready');

    // STEP 3: Initialize core utilities
    console.log('📍 [STEP 3/7] Initializing core infrastructure...');
    await DOMUtils.init();

    const { default: asyncManager } = await import('./managers/AsyncManager.js');
    const { default: domManager } = await import('./managers/DOMManager.js');
    const { default: buttonFactory } = await import('./factories/ButtonFactory.js');

    if (settings.general?.debugMode) {
      asyncManager.setDebugMode(true);
      domManager.setDebugMode(true);
      buttonFactory.setDebugMode(true);
      settingsCache.setDebugMode(true);
      navigationInterceptor.setDebugMode(true);
      domReadyChecker.setDebugMode(true);
      VisibilityManager.setDebugMode(true);
      console.log('🐛 Debug mode enabled');
    }

    domManager.init();

    // MessageRegistry
    const messageRegistry = MessageRegistry.getInstance();
    if (settings.general?.debugMode) {
      messageRegistry.setDebugMode(true);
    }
    await messageRegistry.start();
    this.managers.messageRegistry = messageRegistry;
    console.log('✅ [STEP 3/7] Core infrastructure ready');

    // STEP 4: Initialize managers
    console.log('📍 [STEP 4/7] Initializing managers...');
    this.initializeManagers();
    this.applySettingsToManagers(settings);
    console.log('✅ [STEP 4/7] Managers ready');

    // STEP 5: Cross-tab sync
    console.log('📍 [STEP 5/7] Setting up cross-tab sync...');
    this.initializeCrossTabSync();
    console.log('✅ [STEP 5/7] Cross-tab sync ready');

    // STEP 6: Initialize modules
    console.log('📍 [STEP 6/7] Initializing modules...');
    this.registerModulesWithDependencies();
    await this.initializeModules();
    console.log('✅ [STEP 6/7] Modules ready:', Array.from(this.modules.keys()));

    // STEP 7: Global listeners
    console.log('📍 [STEP 7/7] Setting up global listeners...');
    this.setupGlobalListeners();
    console.log('✅ [STEP 7/7] Global listeners ready');

    if (settings.general?.debugMode) {
      this.enableDebugMode();
    }

    const totalTime = Math.round(performance.now() - startTime);
    console.log(`🎉 Initialization complete in ${totalTime}ms`);
  }

  setupNavigationListener() {
    if (this.navigationUnsubscribe) {
      this.navigationUnsubscribe();
    }

    this.navigationUnsubscribe = navigationInterceptor.onNavigate((event) => {
      this.handleNavigationEvent(event);
    });
  }

  async handleNavigationEvent(event) {
    // Skip initial events
    if (event.type === 'initial') {
      return;
    }

    // Debounce
    const now = Date.now();
    if (now - this.lastNavigationTime < 100) {
      return;
    }
    this.lastNavigationTime = now;

    console.log(`[App] Navigation: ${event.previousPageType || 'null'} → ${event.pageType}`);

    if (this.restartDebounceTimer) {
      clearTimeout(this.restartDebounceTimer);
    }

    // Handle transitions
    if (event.wasNewChatPage && event.isConversationPage) {
      console.log('[App] /new → conversation, scheduling restart');
      this.scheduleRestart(500);
    } else if (event.wasConversationPage && event.isConversationPage) {
      console.log('[App] conversation → conversation');
      this.notifyModulesOfPageChange(event);
    } else if (!event.wasConversationPage && event.isConversationPage) {
      console.log('[App] → conversation, scheduling restart');
      this.scheduleRestart(300);
    } else if (event.wasConversationPage && !event.isConversationPage) {
      console.log('[App] conversation →, notifying modules');
      this.notifyModulesOfPageChange(event);
    }
  }

  scheduleRestart(delay) {
    if (this.restartDebounceTimer) {
      clearTimeout(this.restartDebounceTimer);
    }

    this.restartDebounceTimer = setTimeout(async () => {
      this.restartDebounceTimer = null;
      
      const isReady = await domReadyChecker.waitForNavigationComplete({ maxWait: 3000 });
      
      if (isReady) {
        console.log('[App] DOM ready, restarting modules...');
        await this.restartModules();
      } else {
        console.warn('[App] DOM not ready after navigation');
      }
    }, delay);
  }

  async restartModules() {
    console.log('[App] Restarting modules...');

    // Refresh VisibilityManager state
    VisibilityManager.refresh();

    // Restart MessageRegistry
    if (this.managers.messageRegistry) {
      await this.managers.messageRegistry.restart();
    }

    // Reinitialize modules
    for (const [name, module] of this.modules) {
      try {
        if (module.reinitializeUI) {
          await module.reinitializeUI();
        } else if (module.restart) {
          await module.restart();
        }
      } catch (error) {
        console.error(`[App] Error restarting ${name}:`, error);
      }
    }

    console.log('[App] Modules restarted');
  }

  notifyModulesOfPageChange(event) {
    // Refresh VisibilityManager - this will notify all listeners
    VisibilityManager.refresh();
    
    eventBus.emit(Events.URL_CHANGED, event.url);
  }

  initializeCrossTabSync() {
    try {
      storageSync.registerStore('settings', settingsStore.store);
      storageSync.registerStore('bookmarks', bookmarkStore.store);
      storageSync.registerStore('markers', markerStore.store);
      storageSync.registerStore('conversationState', conversationStateStore.store);
      storageSync.initializeListener();
    } catch (error) {
      console.error('⚠️ Failed to initialize cross-tab sync:', error);
    }
  }

  handleInitializationError(error) {
    console.error('🔧 Attempting graceful degradation...');
    try {
      if (!this.managers.visibility) {
        this.managers.visibility = VisibilityManager;
      }
      if (!this.managers.theme) {
        this.managers.theme = ThemeManager;
      }
      console.log('⚠️ Operating in degraded mode');
    } catch (fallbackError) {
      console.error('❌ Graceful degradation failed:', fallbackError);
    }
  }

  initializeManagers() {
    this.managers.visibility = VisibilityManager;
    this.managers.theme = ThemeManager;
    this.managers.keyboard = KeyboardManager;
    this.managers.observer = ObserverManager;
    KeyboardManager.init();
  }

  applySettingsToManagers(settings) {
    ThemeManager.init(settings);
    const debugMode = settings.general?.debugMode || false;
    if (debugMode) {
      VisibilityManager.setDebugMode(true);
      KeyboardManager.setDebugMode(true);
      ObserverManager.setDebugMode(true);
    }
  }

  registerModulesWithDependencies() {
    this.registerModule('navigation', new NavigationModule(), { dependencies: [] });
    this.registerModule('editHistory', new EditHistoryModule(), { dependencies: [] });
    this.registerModule('compactView', new CompactViewModule(), { dependencies: ['navigation'] });
    this.registerModule('bookmarks', new BookmarkModule(), { dependencies: [] });
    this.registerModule('emojiMarkers', new EmojiMarkerModule(), { dependencies: [] });
    this.registerModule('sidebarCollapse', new SidebarCollapseModule(), { dependencies: [] });
    this.registerModule('contentFolding', new ContentFoldingModule(), { dependencies: [] });
  }

  registerModule(name, module, metadata = {}) {
    if (this.modules.has(name)) {
      console.warn(`⚠️ Module ${name} already registered`);
      return;
    }
    this.modules.set(name, module);
    this.moduleMetadata.set(name, metadata);
  }

  topologicalSort(modules) {
    const sorted = [];
    const visited = new Set();
    const visiting = new Set();

    const visit = (name) => {
      if (visited.has(name)) return;
      if (visiting.has(name)) {
        console.warn(`⚠️ Circular dependency: ${name}`);
        return;
      }

      visiting.add(name);
      const metadata = this.moduleMetadata.get(name) || {};
      const dependencies = metadata.dependencies || [];

      for (const dep of dependencies) {
        if (this.modules.has(dep)) visit(dep);
      }

      visiting.delete(name);
      visited.add(name);
      sorted.push(name);
    };

    for (const name of modules.keys()) visit(name);
    return sorted;
  }

  async initializeModules() {
    const initOrder = this.topologicalSort(this.modules);

    for (const moduleName of initOrder) {
      const module = this.modules.get(moduleName);

      try {
        console.log(`🚀 Initializing: ${moduleName}`);
        await module.init();
        console.log(`✅ ${moduleName} ready`);
      } catch (error) {
        console.error(`❌ Failed to initialize ${moduleName}:`, error);
        this.initState.failedModules.push({
          name: moduleName,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  getModule(name) {
    return this.modules.get(name);
  }

  getAllModules() {
    return new Map(this.modules);
  }

  setupGlobalListeners() {
    window.addEventListener('beforeunload', () => this.destroy());

    eventBus.on(Events.SETTINGS_CHANGED, async (settings) => {
      this.applySettingsToManagers(settings);
      if (settings.general) {
        ThemeManager.setTheme(settings.general.colorTheme, settings.general.customColor);
        ThemeManager.setOpacity(settings.general.opacity);
      }
    });

    eventBus.on(Events.FEATURE_TOGGLED, ({ feature, enabled }) => {
      console.log(`🔄 Feature ${feature} ${enabled ? 'enabled' : 'disabled'}`);
    });
  }

  enableDebugMode() {
    console.log('🐛 Debug mode enabled');
    VisibilityManager.setDebugMode(true);
    KeyboardManager.setDebugMode(true);
    ObserverManager.setDebugMode(true);
    navigationInterceptor.setDebugMode(true);
    domReadyChecker.setDebugMode(true);
    if (this.managers.messageRegistry) {
      this.managers.messageRegistry.setDebugMode(true);
    }
  }

  disableDebugMode() {
    VisibilityManager.setDebugMode(false);
    KeyboardManager.setDebugMode(false);
    ObserverManager.setDebugMode(false);
    navigationInterceptor.setDebugMode(false);
    domReadyChecker.setDebugMode(false);
    if (this.managers.messageRegistry) {
      this.managers.messageRegistry.setDebugMode(false);
    }
  }

  async destroy() {
    if (!this.initialized || this.destroying) return;

    this.destroying = true;
    console.log('🗑️ Stopping extension...');

    if (this.restartDebounceTimer) {
      clearTimeout(this.restartDebounceTimer);
      this.restartDebounceTimer = null;
    }

    if (this.navigationUnsubscribe) {
      this.navigationUnsubscribe();
      this.navigationUnsubscribe = null;
    }

    if (this.managers.messageRegistry) {
      this.managers.messageRegistry.stop();
      this.managers.messageRegistry = null;
    }

    for (const [name, module] of this.modules) {
      try {
        module.destroy();
      } catch (err) {
        console.error(`❌ Error destroying ${name}:`, err);
      }
    }

    this.modules.clear();

    if (this.managers.visibility) this.managers.visibility.destroy();
    if (this.managers.theme) this.managers.theme.destroy();
    if (this.managers.keyboard) this.managers.keyboard.destroy();
    if (this.managers.observer) this.managers.observer.destroy();

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

    eventBus.clear();
    this.initialized = false;
    this.destroying = false;
    console.log('✅ Extension stopped');
  }

  async restart() {
    if (this.destroying) {
      console.warn('⚠️ Cannot restart while destroying');
      return;
    }

    console.log('🔄 Restarting...');
    await this.destroy();
    await domReadyChecker.waitForNavigationComplete({ maxWait: 2000 });
    await this.init();
    console.log('✅ Restarted');
  }

  async healthCheck() {
    const navState = navigationInterceptor.getState();
    const visState = VisibilityManager.getStatus();
    const msgRegStatus = this.managers.messageRegistry?.getStatus() || null;
    
    return {
      status: this.initState.status,
      initialized: this.initialized,
      navigation: navState,
      visibility: visState,
      messageRegistry: msgRegStatus,
      failedModules: this.initState.failedModules
    };
  }

  async verifyArchitecture() {
    console.log('🔍 Architecture Verification\n');
    
    const navState = navigationInterceptor.getState();
    const visState = VisibilityManager.getStatus();
    
    console.log('NavigationInterceptor:');
    console.log(`  - Path: ${navState.path}`);
    console.log(`  - Page type: ${navState.pageType}`);
    console.log(`  - Is conversation: ${navState.isConversationPage}`);
    console.log(`  - Listeners: ${navigationInterceptor.getListenerCount()}`);
    
    console.log('\nVisibilityManager:');
    console.log(`  - Initialized: ${visState.initialized}`);
    console.log(`  - Is conversation: ${visState.isConversationPage}`);
    console.log(`  - Listeners: ${visState.listenerCount}`);
    console.log(`  - Has nav subscription: ${visState.hasNavigationSubscription}`);
    console.log(`  - Live check: ${visState.liveCheck}`);
    
    console.log('\nButton States:');
    const buttonIds = {
      'Navigation': 'claude-nav-container',
      'Bookmarks': 'claude-bookmark-button',
      'EmojiMarkers': 'claude-marker-button'
    };
    
    for (const [name, id] of Object.entries(buttonIds)) {
      const el = document.getElementById(id);
      if (el) {
        const s = getComputedStyle(el);
        const visible = s.display !== 'none' && s.visibility !== 'hidden';
        console.log(`  - ${name}: ${visible ? '✅ VISIBLE' : '❌ HIDDEN'}`);
      } else {
        console.log(`  - ${name}: ❓ NOT FOUND`);
      }
    }
    
    return { navState, visState };
  }

  getVersion() {
    return '2.2.0';
  }
}

const app = new ClaudeProductivityApp();
window.claudeProductivity = app;
export default app;
