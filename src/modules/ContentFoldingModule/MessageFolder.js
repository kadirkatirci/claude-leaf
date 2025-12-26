/**
 * MessageFolder - Handles folding/unfolding of entire messages
 */
import DOMUtils from '../../utils/DOMUtils.js';
import IconLibrary from '../../components/primitives/IconLibrary.js';
import FadeGradientHelper from '../../utils/FadeGradientHelper.js';
import { conversationStateStore } from '../../stores/index.js';
import { MODULE_CONSTANTS } from '../../config/ModuleConstants.js';

const FOLDING_CONFIG = MODULE_CONSTANTS.contentFolding;

class MessageFolder {
  constructor(module) {
    this.module = module;
    this.messageCache = new WeakMap(); // message -> { chevron, isCollapsed, id }
    this.processedMessages = new WeakSet();
    this.failures = { messages: [], reasons: new Map() }; // Track failures
  }

  /**
   * Scan all messages and add collapse functionality
   */
  async scanMessages(messages, configArg) {
    try {
      this.config = configArg || this.config;
      this.module.log(`📬 MessageFolder scanning ${messages.length} messages...`);

      // Filter out non-message elements (footer, input area, etc.)
      const validMessages = messages.filter(messageEl => {
        // Skip if it's a footer or input container
        if (
          messageEl.tagName === 'FOOTER' ||
          messageEl.querySelector('textarea') ||
          messageEl.querySelector('input[type="text"]') ||
          messageEl.classList.contains('sticky') ||
          messageEl.style.position === 'fixed' ||
          messageEl.style.position === 'sticky'
        ) {
          return false;
        }

        // Must have some text content
        if (messageEl.textContent.trim().length < 10) {
          return false;
        }

        return true;
      });

      this.module.log(`Filtered to ${validMessages.length} valid messages`);

      const totalValidMessages = validMessages.length;

      for (const [index, messageEl] of validMessages.entries()) {
        // Skip if already processed
        if (this.processedMessages.has(messageEl)) {
          this.module.log(`Message ${index} already processed, skipping`);
          continue;
        }

        try {
          await this.processMessage(messageEl, index, totalValidMessages);
          this.processedMessages.add(messageEl);
        } catch (error) {
          this.module.error(`Failed to process message ${index}:`, error);

          // Track failure
          this.failures.messages.push({ messageIndex: index, messageEl });
          this.failures.reasons.set(messageEl, error.message);

          // Mark as processed to avoid retry loops
          this.processedMessages.add(messageEl);
        }
      }

      this.module.log('✅ MessageFolder scan complete');
    } catch (error) {
      this.module.error('MessageFolder scan error:', error);
    }
  }

  /**
   * Process individual message
   */
  async processMessage(messageEl, messageIndex, totalMessages) {
    this.module.log(`Processing message ${messageIndex} of ${totalMessages}`);

    // Generate unique ID
    const messageId = this.generateMessageId(messageIndex, messageEl);

    // Check saved state, default to expanded
    const foldingState = await conversationStateStore.getCurrentState('folding');
    const savedState = foldingState.messages[messageId];
    const shouldCollapse = savedState !== undefined ? savedState : false;

    // Find the message content container
    const contentContainer = this.findMessageContent(messageEl);
    if (!contentContainer) {
      this.module.warn(`Could not find content container for message ${messageIndex}`);
      return;
    }

    // Ensure message is positioned for absolute chevron
    if (getComputedStyle(messageEl).position === 'static') {
      messageEl.style.position = 'relative';
    }

    // Create chevron
    const chevron = this.createChevron(messageEl, shouldCollapse);

    // Store in cache
    this.messageCache.set(messageEl, {
      chevron,
      isCollapsed: shouldCollapse,
      id: messageId,
      contentContainer,
      originalMaxHeight: contentContainer.style.maxHeight,
      originalOverflow: contentContainer.style.overflow,
    });

    // Apply initial state
    if (shouldCollapse) {
      await this.collapseMessage(messageEl, false); // false = no animation
    }

    // Setup event listeners
    this.setupEventListeners(messageEl, chevron);
  }

  /**
   * Generate unique message ID
   */
  generateMessageId(messageIndex, messageEl) {
    // Create ID from message index + content hash
    const content = messageEl.textContent.trim().substring(0, 100);
    return `msg-${messageIndex}-${this.simpleHash(content)}`;
  }

  /**
   * Simple hash function
   */
  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Find the main content container of a message
   * Uses multiple strategies with fallbacks for robustness
   */
  findMessageContent(messageEl) {
    // Multiple selector strategies (most specific to least specific)
    const strategies = [
      // Strategy 1: Claude-specific class (most reliable)
      () => messageEl.querySelector('.font-claude-response'),

      // Strategy 2: Data attribute (if added by Claude)
      () => messageEl.querySelector('[data-message-content]'),

      // Strategy 3: First direct child div (current approach)
      () => messageEl.querySelector(':scope > div'),

      // Strategy 4: Find largest content div (heuristic)
      () => {
        const divs = messageEl.querySelectorAll('div');
        return Array.from(divs).reduce((largest, div) => {
          const hasContent = div.textContent.trim().length > 10;
          const isLarger = div.scrollHeight > (largest?.scrollHeight || 0);
          return hasContent && isLarger ? div : largest;
        }, null);
      },

      // Strategy 5: Ultimate fallback - message element itself
      () => messageEl,
    ];

    // Try each strategy
    for (const strategy of strategies) {
      try {
        const result = strategy();
        if (result && result.textContent.trim().length > 10) {
          this.module.log('Found content container via fallback strategy');
          return result;
        }
      } catch (e) {
        // Strategy failed, try next
        continue;
      }
    }

    // Ultimate fallback
    this.module.log('Using messageEl itself as container (all strategies failed)');
    return messageEl;
  }

  /**
   * Get computed line height with fallback for 'normal'
   */
  getComputedLineHeight(element) {
    const computed = window.getComputedStyle(element);
    let lineHeight = parseInt(computed.lineHeight);

    // Handle 'normal' value
    if (isNaN(lineHeight)) {
      const fontSize = parseInt(computed.fontSize) || 16;
      lineHeight = Math.round(fontSize * 1.5); // Standard 1.5x ratio
    }

    return Math.max(lineHeight, 20); // Minimum 20px for messages
  }

  /**
   * Create chevron icon
   */
  createChevron(messageEl, isCollapsed) {
    const theme = this.module.getTheme();

    const chevron = DOMUtils.createElement('button', {
      // button for accessibility
      className: 'message-fold-chevron',
      type: 'button',
      innerHTML: isCollapsed
        ? IconLibrary.chevron('right', 'currentColor', 14)
        : IconLibrary.chevron('down', 'currentColor', 14),
      title: isCollapsed ? 'Expand message' : 'Collapse message',
      'aria-label': isCollapsed ? 'Expand message' : 'Collapse message',
      'aria-expanded': !isCollapsed,
      tabIndex: 0,
      style: {
        position: 'absolute',
        left: '8px',
        top: '8px',
        cursor: 'pointer',
        fontSize: '14px',
        opacity: isCollapsed ? '0.7' : '0',
        transition: 'all 0.15s ease',
        userSelect: 'none',
        color: theme.isDark ? '#aaa' : '#666',
        zIndex: '10',
        background: 'none',
        border: 'none',
        padding: '0',
      },
    });

    // Hover effect on chevron
    chevron.addEventListener('mouseenter', () => {
      chevron.style.opacity = '1';
      chevron.style.transform = 'scale(1.2)';
    });

    chevron.addEventListener('mouseleave', () => {
      const cached = this.messageCache.get(messageEl);
      if (cached && !cached.isCollapsed) {
        chevron.style.opacity = '0';
      } else {
        chevron.style.opacity = '0.7';
      }
      chevron.style.transform = 'scale(1)';
    });

    messageEl.appendChild(chevron);

    return chevron;
  }

  /**
   * Setup event listeners
   */
  setupEventListeners(messageEl, chevron) {
    const cached = this.messageCache.get(messageEl);

    // Hover on message: Show/hide chevron
    const onMouseEnter = () => {
      if (!cached.isCollapsed) {
        chevron.style.opacity = '0.7';
      }
    };

    const onMouseLeave = () => {
      if (!cached.isCollapsed) {
        chevron.style.opacity = '0';
      }
    };

    messageEl.addEventListener('mouseenter', onMouseEnter);
    messageEl.addEventListener('mouseleave', onMouseLeave);

    // Click chevron: Toggle collapse
    const onClick = e => {
      e.stopPropagation();
      e.preventDefault();
      this.toggleMessage(messageEl);
    };

    chevron.addEventListener('click', onClick);

    // Keyboard: Enter/Space to toggle
    const onKeyDown = e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.toggleMessage(messageEl);
      }
    };

    chevron.addEventListener('keydown', onKeyDown);

    // Store cleanup functions
    this.module.unsubscribers.push(() => {
      messageEl.removeEventListener('mouseenter', onMouseEnter);
      messageEl.removeEventListener('mouseleave', onMouseLeave);
      chevron.removeEventListener('click', onClick);
      chevron.removeEventListener('keydown', onKeyDown);
    });
  }

  /**
   * Toggle message collapse/expand
   */
  async toggleMessage(messageEl) {
    const cached = this.messageCache.get(messageEl);
    if (!cached) {
      return;
    }

    if (cached.isCollapsed) {
      this.expandMessage(messageEl);
    } else {
      await this.collapseMessage(messageEl);
    }

    // Update ARIA attributes
    cached.chevron.setAttribute('aria-expanded', !cached.isCollapsed);
    cached.chevron.setAttribute(
      'aria-label',
      cached.isCollapsed ? 'Expand message' : 'Collapse message'
    );

    // Save state (debounced)
    if (FOLDING_CONFIG.rememberState) {
      const foldingState = await conversationStateStore.getCurrentState('folding');
      foldingState.messages[cached.id] = cached.isCollapsed;
      this.module.debouncedStateSave(foldingState);
    }
  }

  /**
   * Collapse message (show preview + expand footer)
   */
  async collapseMessage(messageEl, animate = true) {
    const cached = this.messageCache.get(messageEl);
    if (!cached) {
      return;
    }

    cached.isCollapsed = true;
    cached.chevron.innerHTML = IconLibrary.chevron('right', 'currentColor', 14);
    cached.chevron.title = 'Expand message';
    cached.chevron.style.opacity = '0.7'; // Always visible when collapsed

    // Calculate preview height (previewLines * line height)
    const config = this.config || FOLDING_CONFIG;
    const previewLines = config.messages.previewLines;
    const lineHeight = this.getComputedLineHeight(cached.contentContainer);
    const previewHeight = previewLines * lineHeight;

    // Apply collapsed styles
    if (animate) {
      cached.contentContainer.style.transition = 'max-height 0.3s ease, opacity 0.3s ease';
    }

    cached.contentContainer.style.maxHeight = `${previewHeight}px`;
    cached.contentContainer.style.overflow = 'hidden';
    cached.contentContainer.style.position = 'relative';

    // Add fade gradient
    this.addFadeGradient(cached.contentContainer);

    // Add expand footer
    this.addExpandFooter(messageEl, cached.contentContainer);

    this.module.log('Message collapsed');
  }

  /**
   * Expand message (show full content)
   */
  expandMessage(messageEl) {
    const cached = this.messageCache.get(messageEl);
    if (!cached) {
      return;
    }

    cached.isCollapsed = false;
    cached.chevron.innerHTML = IconLibrary.chevron('down', 'currentColor', 14);
    cached.chevron.title = 'Collapse message';
    cached.chevron.style.opacity = '0'; // Hidden when expanded (until hover)

    // Remove collapsed styles
    cached.contentContainer.style.transition = 'max-height 0.3s ease';
    cached.contentContainer.style.maxHeight = cached.originalMaxHeight || '';
    cached.contentContainer.style.overflow = cached.originalOverflow || '';

    // Remove fade gradient
    this.removeFadeGradient(cached.contentContainer);

    // Remove expand footer
    this.removeExpandFooter(messageEl);

    this.module.log('Message expanded');
  }

  /**
   * Add fade gradient overlay
   */
  addFadeGradient(container) {
    FadeGradientHelper.add(container, {
      height: '40px',
      className: 'message-fold-gradient',
      zIndex: '5',
    });
  }

  /**
   * Remove fade gradient
   */
  removeFadeGradient(container) {
    FadeGradientHelper.remove(container, 'message-fold-gradient');
  }

  /**
   * Add expand footer button
   */
  addExpandFooter(messageEl, container) {
    // Remove existing footer
    this.removeExpandFooter(messageEl);

    const theme = this.module.getTheme();

    const footer = DOMUtils.createElement('div', {
      className: 'message-fold-footer',
      innerHTML: '▼ Show full message',
      style: {
        marginTop: '8px',
        padding: '8px 12px',
        background: theme.isDark ? 'rgba(0, 0, 0, 0.3)' : 'rgba(0, 0, 0, 0.05)',
        color: theme.isDark ? '#aaa' : '#666',
        fontSize: '12px',
        textAlign: 'center',
        cursor: 'pointer',
        borderRadius: '6px',
        transition: 'all 0.15s ease',
        userSelect: 'none',
      },
    });

    // Hover effect
    footer.addEventListener('mouseenter', () => {
      footer.style.background = theme.isDark ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.1)';
      footer.style.color = theme.isDark ? '#fff' : '#000';
    });

    footer.addEventListener('mouseleave', () => {
      footer.style.background = theme.isDark ? 'rgba(0, 0, 0, 0.3)' : 'rgba(0, 0, 0, 0.05)';
      footer.style.color = theme.isDark ? '#aaa' : '#666';
    });

    // Click to expand
    const onFooterClick = e => {
      e.stopPropagation();
      this.expandMessage(messageEl);
    };

    footer.addEventListener('click', onFooterClick);

    // Store cleanup
    this.module.unsubscribers.push(() => {
      footer.removeEventListener('click', onFooterClick);
    });

    // Append after content container
    messageEl.appendChild(footer);
  }

  /**
   * Remove expand footer
   */
  removeExpandFooter(messageEl) {
    const footer = messageEl.querySelector('.message-fold-footer');
    if (footer) {
      footer.remove();
    }
  }

  /**
   * Clean up all chevrons and styles
   */
  cleanup() {
    // Report failures if any
    if (this.failures.messages.length > 0) {
      this.module.warn(`${this.failures.messages.length} messages failed to process`);
      if (this.failures.reasons.size > 0) {
        this.module.log('Failure reasons:', Array.from(this.failures.reasons.values()));
      }
    }

    // Reset state
    this.failures = { messages: [], reasons: new Map() };
    this.processedMessages = new WeakSet();
    this.messageCache = new WeakMap();
  }
}

export default MessageFolder;
