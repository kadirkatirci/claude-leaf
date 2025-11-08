/**
 * BookmarkButton - Manages bookmark buttons on messages
 */
export class BookmarkButton {
  constructor(domUtils, getTheme) {
    this.dom = domUtils;
    this.getTheme = getTheme;
    this.buttons = new Map(); // messageElement -> button
    this.buttonStates = new Map(); // messageElement -> isBookmarked state
  }

  /**
   * Add bookmark buttons to all messages
   */
  addToMessages(messages, getMessageId, isBookmarked, onToggle) {
    messages.forEach((message, index) => {
      const messageId = getMessageId(message, index);
      const bookmarked = isBookmarked(messageId);

      // Update existing button if it exists
      if (this.buttons.has(message)) {
        // Only update if state changed (avoid unnecessary DOM manipulation)
        const currentState = this.buttonStates.get(message);
        if (currentState !== bookmarked) {
          this.updateButton(message, bookmarked);
          this.buttonStates.set(message, bookmarked);
        }
        return;
      }

      // Create new button
      const button = this.createButton(message, messageId, bookmarked, onToggle);
      this.buttons.set(message, button);
      this.buttonStates.set(message, bookmarked);
    });
  }

  /**
   * Create a bookmark button
   */
  createButton(messageElement, messageId, isBookmarked, onToggle) {
    const theme = this.getTheme();

    const button = this.dom.createElement('button');
    button.setAttribute('data-bookmarked', isBookmarked ? 'true' : 'false');

    if (theme.useNativeClasses) {
      // Claude's native button classes
      const bgClass = isBookmarked ? 'bg-accent-main-100 hover:bg-accent-main-200' : 'bg-bg-100 hover:bg-bg-200';
      button.className = `claude-bookmark-btn absolute z-10 px-2.5 py-1.5 rounded-md ${bgClass} cursor-pointer transition-all shadow-sm hover:shadow-md hover:scale-110`;
      button.innerHTML = isBookmarked ? this.getBookmarkSVG(true, '#ffffff') : this.getBookmarkSVG(false, 'currentColor');

      // Only positioning and visibility styles
      Object.assign(button.style, {
        top: '8px',
        right: '8px',
        opacity: isBookmarked ? '1' : '0',
      });
    } else {
      button.className = 'claude-bookmark-btn';
      button.innerHTML = isBookmarked ? this.getBookmarkSVG(true, '#ffffff') : this.getBookmarkSVG(false, '#333');

      Object.assign(button.style, {
        position: 'absolute',
        top: '8px',
        right: '8px',
        padding: '6px 10px',
        borderRadius: '6px',
        border: 'none',
        background: isBookmarked ? (theme.primary || theme.accentColor || '#CC785C') : '#f0f0f0',
        color: isBookmarked ? 'white' : '#333',
        cursor: 'pointer',
        fontSize: '14px',
        zIndex: '10',
        opacity: isBookmarked ? '1' : '0',
        transition: 'all 0.2s ease',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
      });
    }

    // Set relative positioning on message
    if (messageElement.style.position !== 'relative' && messageElement.style.position !== 'absolute') {
      messageElement.style.position = 'relative';
    }

    // Track hover state
    let isHovering = false;

    // Show button on message hover
    const showButton = () => {
      isHovering = true;
      button.style.opacity = '1';
    };

    const hideButton = () => {
      isHovering = false;
      // Only hide if not bookmarked (check current state from data attribute)
      const currentlyBookmarked = button.getAttribute('data-bookmarked') === 'true';
      if (!currentlyBookmarked) {
        button.style.opacity = '0';
      }
    };

    messageElement.addEventListener('mouseenter', showButton);
    messageElement.addEventListener('mouseleave', hideButton);

    // Button click handler
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      onToggle(messageElement, messageId);
    });

    // Button hover effect (only for custom theme)
    if (!theme.useNativeClasses) {
      button.addEventListener('mouseenter', () => {
        button.style.transform = 'scale(1.1)';
      });
      button.addEventListener('mouseleave', () => {
        button.style.transform = 'scale(1)';
      });
    }

    messageElement.appendChild(button);
    return button;
  }

  /**
   * Update a button's appearance
   */
  updateButton(messageElement, isBookmarked) {
    const button = this.buttons.get(messageElement);
    if (!button) return;

    const theme = this.getTheme();

    // Update data attribute first
    button.setAttribute('data-bookmarked', isBookmarked ? 'true' : 'false');

    if (theme.useNativeClasses) {
      // Update native classes
      const bgClass = isBookmarked ? 'bg-accent-main-100 hover:bg-accent-main-200' : 'bg-bg-100 hover:bg-bg-200';
      button.className = `claude-bookmark-btn absolute z-10 px-2.5 py-1.5 rounded-md ${bgClass} cursor-pointer transition-all shadow-sm hover:shadow-md hover:scale-110`;
      button.innerHTML = isBookmarked ? this.getBookmarkSVG(true, '#ffffff') : this.getBookmarkSVG(false, 'currentColor');
    } else {
      // Update visual appearance for custom theme
      button.innerHTML = isBookmarked ? this.getBookmarkSVG(true, '#ffffff') : this.getBookmarkSVG(false, '#333');
      button.style.background = isBookmarked ? (theme.primary || theme.accentColor || '#CC785C') : '#f0f0f0';
      button.style.color = isBookmarked ? 'white' : '#333';
    }

    // Update opacity - bookmarked always visible, otherwise check hover
    if (isBookmarked) {
      button.style.opacity = '1';
    } else {
      // Check if we're currently hovering
      const isHovering = messageElement.matches(':hover') || button.matches(':hover');
      button.style.opacity = isHovering ? '1' : '0';
    }
  }

  /**
   * Remove all buttons
   * Named removeAll() for consistency with other modules
   */
  removeAll() {
    this.buttons.forEach(button => button.remove());
    this.buttons.clear();
    this.buttonStates.clear();
  }

  /**
   * Alias for backward compatibility
   * @deprecated Use removeAll() instead
   */
  clear() {
    this.removeAll();
  }

  /**
   * Get button for a message element
   */
  get(messageElement) {
    return this.buttons.get(messageElement);
  }

  /**
   * Check if message has a button
   */
  has(messageElement) {
    return this.buttons.has(messageElement);
  }

  /**
   * Get bookmark SVG icon
   * @param {boolean} filled - Whether to use filled or stroked version
   * @param {string} color - Color for the icon
   * @returns {string} SVG markup
   */
  getBookmarkSVG(filled = false, color = '#ffffff') {
    if (filled) {
      return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" style="display: inline-block; vertical-align: middle;">
        <path fill-rule="evenodd" clip-rule="evenodd" d="M4 4.75C4 3.23122 5.23122 2 6.75 2H17.75C19.2688 2 20.5 3.23122 20.5 4.75V21.75C20.5 22.0135 20.3618 22.2576 20.1359 22.3931C19.91 22.5287 19.6295 22.5357 19.3971 22.4118L12.25 18.6L5.10294 22.4118C4.87049 22.5357 4.59003 22.5287 4.36413 22.3931C4.13822 22.2576 4 22.0135 4 21.75V4.75Z" fill="${color}"/>
      </svg>`;
    } else {
      return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" style="display: inline-block; vertical-align: middle;">
        <path d="M12 17.5L19.5 21.5V4.5C19.5 3.39543 18.6046 2.5 17.5 2.5H6.5C5.39543 2.5 4.5 3.39543 4.5 4.5V21.5L12 17.5Z" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`;
    }
  }
}
