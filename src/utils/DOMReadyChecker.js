/**
 * DOMReadyChecker - Intelligent DOM Ready Detection
 *
 * Provides page-type aware DOM ready checking with exponential backoff.
 * Different page types have different "ready" criteria.
 *
 * Usage:
 *   import DOMReadyChecker from './utils/DOMReadyChecker.js';
 *
 *   // Wait for conversation page to be ready
 *   const isReady = await DOMReadyChecker.waitForReady();
 *
 *   // Wait with custom options
 *   const isReady = await DOMReadyChecker.waitForReady({
 *     maxWait: 10000,
 *     requireMessages: true
 *   });
 */

import navigationInterceptor, { PageType } from '../core/NavigationInterceptor.js';

// Ready criteria for different page types
const ReadyCriteria = {
  // Conversation page: need messages container
  [PageType.CONVERSATION]: {
    selectors: [
      '[data-testid="messages"]',
      '[data-test-render-count]',
      '[data-testid="conversation-turn"]',
    ],
    fallbackSelectors: ['main', '[role="main"]'],
    minWait: 100,
    description: 'conversation messages',
  },

  // Project chat: same as conversation
  [PageType.PROJECT_CHAT]: {
    selectors: [
      '[data-testid="messages"]',
      '[data-test-render-count]',
      '[data-testid="conversation-turn"]',
    ],
    fallbackSelectors: ['main', '[role="main"]'],
    minWait: 100,
    description: 'project chat messages',
  },

  // New chat page: just need the input area
  [PageType.NEW_CHAT]: {
    selectors: [
      '[data-testid="chat-input"]',
      '[data-testid="prompt-input"]',
      'textarea[placeholder]',
      'main',
    ],
    fallbackSelectors: ['main', '[role="main"]'],
    minWait: 50,
    description: 'new chat input',
  },

  // Project page: need project content
  [PageType.PROJECT]: {
    selectors: ['[data-testid="project-content"]', 'main'],
    fallbackSelectors: ['main', '[role="main"]'],
    minWait: 50,
    description: 'project content',
  },

  // Settings page
  [PageType.SETTINGS]: {
    selectors: ['main', '[role="main"]'],
    fallbackSelectors: ['body'],
    minWait: 50,
    description: 'settings content',
  },

  // Other pages
  [PageType.OTHER]: {
    selectors: ['main', '[role="main"]'],
    fallbackSelectors: ['body'],
    minWait: 50,
    description: 'page content',
  },
};

class DOMReadyChecker {
  constructor() {
    this.debugMode = false;
    this.checkCount = 0;

    // Debug access
    if (typeof window !== 'undefined') {
      window.__domReadyChecker = this;
    }
  }

  /**
   * Wait for DOM to be ready based on current page type
   * @param {Object} options - Configuration options
   * @returns {Promise<boolean>} True if ready, false if timeout
   */
  async waitForReady(options = {}) {
    const {
      maxWait = 5000, // Maximum wait time in ms
      initialDelay = 50, // Initial delay between checks
      maxDelay = 1000, // Maximum delay between checks (exponential backoff cap)
      backoffFactor = 1.5, // Exponential backoff multiplier
      requireMessages = false, // Require actual messages to be present
      pageType = null, // Override page type detection
    } = options;

    const startTime = Date.now();
    const detectedPageType = pageType || navigationInterceptor.getState().pageType;
    const criteria = ReadyCriteria[detectedPageType] || ReadyCriteria[PageType.OTHER];

    this.log(`Waiting for ${criteria.description} (pageType: ${detectedPageType})`);

    let delay = Math.max(initialDelay, criteria.minWait);
    let attempt = 0;

    while (Date.now() - startTime < maxWait) {
      attempt++;
      this.checkCount++;

      const result = this.checkReady(criteria, requireMessages);

      if (result.ready) {
        this.log(
          `Ready after ${attempt} attempts, ${Date.now() - startTime}ms (found: ${result.foundSelector})`
        );
        return true;
      }

      // Exponential backoff
      await this.sleep(delay);
      delay = Math.min(delay * backoffFactor, maxDelay);
    }

    this.log(`Timeout after ${attempt} attempts, ${maxWait}ms`);
    return false;
  }

  /**
   * Wait specifically for conversation page to be ready
   * More strict criteria than generic waitForReady
   */
  async waitForConversationReady(options = {}) {
    const { maxWait = 5000, requireMessages = false } = options;

    const startTime = Date.now();
    let delay = 100;
    let attempt = 0;

    this.log('Waiting for conversation to be ready...');

    while (Date.now() - startTime < maxWait) {
      attempt++;

      // First check: Are we actually on a conversation page?
      const state = navigationInterceptor.getState();

      if (!state.isConversationPage) {
        // Not on conversation page, wait and check again
        // (URL might update before content)
        await this.sleep(delay);
        delay = Math.min(delay * 1.5, 500);
        continue;
      }

      // Second check: Is the messages container present?
      const messagesContainer = this.findElement([
        '[data-testid="messages"]',
        '[data-test-render-count]',
      ]);

      if (!messagesContainer) {
        await this.sleep(delay);
        delay = Math.min(delay * 1.5, 500);
        continue;
      }

      // Third check (optional): Are there actual messages?
      if (requireMessages) {
        const messages = document.querySelectorAll('[data-test-render-count]');
        if (messages.length === 0) {
          await this.sleep(delay);
          delay = Math.min(delay * 1.5, 500);
          continue;
        }
      }

      this.log(`Conversation ready after ${attempt} attempts, ${Date.now() - startTime}ms`);
      return true;
    }

    this.log(`Conversation timeout after ${attempt} attempts, ${maxWait}ms`);
    return false;
  }

  /**
   * Wait for navigation to complete and DOM to stabilize
   * Use this after a navigation event
   */
  async waitForNavigationComplete(options = {}) {
    const {
      maxWait = 5000,
      stabilityDelay = 200, // Wait this long after last DOM change
      skipNewChatPage = true, // Don't wait for messages on /new page
    } = options;

    const startTime = Date.now();
    const state = navigationInterceptor.getState();

    this.log(`Waiting for navigation to complete (pageType: ${state.pageType})`);

    // For /new page, just wait for basic DOM
    if (state.isNewChatPage && skipNewChatPage) {
      return this.waitForReady({ maxWait, pageType: PageType.NEW_CHAT });
    }

    // For conversation pages, use stricter criteria
    if (state.isConversationPage) {
      return this.waitForConversationReady({ maxWait });
    }

    // For other pages, use generic ready check
    return this.waitForReady({ maxWait });
  }

  /**
   * Check if DOM is ready based on criteria
   */
  checkReady(criteria, requireMessages = false) {
    // Check primary selectors
    for (const selector of criteria.selectors) {
      const element = document.querySelector(selector);
      if (element) {
        // Additional check for messages if required
        if (requireMessages && selector.includes('message')) {
          const messages = document.querySelectorAll('[data-test-render-count]');
          if (messages.length === 0) {
            continue; // Found container but no messages
          }
        }

        return { ready: true, foundSelector: selector };
      }
    }

    // Check fallback selectors
    for (const selector of criteria.fallbackSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        return { ready: true, foundSelector: `${selector} (fallback)` };
      }
    }

    return { ready: false, foundSelector: null };
  }

  /**
   * Find first matching element from selector list
   */
  findElement(selectors) {
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        return element;
      }
    }
    return null;
  }

  /**
   * Immediate check if page is ready (non-blocking)
   */
  isReady(pageType = null) {
    const detectedPageType = pageType || navigationInterceptor.getState().pageType;
    const criteria = ReadyCriteria[detectedPageType] || ReadyCriteria[PageType.OTHER];
    return this.checkReady(criteria).ready;
  }

  /**
   * Check if we're on a conversation page with messages
   */
  hasMessages() {
    const messages = document.querySelectorAll('[data-test-render-count]');
    return messages.length > 0;
  }

  /**
   * Get message count
   */
  getMessageCount() {
    const messages = document.querySelectorAll('[data-test-render-count]');
    return messages.length;
  }

  /**
   * Wait for a specific element to appear
   */
  async waitForElement(selector, options = {}) {
    const { maxWait = 5000, initialDelay = 50 } = options;

    const startTime = Date.now();
    let delay = initialDelay;

    while (Date.now() - startTime < maxWait) {
      const element = document.querySelector(selector);
      if (element) {
        return element;
      }

      await this.sleep(delay);
      delay = Math.min(delay * 1.5, 500);
    }

    return null;
  }

  /**
   * Wait for element to disappear (useful for loading states)
   */
  async waitForElementGone(selector, options = {}) {
    const { maxWait = 5000, initialDelay = 50 } = options;

    const startTime = Date.now();
    let delay = initialDelay;

    while (Date.now() - startTime < maxWait) {
      const element = document.querySelector(selector);
      if (!element) {
        return true;
      }

      await this.sleep(delay);
      delay = Math.min(delay * 1.5, 500);
    }

    return false;
  }

  /**
   * Sleep helper
   */
  sleep(ms) {
    return new Promise(resolve => {
      setTimeout(resolve, ms);
    });
  }

  /**
   * Set debug mode
   */
  setDebugMode(enabled) {
    this.debugMode = enabled;
  }

  /**
   * Log helper
   */
  log(...args) {
    if (this.debugMode) {
      console.log('[DOMReadyChecker]', ...args);
    }
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      totalChecks: this.checkCount,
    };
  }
}

// Export singleton
const domReadyChecker = new DOMReadyChecker();
export default domReadyChecker;
export { DOMReadyChecker, domReadyChecker };
