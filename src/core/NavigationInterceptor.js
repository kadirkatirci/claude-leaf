/**
 * NavigationInterceptor - Unified SPA Navigation Management
 * 
 * v2.3.0 - Robust interception that survives other overrides
 * 
 * Uses multiple strategies to detect navigation:
 * 1. History API interception with protection
 * 2. URL polling as fallback
 * 3. Click event monitoring on links
 */

// Singleton instance
let instance = null;

// Navigation event types
export const NavigationEventType = {
  PUSH_STATE: 'pushState',
  REPLACE_STATE: 'replaceState',
  POP_STATE: 'popState',
  HASH_CHANGE: 'hashChange',
  URL_CHANGE: 'urlChange',
  INITIAL: 'initial'
};

// Page types
export const PageType = {
  NEW_CHAT: 'new_chat',
  CONVERSATION: 'conversation',
  PROJECT: 'project',
  PROJECT_CHAT: 'project_chat',
  SETTINGS: 'settings',
  OTHER: 'other'
};

class NavigationInterceptor {
  constructor() {
    if (instance) {
      return instance;
    }
    
    this.listeners = new Set();
    this.currentUrl = window.location.href;
    this.currentPath = window.location.pathname;
    this.currentPageType = this.detectPageType(this.currentPath);
    this.debugMode = false;
    this.intercepted = false;
    this.urlCheckInterval = null;
    
    instance = this;
    
    // Auto-initialize
    this.intercept();
    
    // Debug access
    if (typeof window !== 'undefined') {
      window.__navigationInterceptor = this;
    }
  }
  
  static getInstance() {
    if (!instance) {
      new NavigationInterceptor();
    }
    return instance;
  }
  
  /**
   * Intercept navigation using multiple strategies
   */
  intercept() {
    if (this.intercepted) {
      this.log('Already intercepted, skipping');
      return;
    }
    
    this.log('Setting up navigation interception...');
    
    // Strategy 1: Wrap History API methods
    this.wrapHistoryMethods();
    
    // Strategy 2: Listen to popstate/hashchange
    this.setupEventListeners();
    
    // Strategy 3: URL polling as reliable fallback
    this.startUrlPolling();
    
    // Strategy 4: Monitor link clicks for early detection
    this.setupLinkClickMonitor();
    
    this.intercepted = true;
    this.log('Navigation interception active');
  }
  
  /**
   * Wrap history methods with our handlers
   * Re-wraps periodically to survive other overrides
   */
  wrapHistoryMethods() {
    const self = this;
    
    // Store truly original methods if not already stored globally
    if (!window.__originalHistoryPushState) {
      window.__originalHistoryPushState = history.pushState.bind(history);
      window.__originalHistoryReplaceState = history.replaceState.bind(history);
    }
    
    const wrapMethod = (methodName, original) => {
      return function(state, title, url) {
        // Call original
        const result = original.call(history, state, title, url);
        
        // Notify our interceptor
        self.log(`${methodName} called:`, url);
        
        // Use setTimeout to let the URL actually change first
        setTimeout(() => {
          self.handleNavigation(
            methodName === 'pushState' ? NavigationEventType.PUSH_STATE : NavigationEventType.REPLACE_STATE,
            url
          );
        }, 0);
        
        return result;
      };
    };
    
    // Initial wrap
    history.pushState = wrapMethod('pushState', window.__originalHistoryPushState);
    history.replaceState = wrapMethod('replaceState', window.__originalHistoryReplaceState);
    
    // Re-wrap periodically to survive other scripts overriding
    setInterval(() => {
      const currentPush = history.pushState.toString();
      const currentReplace = history.replaceState.toString();
      
      // Check if our wrapper is still in place (has our log call)
      if (!currentPush.includes('handleNavigation') && !currentPush.includes('__navigationInterceptor')) {
        this.log('pushState was overridden, re-wrapping...');
        history.pushState = wrapMethod('pushState', history.pushState.bind(history));
      }
      if (!currentReplace.includes('handleNavigation') && !currentReplace.includes('__navigationInterceptor')) {
        this.log('replaceState was overridden, re-wrapping...');
        history.replaceState = wrapMethod('replaceState', history.replaceState.bind(history));
      }
    }, 1000);
  }
  
  /**
   * Setup popstate and hashchange listeners
   */
  setupEventListeners() {
    window.addEventListener('popstate', () => {
      this.log('popstate event');
      setTimeout(() => {
        this.handleNavigation(NavigationEventType.POP_STATE);
      }, 0);
    });
    
    window.addEventListener('hashchange', () => {
      this.log('hashchange event');
      setTimeout(() => {
        this.handleNavigation(NavigationEventType.HASH_CHANGE);
      }, 0);
    });
  }
  
  /**
   * URL polling - most reliable fallback
   * Catches any navigation that other methods miss
   */
  startUrlPolling() {
    let lastUrl = window.location.href;
    let lastPath = window.location.pathname;
    
    this.urlCheckInterval = setInterval(() => {
      const currentUrl = window.location.href;
      const currentPath = window.location.pathname;
      
      if (currentPath !== lastPath) {
        this.log('URL change detected via polling:', lastPath, '→', currentPath);
        
        const previousPath = lastPath;
        lastUrl = currentUrl;
        lastPath = currentPath;
        
        // Only emit if we haven't already processed this change
        if (this.currentPath !== currentPath) {
          this.handleNavigation(NavigationEventType.URL_CHANGE, currentUrl, previousPath);
        }
      }
    }, 100); // Check every 100ms
  }
  
  /**
   * Monitor link clicks for early navigation detection
   */
  setupLinkClickMonitor() {
    document.addEventListener('click', (e) => {
      const link = e.target.closest('a[href]');
      if (!link) return;
      
      const href = link.getAttribute('href');
      if (!href) return;
      
      // Only care about internal navigation links
      if (href.startsWith('/chat/') || href.startsWith('/project/') || href === '/new') {
        this.log('Navigation link clicked:', href);
        // The actual navigation will be caught by other methods
        // This is just for logging/debugging
      }
    }, true); // Capture phase
  }
  
  /**
   * Handle navigation event
   */
  handleNavigation(type, url = null, previousPath = null) {
    const newUrl = url ? new URL(url, window.location.origin).href : window.location.href;
    const newPath = url ? new URL(url, window.location.origin).pathname : window.location.pathname;
    
    // Skip if path hasn't actually changed
    if (newPath === this.currentPath && type !== NavigationEventType.INITIAL) {
      this.log('Path unchanged, skipping:', newPath);
      return;
    }
    
    // Capture previous state
    const prevUrl = this.currentUrl;
    const prevPath = previousPath || this.currentPath;
    const prevPageType = this.currentPageType;
    
    // Update current state
    this.currentUrl = window.location.href;
    this.currentPath = window.location.pathname;
    this.currentPageType = this.detectPageType(this.currentPath);
    
    // Create event
    const event = {
      type,
      url: this.currentUrl,
      path: this.currentPath,
      pageType: this.currentPageType,
      previousUrl: prevUrl,
      previousPath: prevPath,
      previousPageType: prevPageType,
      isConversationPage: this.isConversationPage(),
      wasConversationPage: this.isConversationPageByPath(prevPath),
      isNewChatPage: this.currentPageType === PageType.NEW_CHAT,
      wasNewChatPage: prevPageType === PageType.NEW_CHAT,
      timestamp: Date.now()
    };
    
    this.log('Navigation event:', event.previousPath, '→', event.path, `(${event.type})`);
    
    // Notify listeners
    this.notifyListeners(event);
  }
  
  /**
   * Detect page type from path
   */
  detectPageType(path) {
    if (!path) return PageType.OTHER;
    
    if (path === '/new' || path.endsWith('/new')) {
      return PageType.NEW_CHAT;
    }
    
    if (/\/project\/[^/]+\/chat\/[^/]+/.test(path)) {
      return PageType.PROJECT_CHAT;
    }
    
    if (/\/project\/[^/]+/.test(path) && !path.includes('/chat/')) {
      return PageType.PROJECT;
    }
    
    if (/\/chat\/[^/]+/.test(path)) {
      return PageType.CONVERSATION;
    }
    
    if (path.startsWith('/settings')) {
      return PageType.SETTINGS;
    }
    
    return PageType.OTHER;
  }
  
  isConversationPage() {
    return this.isConversationPageByType(this.currentPageType);
  }
  
  isConversationPageByType(pageType) {
    return pageType === PageType.CONVERSATION || pageType === PageType.PROJECT_CHAT;
  }
  
  isConversationPageByPath(path) {
    return this.isConversationPageByType(this.detectPageType(path));
  }
  
  isNewChatPage() {
    return this.currentPageType === PageType.NEW_CHAT;
  }
  
  /**
   * Subscribe to navigation events
   */
  onNavigate(callback) {
    this.listeners.add(callback);
    this.log(`Listener added, total: ${this.listeners.size}`);
    
    return () => {
      this.listeners.delete(callback);
      this.log(`Listener removed, total: ${this.listeners.size}`);
    };
  }
  
  /**
   * Notify all listeners
   */
  notifyListeners(event) {
    this.log(`Notifying ${this.listeners.size} listeners`);
    
    this.listeners.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error('[NavigationInterceptor] Listener error:', error);
      }
    });
  }
  
  /**
   * Get current state
   */
  getState() {
    // Always fresh from window.location
    const path = window.location.pathname;
    const pageType = this.detectPageType(path);
    
    return {
      url: window.location.href,
      path: path,
      pageType: pageType,
      isConversationPage: this.isConversationPageByType(pageType),
      isNewChatPage: pageType === PageType.NEW_CHAT
    };
  }
  
  getConversationId() {
    if (!this.isConversationPage()) return null;
    const match = this.currentPath.match(/\/chat\/([^/]+)/);
    return match ? match[1] : null;
  }
  
  getProjectId() {
    const match = this.currentPath.match(/\/project\/([^/]+)/);
    return match ? match[1] : null;
  }
  
  /**
   * Force emit current state
   */
  forceEmit() {
    this.handleNavigation(NavigationEventType.INITIAL);
  }
  
  setDebugMode(enabled) {
    this.debugMode = enabled;
    console.log(`[NavigationInterceptor] Debug mode ${enabled ? 'enabled' : 'disabled'}`);
  }
  
  log(...args) {
    if (this.debugMode) {
      console.log('[NavigationInterceptor]', ...args);
    }
  }
  
  getListenerCount() {
    return this.listeners.size;
  }
  
  destroy() {
    if (this.urlCheckInterval) {
      clearInterval(this.urlCheckInterval);
      this.urlCheckInterval = null;
    }
    this.listeners.clear();
    this.log('Destroyed');
  }
}

// Create and export singleton
const navigationInterceptor = NavigationInterceptor.getInstance();

export default navigationInterceptor;
export { NavigationInterceptor, navigationInterceptor };
