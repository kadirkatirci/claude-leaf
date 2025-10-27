/**
 * MessageFolder - Handles message-level collapse/expand
 * Collapses entire messages (both user and Claude) with preview mode
 */
import DOMUtils from '../../utils/DOMUtils.js';

class MessageFolder {
  constructor(module, storage) {
    this.module = module;
    this.storage = storage;
    this.messageCache = new WeakMap(); // message -> { chevron, isCollapsed, id }
    this.processedMessages = new WeakSet();
  }

  /**
   * Scan all messages and add collapse functionality
   */
  scanMessages(messages) {
    try {
      this.module.log(`📬 MessageFolder scanning ${messages.length} messages...`);

      // Filter out non-message elements (footer, input area, etc.)
      const validMessages = messages.filter((messageEl) => {
        // Skip if it's a footer or input container
        if (messageEl.tagName === 'FOOTER' ||
            messageEl.querySelector('textarea') ||
            messageEl.querySelector('input[type="text"]') ||
            messageEl.classList.contains('sticky') ||
            messageEl.style.position === 'fixed' ||
            messageEl.style.position === 'sticky') {
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

      validMessages.forEach((messageEl, index) => {
        // Skip if already processed
        if (this.processedMessages.has(messageEl)) {
          this.module.log(`Message ${index} already processed, skipping`);
          return;
        }

        this.processMessage(messageEl, index, totalValidMessages);
        this.processedMessages.add(messageEl);
      });

      this.module.log('✅ MessageFolder scan complete');
    } catch (error) {
      this.module.error('MessageFolder scan error:', error);
    }
  }

  /**
   * Process individual message
   */
  processMessage(messageEl, messageIndex, totalMessages) {
    this.module.log(`Processing message ${messageIndex} of ${totalMessages}`);

    // Generate unique ID
    const messageId = this.generateMessageId(messageIndex, messageEl);

    // Check saved state, default to expanded
    const savedState = this.storage.getMessageState(messageId);
    const shouldCollapse = savedState !== null ? savedState : false;

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
      this.collapseMessage(messageEl, false); // false = no animation
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
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Find the main content container of a message
   */
  findMessageContent(messageEl) {
    // Try to find the main content div
    // Claude messages have nested structure, we want the first direct child div
    const firstDiv = messageEl.querySelector(':scope > div');

    if (firstDiv) {
      this.module.log('Found content container (first child div)');
      return firstDiv;
    }

    // Fallback: use the message element itself
    this.module.log('Using messageEl itself as container');
    return messageEl;
  }

  /**
   * Create chevron icon
   */
  createChevron(messageEl, isCollapsed) {
    const theme = this.module.getTheme();

    const chevron = DOMUtils.createElement('span', {
      className: 'message-fold-chevron',
      innerHTML: isCollapsed ? '▶' : '▼',
      title: isCollapsed ? 'Expand message' : 'Collapse message',
      style: {
        position: 'absolute',
        left: '8px',
        top: '8px',
        cursor: 'pointer',
        fontSize: '14px',
        opacity: isCollapsed ? '0.7' : '0', // Visible if collapsed, hidden if expanded
        transition: 'all 0.15s ease',
        userSelect: 'none',
        color: theme.isDark ? '#aaa' : '#666',
        zIndex: '10',
      }
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
    const onClick = (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.toggleMessage(messageEl);
    };

    chevron.addEventListener('click', onClick);

    // Store cleanup functions
    this.module.unsubscribers.push(() => {
      messageEl.removeEventListener('mouseenter', onMouseEnter);
      messageEl.removeEventListener('mouseleave', onMouseLeave);
      chevron.removeEventListener('click', onClick);
    });
  }

  /**
   * Toggle message collapse/expand
   */
  toggleMessage(messageEl) {
    const cached = this.messageCache.get(messageEl);
    if (!cached) return;

    if (cached.isCollapsed) {
      this.expandMessage(messageEl);
    } else {
      this.collapseMessage(messageEl);
    }

    // Save state
    if (this.module.getSetting('rememberState')) {
      this.storage.setMessageState(cached.id, cached.isCollapsed);
    }
  }

  /**
   * Collapse message (show preview + expand footer)
   */
  collapseMessage(messageEl, animate = true) {
    const cached = this.messageCache.get(messageEl);
    if (!cached) return;

    cached.isCollapsed = true;
    cached.chevron.innerHTML = '▶';
    cached.chevron.title = 'Expand message';
    cached.chevron.style.opacity = '0.7'; // Always visible when collapsed

    // Calculate preview height (previewLines * line height)
    const previewLines = this.module.getSetting('messages.previewLines') || 3;
    const lineHeight = parseInt(getComputedStyle(cached.contentContainer).lineHeight) || 24;
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
    if (!cached) return;

    cached.isCollapsed = false;
    cached.chevron.innerHTML = '▼';
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
    // Remove existing gradient
    this.removeFadeGradient(container);

    const theme = this.module.getTheme();
    const gradient = DOMUtils.createElement('div', {
      className: 'message-fold-gradient',
      style: {
        position: 'absolute',
        bottom: '0',
        left: '0',
        right: '0',
        height: '40px',
        background: theme.isDark
          ? 'linear-gradient(to bottom, transparent, #1e1e1e)'
          : 'linear-gradient(to bottom, transparent, #ffffff)',
        pointerEvents: 'none',
        zIndex: '5',
      }
    });

    container.appendChild(gradient);
  }

  /**
   * Remove fade gradient
   */
  removeFadeGradient(container) {
    const gradient = container.querySelector('.message-fold-gradient');
    if (gradient) {
      gradient.remove();
    }
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
      }
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
    const onFooterClick = (e) => {
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
    this.processedMessages = new WeakSet();
    this.messageCache = new WeakMap();
  }
}

export default MessageFolder;
