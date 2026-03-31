/* eslint-disable no-console */
/**
 * ClaudeProductivityApp - Main application manager
 * Coordinates all modules and manages lifecycle
 */

// CRITICAL: Import NavigationInterceptor FIRST before anything else
// This ensures window.__navigationInterceptor is set before VisibilityManager initializes
import navigationInterceptor from './core/NavigationInterceptor.js';

// Now import VisibilityManager - it will find NavigationInterceptor on window
import VisibilityManager from './utils/VisibilityManager.js';

// Rest of imports
import { settingsStore, bookmarkStore, markerStore, editHistoryStore } from './stores/index.js';
import { isDevDisabled } from './config/DevConfig.js';
import { debugLog } from './config/debug.js';
import errorTracker from './utils/ErrorTracker.js';
import sessionTracker from './utils/SessionTracker.js';
import { trackEvent } from './analytics/Analytics.js';
import { eventBus, Events } from './utils/EventBus.js';
import DOMUtils from './utils/DOMUtils.js';
import ThemeManager from './managers/ThemeManager.js';
import KeyboardManager from './managers/KeyboardManager.js';
import ObserverManager from './managers/ObserverManager.js';
import { storageSync } from './core/StorageSync.js';
import domReadyChecker from './utils/DOMReadyChecker.js';
import { storeSyncChannel } from './utils/StoreSyncChannel.js';

// Core Services
import { panelManager } from './components/PanelManager.js';
import { messageHub } from './core/MessageHub.js';

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
      startTime: null,
    };
    this.managers = {
      visibility: null,
      theme: null,
      keyboard: null,
      observer: null,
    };
    this.moduleMetadata = new Map();

    // Navigation handling
    this.navigationUnsubscribe = null;
    this.restartDebounceTimer = null;
    this.lastNavigationTime = 0;
    this.settingsUnsubscribe = null;
    this.storeSyncUnsubscribe = null;

    // Setup message listener immediately so popup can communicate
    // even before full initialization completes
    this.setupChromeMessageListener();

    // Initialize global error tracking
    errorTracker.init();
  }

  async init() {
    if (this.initialized) {
      debugLog('navigation', 'Application already initialized');
      return;
    }

    if (this.initializing) {
      debugLog('navigation', 'Application initialization already in progress');
      return;
    }

    this.initializing = true;
    this.initState.status = 'initializing';
    this.initState.startTime = Date.now();

    try {
      await this.initializeWithTimeout(15000);

      this.initialized = true;
      this.initializing = false;
      this.initState.status = 'ready';

      debugLog('navigation', 'Extension ready. Active modules:', Array.from(this.modules.keys()));

      if (this.initState.failedModules.length > 0) {
        console.warn('[App] Failed modules:', this.initState.failedModules);
      }
    } catch (error) {
      this.initializing = false;
      this.initState.status = 'failed';
      this.initState.errors.push({
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
      });

      console.error('[App] Initialization failed:', error);
      errorTracker.captureError({
        message: error.message,
        error,
        type: 'init_error',
        module: 'app',
        method: 'init',
        fatal: true,
      });
      this.handleInitializationError(error);
    }
  }

  async initializeWithTimeout(timeout) {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Initialization timeout after ${timeout}ms`)), timeout);
    });

    await Promise.race([this.doInitialize(), timeoutPromise]);
  }

  async doInitialize() {
    const startTime = performance.now();

    // STEP 0: Verify NavigationInterceptor is ready
    const navState = navigationInterceptor.getState();
    debugLog(
      'navigation',
      `Init: page=${navState.pageType}, conversation=${navState.isConversationPage}`
    );

    // Setup App's navigation listener
    this.setupNavigationListener();

    // STEP 1: Load settings
    try {
      await settingsStore.load();
    } catch (error) {
      console.warn('[App] Failed to load settings, using defaults:', error);
    }

    const { default: settingsCache } = await import('./core/SettingsCache.js');
    await settingsCache.init(settingsStore);
    const settings = await settingsStore.getAll();

    // STEP 2: Wait for DOM
    if (navState.isConversationPage) {
      await domReadyChecker.waitForConversationReady({ maxWait: 5000 });
    } else {
      await domReadyChecker.waitForReady({ maxWait: 2000 });
    }

    // STEP 3: Initialize core utilities
    await DOMUtils.init();

    const { default: asyncManager } = await import('./managers/AsyncManager.js');
    const { default: domManager } = await import('./managers/DOMManager.js');

    if (settings.general?.debugMode) {
      asyncManager.setDebugMode(true);
      domManager.setDebugMode(true);
      settingsCache.setDebugMode(true);
      navigationInterceptor.setDebugMode(true);
      domReadyChecker.setDebugMode(true);
      VisibilityManager.setDebugMode(true);
    }

    domManager.init();

    // Initialize Core Services
    panelManager.init();
    messageHub.start();

    // STEP 4: Initialize managers
    this.initializeManagers();
    this.applySettingsToManagers(settings);

    // STEP 5: Cross-tab sync
    this.initializeCrossTabSync();
    this.initializeStoreSync();

    // STEP 6: Initialize modules
    this.registerModulesWithDependencies();
    await this.initializeModules();

    // STEP 7: Global listeners
    this.setupGlobalListeners();

    if (settings.general?.debugMode) {
      this.enableDebugMode();
    }

    const totalTime = Math.round(performance.now() - startTime);
    debugLog('performance', `Initialization complete in ${totalTime}ms`);

    // Start session tracking
    sessionTracker.start();
    trackEvent('perf_init', {
      module: 'app',
      init_ms: totalTime,
    });
  }

  setupNavigationListener() {
    if (this.navigationUnsubscribe) {
      this.navigationUnsubscribe();
    }

    this.navigationUnsubscribe = navigationInterceptor.onNavigate(event => {
      this.handleNavigationEvent(event);
    });
  }

  handleNavigationEvent(event) {
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

    debugLog('navigation', `Navigation: ${event.previousPageType || 'null'} -> ${event.pageType}`);

    if (this.restartDebounceTimer) {
      clearTimeout(this.restartDebounceTimer);
    }

    // Handle transitions
    if (event.wasNewChatPage && event.isConversationPage) {
      this.scheduleRestart(500);
    } else if (event.wasConversationPage && event.isConversationPage) {
      this.notifyModulesOfPageChange(event);
    } else if (!event.wasConversationPage && event.isConversationPage) {
      this.scheduleRestart(300);
    } else if (event.wasConversationPage && !event.isConversationPage) {
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
        await this.restartModules();
      } else {
        debugLog('navigation', 'DOM not ready after navigation');
      }
    }, delay);
  }

  async restartModules() {
    debugLog('navigation', 'Restarting modules...');

    // Refresh VisibilityManager state
    VisibilityManager.refresh();

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
  }

  notifyModulesOfPageChange(event) {
    // Refresh VisibilityManager - this will notify all listeners
    VisibilityManager.refresh();

    eventBus.emit(Events.URL_CHANGED, event.url);
  }

  initializeCrossTabSync() {
    try {
      // Only register chrome.storage based stores
      // IndexedDB stores (bookmarks, markers, conversationState) don't work with
      // chrome.storage.onChanged - they would need BroadcastChannel API for cross-tab sync
      storageSync.registerStore('settings', settingsStore.store);
      storageSync.initializeListener();
    } catch (error) {
      console.warn('[App] Failed to initialize cross-tab sync:', error);
    }
  }

  initializeStoreSync() {
    if (this.storeSyncUnsubscribe) {
      return;
    }

    this.storeSyncUnsubscribe = storeSyncChannel.subscribe(message => {
      this.handleStoreSyncMessage(message).catch(error => {
        console.error('[App] Failed to handle store sync message:', error);
      });
    });
  }

  async handleStoreSyncMessage(message) {
    if (!message?.storeId) {
      return;
    }

    debugLog('sync', 'Received cross-tab store sync message', message);
    await this.refreshModulesForStore(message.storeId);
  }

  async refreshModule(moduleName) {
    const module = this.getModule(moduleName);
    if (!module || !module.enabled) {
      return;
    }

    if (typeof module.waitAndUpdateUI === 'function') {
      await module.waitAndUpdateUI();
      return;
    }

    if (typeof module.updateUI === 'function') {
      await module.updateUI();
    }
  }

  async refreshModulesForStore(storeId) {
    switch (storeId) {
      case 'bookmarks':
        await this.refreshModule('bookmarks');
        break;
      case 'markers':
        await this.refreshModule('emojiMarkers');
        break;
      case 'editHistory':
        await this.refreshModule('editHistory');
        break;
      default:
        break;
    }
  }

  async refreshAllDataModules() {
    await this.refreshModulesForStore('bookmarks');
    await this.refreshModulesForStore('markers');
    await this.refreshModulesForStore('editHistory');
  }

  handleSettingsUpdate(settings) {
    if (!settings || typeof settings !== 'object') {
      throw new Error('Invalid settings payload');
    }

    settingsStore.invalidateMergedCache();
    settingsStore.store.onStorageChanged(settings);
  }

  handleInitializationError(_error) {
    // Attempt graceful degradation
    try {
      if (!this.managers.visibility) {
        this.managers.visibility = VisibilityManager;
      }
      if (!this.managers.theme) {
        this.managers.theme = ThemeManager;
      }
      debugLog('navigation', 'Operating in degraded mode');
    } catch (fallbackError) {
      console.error('[App] Graceful degradation failed:', fallbackError);
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
    const debugMode = settings?.general?.debugMode === true;
    if (debugMode) {
      VisibilityManager.setDebugMode(true);
      KeyboardManager.setDebugMode(true);
      ObserverManager.setDebugMode(true);
    } else {
      VisibilityManager.setDebugMode(false);
      KeyboardManager.setDebugMode(false);
      ObserverManager.setDebugMode(false);
    }
  }

  registerModulesWithDependencies() {
    // Register modules (skip dev-disabled ones)
    if (!isDevDisabled('navigation')) {
      this.registerModule('navigation', new NavigationModule(), { dependencies: [] });
    }
    if (!isDevDisabled('editHistory')) {
      this.registerModule('editHistory', new EditHistoryModule(), { dependencies: [] });
    }
    if (!isDevDisabled('compactView')) {
      this.registerModule('compactView', new CompactViewModule(), {
        dependencies: ['navigation'],
      });
    }
    if (!isDevDisabled('bookmarks')) {
      this.registerModule('bookmarks', new BookmarkModule(), { dependencies: [] });
    }
    if (!isDevDisabled('emojiMarkers')) {
      this.registerModule('emojiMarkers', new EmojiMarkerModule(), { dependencies: [] });
    }
    if (!isDevDisabled('sidebarCollapse')) {
      this.registerModule('sidebarCollapse', new SidebarCollapseModule(), { dependencies: [] });
    }
    if (!isDevDisabled('contentFolding')) {
      this.registerModule('contentFolding', new ContentFoldingModule(), { dependencies: [] });
    }
  }

  registerModule(name, module, metadata = {}) {
    if (this.modules.has(name)) {
      debugLog('navigation', `Module ${name} already registered`);
      return;
    }
    this.modules.set(name, module);
    this.moduleMetadata.set(name, metadata);
  }

  topologicalSort(modules) {
    const sorted = [];
    const visited = new Set();
    const visiting = new Set();

    const visit = name => {
      if (visited.has(name)) {
        return;
      }
      if (visiting.has(name)) {
        debugLog('navigation', `Circular dependency detected: ${name}`);
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

  async initializeModules() {
    const initOrder = this.topologicalSort(this.modules);

    for (const moduleName of initOrder) {
      const module = this.modules.get(moduleName);

      try {
        await module.init();
        debugLog('navigation', `${moduleName} initialized`);
      } catch (error) {
        console.error(`[App] Failed to initialize ${moduleName}:`, error);
        errorTracker.trackModuleError(moduleName, error, 'init');
        this.initState.failedModules.push({
          name: moduleName,
          error: error.message,
          timestamp: new Date().toISOString(),
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
    if (this.settingsUnsubscribe) {
      this.settingsUnsubscribe();
    }
    this.settingsUnsubscribe = settingsStore.subscribe(settings => {
      this.applySettingsToManagers(settings);
    });

    eventBus.on(Events.FEATURE_TOGGLED, ({ feature, enabled }) => {
      debugLog('navigation', `Feature ${feature} ${enabled ? 'enabled' : 'disabled'}`);
    });
  }

  setupChromeMessageListener() {
    const storeMap = {
      bookmarks: bookmarkStore,
      markers: markerStore,
      editHistory: editHistoryStore,
    };

    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.type === 'STORE_READ') {
        const store = storeMap[message.storeId];
        if (!store) {
          sendResponse({ error: `Unknown store: ${message.storeId}` });
          return true;
        }

        // Use export() if available for proper data formatting
        if (store.export) {
          store
            .export()
            .then(jsonString => {
              // Popup expects object (data), not string. Parse it here.
              try {
                const data = JSON.parse(jsonString);
                sendResponse({ data });
              } catch (e) {
                sendResponse({ error: 'Failed to parse export data: ' + e.message });
              }
            })
            .catch(err => sendResponse({ error: err.message }));
        } else {
          // Fallback to raw get()
          store.store
            .get()
            .then(data => sendResponse({ data }))
            .catch(err => sendResponse({ error: err.message }));
        }

        return true; // Keep channel open
      }

      if (message.type === 'STORE_WRITE') {
        const store = storeMap[message.storeId];
        if (!store) {
          sendResponse({ error: `Unknown store: ${message.storeId}` });
          return true;
        }

        // Use import() if available
        if (store.import) {
          // Popup sends data object, import expects JSON string
          const jsonString = JSON.stringify(message.data);
          store
            .import(jsonString)
            .then(async result => {
              if (result && result.success === false) {
                sendResponse({ error: result.error });
              } else {
                await this.refreshModulesForStore(message.storeId);
                sendResponse({ success: true });
              }
            })
            .catch(err => sendResponse({ error: err.message }));
        } else {
          // Fallback to raw set()
          store.store
            .set(message.data)
            .then(async () => {
              await this.refreshModulesForStore(message.storeId);
              sendResponse({ success: true });
            })
            .catch(err => sendResponse({ error: err.message }));
        }

        return true;
      }

      if (message.type === 'STORE_CLEAR') {
        const store = storeMap[message.storeId];
        if (!store) {
          sendResponse({ error: `Unknown store: ${message.storeId}` });
          return true;
        }

        // Wrapper should expose clear(), which calls store.clear()
        if (store.clear) {
          store
            .clear()
            .then(async () => {
              await this.refreshModulesForStore(message.storeId);
              sendResponse({ success: true });
            })
            .catch(err => sendResponse({ error: err.message }));
        } else {
          // Fallback to accessing inner store directly if wrapper missing clear
          if (store.store && store.store.clear) {
            store.store
              .clear()
              .then(async () => {
                await this.refreshModulesForStore(message.storeId);
                sendResponse({ success: true });
              })
              .catch(err => sendResponse({ error: err.message }));
          } else {
            sendResponse({ error: 'Store does not support clear' });
          }
        }

        return true;
      }

      if (message.type === 'SETTINGS_UPDATED') {
        Promise.resolve()
          .then(() => this.handleSettingsUpdate(message.settings))
          .then(() => sendResponse({ success: true }))
          .catch(err => sendResponse({ error: err.message }));
        return true;
      }

      if (message.type === 'DATA_IMPORTED' || message.type === 'DATA_CLEARED') {
        this.refreshAllDataModules()
          .then(() => sendResponse({ success: true }))
          .catch(err => sendResponse({ error: err.message }));
        return true;
      }

      if (message.type === 'CL_TEST_GET_STATE') {
        sendResponse({
          ready: this.initialized,
          initializing: this.initializing,
          initStatus: this.initState.status,
          activeModules: Array.from(this.modules.keys()),
          navigation: window.__navigationInterceptor?.getState?.() || null,
        });
        return false;
      }

      return false;
    });
  }

  enableDebugMode() {
    VisibilityManager.setDebugMode(true);
    KeyboardManager.setDebugMode(true);
    ObserverManager.setDebugMode(true);
    navigationInterceptor.setDebugMode(true);
    domReadyChecker.setDebugMode(true);
  }

  disableDebugMode() {
    VisibilityManager.setDebugMode(false);
    KeyboardManager.setDebugMode(false);
    ObserverManager.setDebugMode(false);
    navigationInterceptor.setDebugMode(false);
    domReadyChecker.setDebugMode(false);
  }

  async destroy() {
    if (!this.initialized || this.destroying) {
      return;
    }

    this.destroying = true;
    debugLog('navigation', 'Stopping extension...');

    // End session
    sessionTracker.end();

    if (this.restartDebounceTimer) {
      clearTimeout(this.restartDebounceTimer);
      this.restartDebounceTimer = null;
    }

    if (this.navigationUnsubscribe) {
      this.navigationUnsubscribe();
      this.navigationUnsubscribe = null;
    }

    if (this.settingsUnsubscribe) {
      this.settingsUnsubscribe();
      this.settingsUnsubscribe = null;
    }

    if (this.storeSyncUnsubscribe) {
      this.storeSyncUnsubscribe();
      this.storeSyncUnsubscribe = null;
    }

    for (const [name, module] of this.modules) {
      try {
        module.destroy();
      } catch (err) {
        console.error(`[App] Error destroying ${name}:`, err);
      }
    }

    this.modules.clear();

    // Destroy managers (each only once)
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

    // Destroy NavigationInterceptor
    try {
      const { default: navInterceptor } = await import('./core/NavigationInterceptor.js');
      if (navInterceptor && navInterceptor.destroy) {
        navInterceptor.destroy();
      }
    } catch (error) {
      console.error('[App] Error destroying NavigationInterceptor:', error);
    }

    // Stop Core Services
    panelManager.destroy();
    messageHub.stop();

    try {
      const { default: asyncManager } = await import('./managers/AsyncManager.js');
      const { default: domManager } = await import('./managers/DOMManager.js');
      const { default: settingsCache } = await import('./core/SettingsCache.js');

      asyncManager.destroy();
      domManager.destroy();
      settingsCache.clear();
    } catch (error) {
      console.error('[App] Error cleaning up managers:', error);
    }

    eventBus.clear();
    this.initialized = false;
    this.destroying = false;
  }

  async restart() {
    if (this.destroying) {
      debugLog('navigation', 'Cannot restart while destroying');
      return;
    }

    debugLog('navigation', 'Restarting...');
    await this.destroy();
    await domReadyChecker.waitForNavigationComplete({ maxWait: 2000 });
    await this.init();
  }

  healthCheck() {
    const navState = navigationInterceptor.getState();
    const visState = VisibilityManager.getStatus();

    return {
      status: this.initState.status,
      initialized: this.initialized,
      navigation: navState,
      visibility: visState,
      failedModules: this.initState.failedModules,
    };
  }

  /**
   * Debug command to verify extension architecture state.
   * Call via: window.claudeProductivity.verifyArchitecture()
   */
  verifyArchitecture() {
    console.log('[App] Architecture Verification\n');

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
      Navigation: 'claude-nav-container',
      Bookmarks: 'claude-bookmark-button',
      EmojiMarkers: 'claude-marker-button',
    };

    for (const [name, id] of Object.entries(buttonIds)) {
      const el = document.getElementById(id);
      if (el) {
        const s = getComputedStyle(el);
        const visible = s.display !== 'none' && s.visibility !== 'hidden';
        console.log(`  - ${name}: ${visible ? 'VISIBLE' : 'HIDDEN'}`);
      } else {
        console.log(`  - ${name}: NOT FOUND`);
      }
    }

    return { navState, visState };
  }
}

const app = new ClaudeProductivityApp();
window.claudeProductivity = app;
export default app;
