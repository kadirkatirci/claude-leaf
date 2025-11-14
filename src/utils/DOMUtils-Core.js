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
    const mainContent = document.querySelector('main') ||
                       document.querySelector('[role="main"]') ||
                       document.querySelector('.flex-1.overflow-hidden');

    if (!mainContent) return [];

    // Find messages only within main content
    const messages = mainContent.querySelectorAll('[data-test-render-count]');

    // Filter: Extract real messages
    return Array.from(messages).filter(msg => {
      // Sidebar check - not in nav or sidebar
      if (msg.closest('nav')) return false;
      if (msg.closest('[aria-label="Sidebar"]')) return false;
      if (msg.closest('.sidebar')) return false;
      if (msg.closest('[data-testid="sidebar"]')) return false;
      if (msg.closest('[data-testid="pin-sidebar-toggle"]')) return false;

      // Input field check - not chat input
      if (msg.closest('[data-testid="chat-input"]')) return false;
      if (msg.closest('[aria-label="Write your prompt to Claude"]')) return false;

      // Real message check - is it user or assistant message?
      const hasUserMessage = msg.querySelector('[data-testid="user-message"]');
      const hasAssistantMessage = msg.querySelector('[data-is-streaming]');
      const hasClaudeResponse = msg.querySelector('.font-claude-response');

      return hasUserMessage || hasAssistantMessage || hasClaudeResponse;
    });
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

    const scrollPosition = window.scrollY + window.innerHeight / 2;

    // Check which message contains the viewport center
    for (let i = 0; i < msgArray.length; i++) {
      const msg = msgArray[i];
      const rect = msg.getBoundingClientRect();
      const elementTop = rect.top + window.scrollY;
      const elementBottom = elementTop + rect.height;

      if (scrollPosition >= elementTop && scrollPosition <= elementBottom) {
        return i;
      }
    }

    // Find closest message if none contain the center
    let closest = 0;
    let minDistance = Infinity;

    for (let i = 0; i < msgArray.length; i++) {
      const msg = msgArray[i];
      const rect = msg.getBoundingClientRect();
      const elementTop = rect.top + window.scrollY;
      const distance = Math.abs(scrollPosition - elementTop);

      if (distance < minDistance) {
        minDistance = distance;
        closest = i;
      }
    }

    return closest;
  }
};

export default DOMUtilsCore;