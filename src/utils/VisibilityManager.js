/**
 * VisibilityManager - Centralized visibility management for all UI elements
 * Prevents infinite loops and cascading mutations
 */

class VisibilityManager {
  constructor() {
    this.isConversationPage = false;
    this.lastPath = null;
    this.listeners = new Set();
    this.checkInterval = null;
    this.isChecking = false;

    // Start monitoring URL changes
    this.startMonitoring();
  }

  /**
   * Start monitoring URL changes
   */
  startMonitoring() {
    // Initial check
    this.checkPageType();

    // Monitor URL changes with popstate
    window.addEventListener('popstate', () => this.checkPageType());

    // Also monitor with interval as Claude is SPA
    this.checkInterval = setInterval(() => {
      if (window.location.pathname !== this.lastPath) {
        this.checkPageType();
      }
    }, 500);

    // Monitor pushState/replaceState
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function(...args) {
      originalPushState.apply(history, args);
      setTimeout(() => VisibilityManager.getInstance().checkPageType(), 0);
    };

    history.replaceState = function(...args) {
      originalReplaceState.apply(history, args);
      setTimeout(() => VisibilityManager.getInstance().checkPageType(), 0);
    };
  }

  /**
   * Check current page type and notify listeners if changed
   */
  checkPageType() {
    // Prevent recursive checks
    if (this.isChecking) return;
    this.isChecking = true;

    const path = window.location.pathname;
    const wasConversationPage = this.isConversationPage;

    // Check if we're on a conversation page
    this.isConversationPage = (path.includes('/chat/') || path.includes('/project/')) && !path.includes('/new');

    // Only notify if state changed or first check
    if (this.lastPath === null || wasConversationPage !== this.isConversationPage || path !== this.lastPath) {
      console.log(`[VisibilityManager] Page type changed: ${this.isConversationPage ? 'CONVERSATION' : 'NON-CONVERSATION'} (${path})`);
      this.lastPath = path;
      this.notifyListeners();
    }

    this.isChecking = false;
  }

  /**
   * Register a listener for visibility changes
   * @param {Function} callback - Function to call with (isConversationPage) parameter
   * @returns {Function} Unsubscribe function
   */
  onVisibilityChange(callback) {
    this.listeners.add(callback);

    // Immediately call with current state
    callback(this.isConversationPage);

    // Return unsubscribe function
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Notify all listeners of visibility change
   */
  notifyListeners() {
    this.listeners.forEach(callback => {
      try {
        callback(this.isConversationPage);
      } catch (error) {
        console.error('[VisibilityManager] Error in listener callback:', error);
      }
    });
  }

  /**
   * Get current conversation page status
   * @returns {boolean}
   */
  isOnConversationPage() {
    return this.isConversationPage;
  }

  /**
   * Update UI element visibility without triggering mutations
   * Uses visibility instead of display to avoid layout shifts
   * @param {HTMLElement} element
   * @param {boolean} visible
   */
  setElementVisibility(element, visible) {
    if (!element) return;

    // Use visibility and opacity for smoother transitions
    // This doesn't trigger layout recalculations like display does
    if (visible) {
      element.style.visibility = 'visible';
      element.style.opacity = element.dataset.originalOpacity || '1';
      element.style.pointerEvents = 'auto';
    } else {
      // Store original opacity
      if (!element.dataset.originalOpacity) {
        element.dataset.originalOpacity = element.style.opacity || '1';
      }
      element.style.visibility = 'hidden';
      element.style.opacity = '0';
      element.style.pointerEvents = 'none';
    }
  }

  /**
   * Batch update multiple elements
   * @param {Array<{element: HTMLElement, visible: boolean}>} updates
   */
  batchUpdateVisibility(updates) {
    // Use requestAnimationFrame to batch DOM updates
    requestAnimationFrame(() => {
      updates.forEach(({ element, visible }) => {
        this.setElementVisibility(element, visible);
      });
    });
  }

  /**
   * Cleanup
   */
  destroy() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.listeners.clear();
  }

  /**
   * Singleton instance
   */
  static instance = null;

  static getInstance() {
    if (!VisibilityManager.instance) {
      VisibilityManager.instance = new VisibilityManager();
    }
    return VisibilityManager.instance;
  }
}

// Export singleton instance
export default VisibilityManager.getInstance();