/**
 * DOMUtils - Unified DOM utilities for Claude interface
 * This file imports and re-exports all split modules for backward compatibility
 */

import DOMUtilsCore from './DOMUtils-Core.js';
import DOMUtilsHelpers from './DOMUtils-Helpers.js';
import DOMUtilsParsing from './DOMUtils-Parsing.js';
import ObserverManager from '../managers/ObserverManager.js';

// Combine all utilities into a single object for backward compatibility
const DOMUtils = {
  // Initialize function - now async to ensure VisibilityManager is loaded
  init() {
    return DOMUtilsCore.init();
  },

  // From DOMUtils-Core
  isOnConversationPage: DOMUtilsCore.isOnConversationPage.bind(DOMUtilsCore),
  findActualMessages: DOMUtilsCore.findActualMessages.bind(DOMUtilsCore),
  findMessages: DOMUtilsCore.findMessages.bind(DOMUtilsCore),
  getChatContainer: DOMUtilsCore.getChatContainer.bind(DOMUtilsCore),
  isUserMessage: DOMUtilsCore.isUserMessage.bind(DOMUtilsCore),
  isElementVisible: DOMUtilsCore.isElementVisible.bind(DOMUtilsCore),
  isElementPartiallyVisible: DOMUtilsCore.isElementPartiallyVisible.bind(DOMUtilsCore),
  scrollToElement: DOMUtilsCore.scrollToElement.bind(DOMUtilsCore),
  getCurrentVisibleMessageIndex: DOMUtilsCore.getCurrentVisibleMessageIndex.bind(DOMUtilsCore),

  // From DOMUtils-Helpers
  debounce: DOMUtilsHelpers.debounce.bind(DOMUtilsHelpers),
  throttle: DOMUtilsHelpers.throttle.bind(DOMUtilsHelpers),
  flashClass: DOMUtilsHelpers.flashClass.bind(DOMUtilsHelpers),
  injectCSS: DOMUtilsHelpers.injectCSS.bind(DOMUtilsHelpers),
  createElement: DOMUtilsHelpers.createElement.bind(DOMUtilsHelpers),
  waitForElement: DOMUtilsHelpers.waitForElement.bind(DOMUtilsHelpers),
  copyToClipboard: DOMUtilsHelpers.copyToClipboard.bind(DOMUtilsHelpers),
  generateId: DOMUtilsHelpers.generateId.bind(DOMUtilsHelpers),
  parseSize: DOMUtilsHelpers.parseSize.bind(DOMUtilsHelpers),
  getStyle: DOMUtilsHelpers.getStyle.bind(DOMUtilsHelpers),
  setStyles: DOMUtilsHelpers.setStyles.bind(DOMUtilsHelpers),
  clearElement: DOMUtilsHelpers.clearElement.bind(DOMUtilsHelpers),

  // From DOMUtils-Parsing
  getEditedPrompts: DOMUtilsParsing.getEditedPrompts.bind(DOMUtilsParsing),
  parseMarkdownHeadings: DOMUtilsParsing.parseMarkdownHeadings.bind(DOMUtilsParsing),
  extractTextContent: DOMUtilsParsing.extractTextContent.bind(DOMUtilsParsing),
  parseCodeBlocks: DOMUtilsParsing.parseCodeBlocks.bind(DOMUtilsParsing),
  parseLinks: DOMUtilsParsing.parseLinks.bind(DOMUtilsParsing),
  getContentStats: DOMUtilsParsing.getContentStats.bind(DOMUtilsParsing),
  generateContentSignature: DOMUtilsParsing.generateContentSignature.bind(DOMUtilsParsing),
  findByTextContent: DOMUtilsParsing.findByTextContent.bind(DOMUtilsParsing),
  analyzeContentPatterns: DOMUtilsParsing.analyzeContentPatterns.bind(DOMUtilsParsing),

  // Deprecated methods - kept for backward compatibility but not used
  getUserMessages() {
    console.warn('[DOMUtils] getUserMessages() is deprecated and unreliable');
    const allMessages = this.findMessages();
    // This logic is flawed but kept for compatibility
    return allMessages.filter((_, index) => index % 2 === 0);
  },

  getClaudeMessages() {
    console.warn('[DOMUtils] getClaudeMessages() is deprecated and unreliable');
    const allMessages = this.findMessages();
    // This logic is flawed but kept for compatibility
    return allMessages.filter((_, index) => index % 2 === 1);
  },

  getEditHistory(messageElement) {
    console.warn('[DOMUtils] getEditHistory() is deprecated, use getEditedPrompts() instead');
    if (!messageElement) {
      return null;
    }

    // Legacy implementation for compatibility
    const editBadge = messageElement.querySelector('[class*="edit" i][class*="badge" i]');
    const versionText = messageElement.querySelector('[class*="version" i]');
    const timestamp = messageElement.querySelector('[class*="edited" i][class*="time" i]');

    return {
      hasHistory: !!(editBadge || versionText || timestamp),
      badge: editBadge,
      version: versionText?.textContent,
      timestamp: timestamp?.textContent,
      element: messageElement,
    };
  },

  // Use ObserverManager for better performance
  observeDOM(callback, target = null) {
    const targetNode = target || this.getChatContainer();
    const id = `dom-observer-${Date.now()}`;

    return ObserverManager.observe(id, targetNode, callback, {
      childList: true,
      subtree: true,
      attributes: false,
      throttle: 100, // Add throttling for better performance
    });
  },
};

export default DOMUtils;
