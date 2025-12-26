/**
 * MessageCollapse - Handles collapsing/expanding of messages
 */
import DOMUtils from '../../utils/DOMUtils.js';
import { MODULE_CONSTANTS } from '../../config/ModuleConstants.js';

const COMPACT_CONFIG = MODULE_CONSTANTS.compactView;

class MessageCollapse {
  constructor(settings, onStateChange) {
    this.settings = settings;
    this.onStateChange = onStateChange;
    this.collapsedMessages = new Map(); // message element -> collapsed state
  }

  /**
   * Check if message should be collapsed
   */
  shouldCollapse(messageElement) {
    const minLines = COMPACT_CONFIG.minLines;

    // Calculate message content (approximately 24px per line)
    const lineHeight = 24;
    const lines = Math.floor(messageElement.scrollHeight / lineHeight);

    return lines > minLines;
  }

  /**
   * Collapse message
   */
  collapseMessage(messageElement) {
    if (this.collapsedMessages.get(messageElement)) {
      return; // Already collapsed
    }

    const settings = this.settings();
    const previewLines = settings.previewLines || 8;
    const fadeHeight = 120; // For longer fade

    // Save scroll position (for scroll issue)
    const scrollY = window.scrollY;

    // Get computed background color from body for theme-aware gradient
    const computedBg =
      window.getComputedStyle(document.body).backgroundColor || 'rgb(255, 255, 255)';

    // Create wrapper
    const wrapper = DOMUtils.createElement('div', {
      className: 'claude-message-collapsed',
      style: {
        position: 'relative',
        maxHeight: `${previewLines * 24}px`, // ~24px per line
        overflow: 'hidden',
        transition: 'max-height 0.3s ease',
      },
    });

    // Theme-aware fade overlay using CSS variables (Claude native colors)
    const fadeOverlay = DOMUtils.createElement('div', {
      className: 'claude-collapse-fade',
      style: {
        position: 'absolute',
        bottom: '0',
        left: '0',
        right: '0',
        height: `${fadeHeight}px`,
        // Multi-stop gradient for smooth fade using computed body background
        background: `linear-gradient(to bottom, 
          transparent 0%, 
          ${computedBg.replace('rgb', 'rgba').replace(')', ', 0.3)')} 40%, 
          ${computedBg.replace('rgb', 'rgba').replace(')', ', 0.8)')} 70%, 
          ${computedBg} 100%
        )`,
        pointerEvents: 'none',
      },
    });

    // Wrap the message
    const parent = messageElement.parentElement;
    parent.insertBefore(wrapper, messageElement);
    wrapper.appendChild(messageElement);
    wrapper.appendChild(fadeOverlay);

    // Save state
    this.collapsedMessages.set(messageElement, {
      wrapper,
      fadeOverlay,
      originalHeight: messageElement.scrollHeight,
    });

    // Restore scroll position
    requestAnimationFrame(() => {
      window.scrollTo(0, scrollY);
    });

    this.onStateChange?.(messageElement, true);
  }

  /**
   * Expand message
   */
  expandMessage(messageElement) {
    const state = this.collapsedMessages.get(messageElement);
    if (!state) {
      return;
    }

    const { wrapper, fadeOverlay } = state;

    // Save scroll position
    const scrollY = window.scrollY;

    // Remove max height
    wrapper.style.maxHeight = 'none';

    // Remove fade
    fadeOverlay.style.opacity = '0';

    setTimeout(() => {
      // Remove wrapper, put message back
      const parent = wrapper.parentElement;
      parent.insertBefore(messageElement, wrapper);
      wrapper.remove();

      this.collapsedMessages.delete(messageElement);

      // Restore scroll position
      requestAnimationFrame(() => {
        window.scrollTo(0, scrollY);
      });

      this.onStateChange?.(messageElement, false);
    }, 300);
  }

  /**
   * Toggle collapse/expand
   */
  toggleMessage(messageElement) {
    if (this.collapsedMessages.has(messageElement)) {
      this.expandMessage(messageElement);
    } else {
      this.collapseMessage(messageElement);
    }
  }

  /**
   * Is message collapsed?
   */
  isCollapsed(messageElement) {
    return this.collapsedMessages.has(messageElement);
  }

  /**
   * Clear all collapsed messages
   */
  clear() {
    this.collapsedMessages.forEach((state, message) => {
      this.expandMessage(message);
    });
    this.collapsedMessages.clear();
  }
}

export default MessageCollapse;
