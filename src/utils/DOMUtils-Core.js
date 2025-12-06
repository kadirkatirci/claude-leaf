/**
 * DOMUtils-Core - Core DOM utilities for Claude interface
 * 
 * v2.1.0 - Refactored to use NavigationInterceptor
 * 
 * Handles message finding, visibility checks, and page detection.
 * Uses NavigationInterceptor for consistent page type detection.
 */

import navigationInterceptor from '../core/NavigationInterceptor.js';

const DOMUtilsCore = {
  /**
   * Initialize - now minimal as NavigationInterceptor handles most setup
   */
  async init() {
    // Nothing to initialize - NavigationInterceptor is already running
    console.log('[DOMUtils-Core] Initialized with NavigationInterceptor');
  },

  /**
   * Check if we're on a conversation page
   * Uses NavigationInterceptor for centralized checking
   * @returns {boolean}
   */
  isOnConversationPage() {
    return navigationInterceptor.isConversationPage();
  },

  /**
   * Get current page type
   * @returns {string}
   */
  getPageType() {
    return navigationInterceptor.getState().pageType;
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
    let mainContent = document.querySelector('main') ||
                     document.querySelector('[role="main"]');

    // If no main, search entire document (Claude.ai sometimes removes main element)
    if (!mainContent) {
      mainContent = document.body;
    }

    // Try multiple selector strategies (Claude.ai's structure changes frequently)
    let messages = [];

    // Strategy 1: data-test-render-count (most reliable)
    messages = mainContent.querySelectorAll('[data-test-render-count]');

    // Strategy 2: data-testid selectors
    if (messages.length === 0) {
      messages = mainContent.querySelectorAll('[data-testid*="message"], [data-testid*="conversation-turn"]');
    }

    // Strategy 3: Look for message containers by class patterns
    if (messages.length === 0) {
      const allDivs = mainContent.querySelectorAll('div');
      messages = Array.from(allDivs).filter(div => {
        const depth = this.getElementDepth(div);
        if (depth < 3 || depth > 20) return false;

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

    // Strategy 4: Fallback - find message pairs
    if (messages.length === 0) {
      const chatMessages = mainContent.querySelectorAll('div[class*="group"], div[class*="message"]');
      if (chatMessages.length > 0) {
        messages = chatMessages;
      }
    }

    // Filter: Extract real messages
    return Array.from(messages).filter(msg => {
      // Skip sidebar elements
      if (msg.closest('nav')) return false;
      if (msg.closest('[aria-label="Sidebar"]')) return false;

      // Skip if it IS an input/textarea/button
      if (msg.tagName === 'TEXTAREA') return false;
      if (msg.tagName === 'INPUT') return false;
      if (msg.tagName === 'BUTTON') return false;

      // Skip chat input container
      if (msg.getAttribute('data-testid') === 'chat-input') return false;
      if (msg.getAttribute('data-testid') === 'prompt-input') return false;

      // Must have some content
      const text = msg.textContent?.trim() || '';
      if (text.length === 0) return false;

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

    return !!(
      element.querySelector('[data-testid="user-message"]') ||
      element.querySelector('[class*="user" i]') ||
      element.querySelector('[class*="human" i]') ||
      element.getAttribute('data-message-author') === 'user'
    );
  },

  /**
   * Check if element is visible in viewport
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
   * @param {HTMLElement[]} messages - Optional message array
   * @returns {number} Message index (-1 if none)
   */
  getCurrentVisibleMessageIndex(messages = null) {
    const msgArray = messages || this.findMessages();

    if (!msgArray || msgArray.length === 0) {
      return -1;
    }

    const viewportTop = window.scrollY;
    const viewportBottom = viewportTop + window.innerHeight;

    let closestIndex = 0;
    let minDistance = Infinity;

    for (let i = 0; i < msgArray.length; i++) {
      const msg = msgArray[i];
      const rect = msg.getBoundingClientRect();
      const msgTop = rect.top + window.scrollY;
      const msgBottom = msgTop + rect.height;

      // Skip messages completely out of viewport
      if (msgBottom < viewportTop || msgTop > viewportBottom) {
        continue;
      }

      // Find message closest to viewport top
      const distance = Math.abs(msgTop - viewportTop);
      if (distance < minDistance) {
        minDistance = distance;
        closestIndex = i;
      }
    }

    return closestIndex;
  }
};

export default DOMUtilsCore;
