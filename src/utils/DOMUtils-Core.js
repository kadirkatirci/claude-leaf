/**
 * DOMUtils-Core - Core DOM utilities for Claude interface
 * Handles message finding, visibility checks, and page detection
 */

// Import VisibilityManager for centralized page checking
let visibilityManager = null;

const DOMUtilsCore = {
  /**
   * Initialize with VisibilityManager
   * Returns a promise to ensure VisibilityManager is loaded before use
   */
  async init() {
    // Lazy load to avoid circular dependency
    if (!visibilityManager) {
      try {
        const module = await import('./VisibilityManager.js');
        visibilityManager = module.default;
      } catch (error) {
        console.error('Failed to load VisibilityManager:', error);
      }
    }
  },

  /**
   * Check if we're on a conversation page
   * Uses VisibilityManager for centralized checking
   * @returns {boolean}
   */
  isOnConversationPage() {
    // Use VisibilityManager if available, otherwise fallback to direct check
    if (visibilityManager) {
      return visibilityManager.isOnConversationPage();
    }

    // Fallback to direct check
    const path = window.location.pathname;
    return (path.includes('/chat/') || path.includes('/project/')) && !path.includes('/new');
  },

  /**
   * Find actual messages (excluding sidebar and UI elements)
   * @returns {HTMLElement[]} Message elements
   */
  findActualMessages() {
    // First verify we're on a conversation page
    if (!this.isOnConversationPage()) {
      return [];
    }

    // Find main content area (excluding sidebar)
    // Strategy 1: Look for main element
    let mainContent = document.querySelector('main') ||
                     document.querySelector('[role="main"]');

    // Strategy 2: If no main, search entire document (Claude.ai removed main element)
    if (!mainContent) {
      mainContent = document.body;
    }

    // Try multiple selector strategies (Claude.ai's structure changes frequently)
    let messages = [];

    // Strategy 1: Old selector (for backward compatibility)
    messages = mainContent.querySelectorAll('[data-test-render-count]');

    // Strategy 2: New selector based on data-testid
    if (messages.length === 0) {
      messages = mainContent.querySelectorAll('[data-testid*="message"], [data-testid*="conversation-turn"]');
    }

    // Strategy 3: Look for message containers by class patterns
    if (messages.length === 0) {
      // Find divs that contain either user messages or assistant responses
      const allDivs = mainContent.querySelectorAll('div');
      messages = Array.from(allDivs).filter(div => {
        // Must have reasonable depth (not too shallow, not too deep)
        const depth = this.getElementDepth(div);
        if (depth < 3 || depth > 20) return false;

        // Check for message indicators
        const hasUserIndicator = div.querySelector('[data-testid="user-message"]') ||
                                 div.querySelector('.font-user-message') ||
                                 div.textContent.trim().length > 0 && div.querySelector('p, pre, code');

        const hasAssistantIndicator = div.querySelector('[data-is-streaming]') ||
                                     div.querySelector('.font-claude-message') ||
                                     div.querySelector('.font-claude-response') ||
                                     div.querySelector('[class*="claude"]');

        return hasUserIndicator || hasAssistantIndicator;
      });
    }

    // Strategy 4: Fallback - find message pairs (user + assistant pattern)
    if (messages.length === 0) {
      // Look for the typical chat pattern: alternating messages
      const chatMessages = mainContent.querySelectorAll('div[class*="group"], div[class*="message"]');
      if (chatMessages.length > 0) {
        messages = chatMessages;
      }
    }

    // Filter: Extract real messages (simplified - trust data-test-render-count selector)
    return Array.from(messages).filter(msg => {
      // ONLY exclude obvious non-message elements

      // Skip sidebar elements
      if (msg.closest('nav')) return false;
      if (msg.closest('[aria-label="Sidebar"]')) return false;

      // Skip if it IS an input/textarea (not just contains one)
      if (msg.tagName === 'TEXTAREA') return false;
      if (msg.tagName === 'INPUT') return false;
      if (msg.tagName === 'BUTTON') return false;

      // Skip if it's the chat input container (but not message containers that contain chat input)
      if (msg.getAttribute('data-testid') === 'chat-input') return false;
      if (msg.getAttribute('data-testid') === 'prompt-input') return false;

      // Must have some content
      const text = msg.textContent?.trim() || '';
      if (text.length < 5) return false;

      // If it has data-test-render-count and passed above checks, it's a message
      return true;
    });
  },

  /**
   * Helper: Get element depth in DOM tree
   */
  getElementDepth(element) {
    let depth = 0;
    let current = element;
    while (current.parentElement) {
      depth++;
      current = current.parentElement;
    }
    return depth;
  },

  /**
   * Find Claude messages (backward compatibility)
   * @returns {HTMLElement[]} Message elements
   */
  findMessages() {
    // Use new function - backward compatibility maintained
    return this.findActualMessages();
  },

  /**
   * Get main chat container
   * @returns {HTMLElement|null}
   */
  getChatContainer() {
    return document.querySelector('main') ||
           document.querySelector('[role="main"]') ||
           document.querySelector('#chat-container') ||
           document.body;
  },

  /**
   * Check if element is user message
   * @param {HTMLElement} element
   * @returns {boolean}
   */
  isUserMessage(element) {
    if (!element) return false;

    // Check for user message indicators
    return !!(
      element.querySelector('[data-testid="user-message"]') ||
      element.querySelector('[class*="user" i]') ||
      element.querySelector('[class*="human" i]') ||
      element.getAttribute('data-message-author') === 'user'
    );
  },

  /**
   * Check if element is visible
   * @param {HTMLElement} element
   * @returns {boolean}
   */
  isElementVisible(element) {
    if (!element) return false;

    const rect = element.getBoundingClientRect();
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
  },

  /**
   * Check if element is partially visible
   * @param {HTMLElement} element
   * @returns {boolean}
   */
  isElementPartiallyVisible(element) {
    if (!element) return false;

    const rect = element.getBoundingClientRect();
    const windowHeight = window.innerHeight || document.documentElement.clientHeight;
    const windowWidth = window.innerWidth || document.documentElement.clientWidth;

    const verticalVisible = rect.top < windowHeight && rect.bottom > 0;
    const horizontalVisible = rect.left < windowWidth && rect.right > 0;

    return verticalVisible && horizontalVisible;
  },

  /**
   * Smooth scroll to element
   * @param {HTMLElement} element
   * @param {string} block - 'start' | 'center' | 'end'
   */
  scrollToElement(element, block = 'center') {
    if (!element) return;

    element.scrollIntoView({
      behavior: 'smooth',
      block: block,
      inline: 'nearest'
    });
  },

  /**
   * Get current visible message index
   * @returns {number} Message index
   */
  getCurrentVisibleMessageIndex(messages = null) {
    // Use provided messages array or find them
    const msgArray = messages || this.findMessages();

    // Return -1 if no messages
    if (!msgArray || msgArray.length === 0) {
      return -1;
    }

    // Find the topmost visible message in viewport
    // We check which message's top is closest to viewport top (within viewport)
    const viewportTop = window.scrollY;
    const viewportBottom = viewportTop + window.innerHeight;

    let closestIndex = 0;
    let minDistance = Infinity;

    for (let i = 0; i < msgArray.length; i++) {
      const msg = msgArray[i];
      const rect = msg.getBoundingClientRect();
      const msgTop = rect.top + window.scrollY;
      const msgBottom = msgTop + rect.height;

      // Skip messages that are completely out of viewport
      if (msgBottom < viewportTop || msgTop > viewportBottom) {
        continue;
      }

      // Calculate distance from message top to viewport top
      const distance = Math.abs(msgTop - viewportTop);

      // Find the message closest to viewport top
      if (distance < minDistance) {
        minDistance = distance;
        closestIndex = i;
      }
    }

    return closestIndex;
  }
};

export default DOMUtilsCore;