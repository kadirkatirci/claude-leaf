/**
 * VisibilityManager - Centralized visibility management for all UI elements
 * 
 * v2.3.0 - Improved navigation event handling
 */

// Singleton instance
let instance = null;

class VisibilityManager {
  constructor() {
    if (instance) {
      return instance;
    }
    
    this.isConversationPageCached = false;
    this.lastPath = null;
    this.listeners = new Set();
    this.debugMode = false;
    this.navigationUnsubscribe = null;
    this.initialized = false;
    
    instance = this;
    
    // Debug access
    if (typeof window !== 'undefined') {
      window.__visibilityManager = this;
    }
    
    // Initialize
    this.initialize();
  }

  /**
   * Initialize - connect to NavigationInterceptor
   */
  initialize() {
    // Try to get NavigationInterceptor from window
    const tryConnect = () => {
      if (window.__navigationInterceptor) {
        this.connectToNavigationInterceptor(window.__navigationInterceptor);
        return true;
      }
      return false;
    };
    
    // Try immediately
    if (tryConnect()) {
      return;
    }
    
    // Fallback: initialize from URL and retry connection
    this.initializeFromUrl();
    
    // Keep trying to connect
    const retryInterval = setInterval(() => {
      if (tryConnect()) {
        clearInterval(retryInterval);
        this.log('Connected to NavigationInterceptor (delayed)');
      }
    }, 100);
    
    // Stop trying after 5 seconds
    setTimeout(() => clearInterval(retryInterval), 5000);
  }

  /**
   * Connect to NavigationInterceptor
   */
  connectToNavigationInterceptor(navigationInterceptor) {
    // Clean up existing subscription
    if (this.navigationUnsubscribe) {
      this.navigationUnsubscribe();
    }

    // Get initial state
    const state = navigationInterceptor.getState();
    this.isConversationPageCached = state.isConversationPage;
    this.lastPath = state.path;
    
    this.log('Initial state from NavigationInterceptor:', {
      isConversationPage: this.isConversationPageCached,
      path: this.lastPath
    });

    // Subscribe to navigation events
    this.navigationUnsubscribe = navigationInterceptor.onNavigate((event) => {
      this.handleNavigationEvent(event);
    });
    
    this.initialized = true;
    
    // Notify listeners of initial state
    this.notifyListeners();
  }

  /**
   * Initialize from URL directly (fallback)
   */
  initializeFromUrl() {
    const path = window.location.pathname;
    this.isConversationPageCached = this.checkConversationPath(path);
    this.lastPath = path;
    this.initialized = true;
    
    this.log('Initialized from URL (fallback):', {
      isConversationPage: this.isConversationPageCached,
      path: this.lastPath
    });
  }

  /**
   * Check if path is a conversation page
   */
  checkConversationPath(path) {
    if (!path) return false;
    
    // Not a conversation if it's /new
    if (path === '/new' || path.endsWith('/new')) {
      return false;
    }
    
    // Is a conversation if it matches /chat/{id}
    return /\/chat\/[^/]+/.test(path);
  }

  /**
   * Handle navigation events from NavigationInterceptor
   */
  handleNavigationEvent(event) {
    const wasConversationPage = this.isConversationPageCached;
    const wasPath = this.lastPath;

    // Update state
    this.isConversationPageCached = event.isConversationPage;
    this.lastPath = event.path;

    this.log('Navigation event received:', {
      type: event.type,
      from: `${wasPath} (conv: ${wasConversationPage})`,
      to: `${event.path} (conv: ${event.isConversationPage})`
    });

    // Always notify on path change or conversation state change
    const stateChanged = wasConversationPage !== this.isConversationPageCached;
    const pathChanged = wasPath !== this.lastPath;

    if (stateChanged || pathChanged) {
      this.log('State changed, notifying listeners');
      // Use requestAnimationFrame to ensure DOM is ready before notifying
      requestAnimationFrame(() => {
        this.notifyListeners();
      });
    }
  }

  /**
   * Register a listener for visibility changes
   */
  onVisibilityChange(callback) {
    this.listeners.add(callback);

    this.log(`Listener added, total: ${this.listeners.size}`);

    // Immediately call with current state
    try {
      callback(this.isConversationPageCached);
    } catch (error) {
      console.error('[VisibilityManager] Error in immediate callback:', error);
    }

    // Return unsubscribe function
    return () => {
      this.listeners.delete(callback);
      this.log(`Listener removed, total: ${this.listeners.size}`);
    };
  }

  /**
   * Notify all listeners
   */
  notifyListeners() {
    this.log(`Notifying ${this.listeners.size} listeners, isConversation: ${this.isConversationPageCached}`);

    this.listeners.forEach(callback => {
      try {
        callback(this.isConversationPageCached);
      } catch (error) {
        console.error('[VisibilityManager] Error in listener callback:', error);
      }
    });
  }

  /**
   * Get current conversation page status
   */
  isOnConversationPage() {
    // Always check live if NavigationInterceptor available
    if (window.__navigationInterceptor) {
      return window.__navigationInterceptor.getState().isConversationPage;
    }
    return this.isConversationPageCached;
  }

  /**
   * Force refresh state
   */
  refresh() {
    const wasConversationPage = this.isConversationPageCached;
    
    if (window.__navigationInterceptor) {
      const state = window.__navigationInterceptor.getState();
      this.isConversationPageCached = state.isConversationPage;
      this.lastPath = state.path;
    } else {
      const path = window.location.pathname;
      this.isConversationPageCached = this.checkConversationPath(path);
      this.lastPath = path;
    }
    
    this.log('Refreshed:', {
      isConversationPage: this.isConversationPageCached,
      path: this.lastPath
    });
    
    // Always notify on refresh
    this.notifyListeners();
  }

  /**
   * Update UI element visibility
   */
  setElementVisibility(element, visible) {
    if (!element) return;

    if (visible) {
      const displayValue = element.dataset.originalDisplay || 'flex';
      element.style.display = displayValue;
      element.style.visibility = 'visible';
      element.style.opacity = element.dataset.originalOpacity || '1';
      element.style.pointerEvents = 'auto';
    } else {
      if (!element.dataset.originalOpacity && element.style.opacity) {
        element.dataset.originalOpacity = element.style.opacity;
      }
      if (!element.dataset.originalDisplay && element.style.display && element.style.display !== 'none') {
        element.dataset.originalDisplay = element.style.display;
      }

      element.style.display = 'none';
      element.style.visibility = 'hidden';
      element.style.opacity = '0';
      element.style.pointerEvents = 'none';
    }
  }

  /**
   * Batch update multiple elements
   */
  batchUpdateVisibility(updates) {
    requestAnimationFrame(() => {
      updates.forEach(({ element, visible }) => {
        this.setElementVisibility(element, visible);
      });
    });
  }

  setDebugMode(enabled) {
    this.debugMode = enabled;
    if (enabled) {
      console.log('[VisibilityManager] Debug mode enabled');
      console.log('[VisibilityManager] Status:', this.getStatus());
    }
  }

  log(...args) {
    if (this.debugMode) {
      console.log('[VisibilityManager]', ...args);
    }
  }

  getStatus() {
    return {
      initialized: this.initialized,
      isConversationPage: this.isConversationPageCached,
      path: this.lastPath,
      listenerCount: this.listeners.size,
      hasNavigationSubscription: !!this.navigationUnsubscribe,
      liveCheck: this.isOnConversationPage()
    };
  }

  destroy() {
    this.listeners.clear();

    if (this.navigationUnsubscribe) {
      this.navigationUnsubscribe();
      this.navigationUnsubscribe = null;
    }

    // Reset state
    this.initialized = false;
    this.isConversationPageCached = false;
    this.lastPath = null;

    // Clear singleton instance for proper re-initialization
    instance = null;

    this.log('Destroyed');
  }

  static getInstance() {
    if (!instance) {
      instance = new VisibilityManager();
    }
    return instance;
  }

  /**
   * Check if instance is valid (not destroyed)
   */
  static isValid() {
    return instance !== null && instance.initialized;
  }
}

// Export singleton
export default VisibilityManager.getInstance();
