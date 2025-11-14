/**
 * VisibilityManager - Centralized visibility management for all UI elements
 * Prevents infinite loops and cascading mutations
 */

class VisibilityManager {
  constructor() {
    this.isConversationPage = false;
    this.lastPath = null;
    this.listeners = new Set();
    this.isChecking = false;
    this.debugMode = false;
    this.observer = null;

    // Start monitoring URL changes
    this.startMonitoring();
  }

  /**
   * Start monitoring URL changes
   * Enhanced with multiple detection methods for reliability
   */
  startMonitoring() {
    // Initial check
    this.checkPageType();

    // Method 1: Monitor History API changes
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function(...args) {
      originalPushState.apply(history, args);
      setTimeout(() => VisibilityManager.getInstance().checkPageType(), 50);
    };

    history.replaceState = function(...args) {
      originalReplaceState.apply(history, args);
      setTimeout(() => VisibilityManager.getInstance().checkPageType(), 50);
    };

    // Method 2: Monitor popstate for browser back/forward
    window.addEventListener('popstate', () => {
      setTimeout(() => this.checkPageType(), 50);
    });

    // Method 3: Enhanced DOM observation for soft navigation
    // Instead of polling, we'll use more targeted observers

    // Method 4: Observe DOM for main content changes (catches soft navigation)
    this.observeMainContent();
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
    const wasNewPage = this.lastPath && this.lastPath.includes('/new');

    // Check if we're on a conversation page
    // More specific: /chat/UUID or /project/UUID patterns
    this.isConversationPage = (path.includes('/chat/') || path.includes('/project/')) && !path.includes('/new');

    // Force notification if transitioning from /new to conversation
    const isTransitionFromNew = wasNewPage && this.isConversationPage;

    // Notify if state changed, first check, or specific transitions
    if (this.lastPath === null ||
        wasConversationPage !== this.isConversationPage ||
        path !== this.lastPath ||
        isTransitionFromNew) {

      if (this.debugMode || isTransitionFromNew) {
        console.log(`[VisibilityManager] Page type: ${this.isConversationPage ? 'CONVERSATION' : 'NON-CONVERSATION'} (${path})`);
        if (isTransitionFromNew) {
          console.log(`[VisibilityManager] Special transition: /new -> conversation detected`);
        }
      }

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
   * Observe main content area for changes
   * This catches soft navigation that doesn't trigger URL change events
   */
  observeMainContent() {
    // Clean up existing observer
    if (this.observer) {
      this.observer.disconnect();
    }

    // Create observer for main content changes and URL monitoring
    this.observer = new MutationObserver((mutations) => {
      // First check: URL might have changed (sidebar navigation)
      const currentPath = window.location.pathname;
      if (currentPath !== this.lastPath) {
        if (this.debugMode) {
          console.log(`[VisibilityManager] DOM observer detected URL change: ${this.lastPath} -> ${currentPath}`);
        }
        this.checkPageType();
        return;
      }

      // Second check: Significant DOM changes that might indicate navigation
      const hasSignificantChange = mutations.some(mutation => {
        // Look for specific Claude UI changes
        if (mutation.type === 'childList') {
          // Check for main content replacement
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              // Check for conversation/chat elements
              if (node.querySelector?.('[data-testid="messages"]') ||
                  node.classList?.contains('conversation-content') ||
                  node.tagName === 'MAIN') {
                return true;
              }
            }
          }

          // Large content changes
          return mutation.addedNodes.length > 5 ||
                 mutation.removedNodes.length > 5;
        }
        return false;
      });

      if (hasSignificantChange) {
        // Delay check to let DOM and URL settle
        setTimeout(() => {
          const newPath = window.location.pathname;
          if (newPath !== this.lastPath) {
            if (this.debugMode) {
              console.log(`[VisibilityManager] DOM change led to navigation: ${this.lastPath} -> ${newPath}`);
            }
            this.checkPageType();
          }
        }, 100);
      }
    });

    // Observe both body for comprehensive changes
    const targetNode = document.body;
    const config = {
      childList: true,
      subtree: true,
      attributes: false // Don't need attribute changes
    };

    this.observer.observe(targetNode, config);

    if (this.debugMode) {
      console.log('[VisibilityManager] DOM observer started');
    }
  }

  /**
   * Set debug mode
   */
  setDebugMode(enabled) {
    this.debugMode = enabled;
  }

  /**
   * Cleanup
   */
  destroy() {
    // Clear listeners
    this.listeners.clear();

    // Stop observer
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
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