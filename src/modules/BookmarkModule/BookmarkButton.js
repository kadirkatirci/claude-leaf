/**
 * BookmarkButton - Manages bookmark buttons on messages
 */
export class BookmarkButton {
  constructor(domUtils, getTheme) {
    this.dom = domUtils;
    this.getTheme = getTheme;
    this.buttons = new Map(); // messageElement -> button
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
        this.updateButton(message, bookmarked);
        return;
      }

      // Create new button
      const button = this.createButton(message, messageId, bookmarked, onToggle);
      this.buttons.set(message, button);
    });
  }

  /**
   * Create a bookmark button
   */
  createButton(messageElement, messageId, isBookmarked, onToggle) {
    const theme = this.getTheme();

    const button = this.dom.createElement('button', {
      className: 'claude-bookmark-btn',
      innerHTML: isBookmarked ? '🔖' : '📑',
      style: {
        position: 'absolute',
        top: '8px',
        right: '8px',
        padding: '6px 10px',
        borderRadius: '6px',
        border: 'none',
        background: isBookmarked ? theme.gradient : '#f0f0f0',
        color: isBookmarked ? 'white' : '#333',
        cursor: 'pointer',
        fontSize: '14px',
        zIndex: '10',
        opacity: '0',
        transition: 'all 0.2s ease',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
      }
    });

    // Set relative positioning on message
    if (messageElement.style.position !== 'relative' && messageElement.style.position !== 'absolute') {
      messageElement.style.position = 'relative';
    }

    // Show button on message hover
    const showButton = () => {
      button.style.opacity = '1';
    };
    const hideButton = () => {
      button.style.opacity = '0';
    };

    messageElement.addEventListener('mouseenter', showButton);
    messageElement.addEventListener('mouseleave', hideButton);

    // Button click handler
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      onToggle(messageElement, messageId);
    });

    // Button hover effect
    button.addEventListener('mouseenter', () => {
      button.style.transform = 'scale(1.1)';
    });
    button.addEventListener('mouseleave', () => {
      button.style.transform = 'scale(1)';
    });

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
    button.innerHTML = isBookmarked ? '🔖' : '📑';
    button.style.background = isBookmarked ? theme.gradient : '#f0f0f0';
    button.style.color = isBookmarked ? 'white' : '#333';
  }

  /**
   * Remove all buttons
   */
  clear() {
    this.buttons.forEach(button => button.remove());
    this.buttons.clear();
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
}
