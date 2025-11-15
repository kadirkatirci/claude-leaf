/**
 * BookmarkButton - Manages bookmark buttons on messages
 */
import IconLibrary from '../../components/primitives/IconLibrary.js';
import HoverButtonManager from '../../utils/HoverButtonManager.js';
import { cn } from '../../utils/ClassNames.js';

export class BookmarkButton {
  constructor(domUtils, getTheme) {
    this.dom = domUtils;
    this.getTheme = getTheme;
    this.buttons = new Map(); // messageElement -> button
    this.hoverCleanups = new Map(); // messageElement -> cleanup function
    this.buttonStates = new Map(); // messageElement -> isBookmarked state
  }

  /**
   * Add bookmark buttons to all messages
   */
  async addToMessages(messages, getMessageId, isBookmarked, onToggle) {
    for (const [index, message] of messages.entries()) {
      const messageId = getMessageId(message, index);
      const bookmarked = await isBookmarked(messageId);

      // Update existing button if it exists
      if (this.buttons.has(message)) {
        // Only update if state changed (avoid unnecessary DOM manipulation)
        const currentState = this.buttonStates.get(message);
        if (currentState !== bookmarked) {
          this.updateButton(message, bookmarked);
          this.buttonStates.set(message, bookmarked);
        }
        continue;
      }

      // Create new button
      const button = this.createButton(message, messageId, bookmarked, onToggle);
      this.buttons.set(message, button);
      this.buttonStates.set(message, bookmarked);
    }
  }

  /**
   * Create a bookmark button
   */
  createButton(messageElement, messageId, isBookmarked, onToggle) {
    const button = this.dom.createElement('button');
    button.setAttribute('data-bookmarked', isBookmarked ? 'true' : 'false');

    // Claude's native button classes
    const bgClass = isBookmarked ? 'bg-accent-main-100 hover:bg-accent-main-200' : 'bg-bg-100 hover:bg-bg-200';
    button.className = cn(
      'claude-bookmark-btn',
      'absolute',
      'z-10',
      'px-2.5',
      'py-1.5',
      'rounded-md',
      bgClass,
      'cursor-pointer',
      'transition-all',
      'shadow-sm',
      'hover:shadow-md',
      'hover:scale-110'
    );
    button.innerHTML = isBookmarked ? IconLibrary.bookmark(true, '#ffffff') : IconLibrary.bookmark(false, 'currentColor');

    // Only positioning and visibility styles (must be inline for calculated values)
    Object.assign(button.style, {
      top: '8px',
      right: '8px',
      opacity: isBookmarked ? '1' : '0',
    });

    // Set relative positioning on message
    if (messageElement.style.position !== 'relative' && messageElement.style.position !== 'absolute') {
      messageElement.style.position = 'relative';
    }

    // Attach hover listeners using HoverButtonManager
    const cleanup = HoverButtonManager.attachPersistentHover(
      messageElement,
      button,
      () => button.getAttribute('data-bookmarked') === 'true' // Persist when bookmarked
    );

    // Store cleanup function
    this.hoverCleanups.set(messageElement, cleanup);

    // Button click handler
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      onToggle(messageElement, messageId);
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

    // Update data attribute first
    button.setAttribute('data-bookmarked', isBookmarked ? 'true' : 'false');

    // Update native classes
    const bgClass = isBookmarked ? 'bg-accent-main-100 hover:bg-accent-main-200' : 'bg-bg-100 hover:bg-bg-200';
    button.className = cn(
      'claude-bookmark-btn',
      'absolute',
      'z-10',
      'px-2.5',
      'py-1.5',
      'rounded-md',
      bgClass,
      'cursor-pointer',
      'transition-all',
      'shadow-sm',
      'hover:shadow-md',
      'hover:scale-110'
    );
    button.innerHTML = isBookmarked ? IconLibrary.bookmark(true, '#ffffff') : IconLibrary.bookmark(false, 'currentColor');

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
    // Clean up hover listeners
    this.hoverCleanups.forEach(cleanup => cleanup());
    this.hoverCleanups.clear();

    // Remove buttons
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

}
