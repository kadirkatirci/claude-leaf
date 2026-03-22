/**
 * BookmarkButton - Manages bookmark buttons on messages
 */
import IconLibrary from '../../components/primitives/IconLibrary.js';
import HoverButtonManager from '../../utils/HoverButtonManager.js';
import { cn } from '../../utils/ClassNames.js';

const BOOKMARK_BUTTON_TOP = '8px';
const BOOKMARK_BUTTON_OUTSIDE_RIGHT = '-72px';

export class BookmarkButton {
  constructor(domUtils, getTheme) {
    this.dom = domUtils;
    this.getTheme = getTheme;
    // Use WeakMap for automatic garbage collection when messages are removed
    this.buttons = new WeakMap(); // messageElement -> button
    this.hoverCleanups = new Map(); // messageElement -> cleanup function (Map supports forEach)
    this.buttonStates = new WeakMap(); // messageElement -> isBookmarked state
  }

  setButtonVisibility(button, visible) {
    HoverButtonManager.setButtonVisibility(button, visible);
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
    const bgClass = isBookmarked ? 'clp-button-primary' : 'bg-bg-100 hover:bg-bg-200';
    button.className = cn(
      'claude-bookmark-btn',
      'absolute',
      'z-1',
      'size-8', // Match MarkerButton size
      'rounded-md',
      bgClass,
      'border',
      'border-border-300',
      'flex',
      'items-center',
      'justify-center',
      'text-lg',
      'cursor-pointer',
      'transition-all',
      'duration-200',
      'shadow-sm',
      'hover:shadow-md',
      'hover:scale-110'
    );
    button.innerHTML = isBookmarked
      ? IconLibrary.bookmark(true, '#ffffff')
      : IconLibrary.bookmark(false, 'currentColor');

    // Only positioning and visibility styles (must be inline for calculated values)
    Object.assign(button.style, {
      top: BOOKMARK_BUTTON_TOP,
      right: BOOKMARK_BUTTON_OUTSIDE_RIGHT,
    });
    this.setButtonVisibility(button, isBookmarked);

    // Set relative positioning on message
    if (window.getComputedStyle(messageElement).position === 'static') {
      messageElement.style.position = 'relative';
    }

    // Keep the outside button interactive while the pointer moves off the message box.
    const cleanup = HoverButtonManager.attachHoverListeners(messageElement, button, {
      persistWhen: () => button.getAttribute('data-bookmarked') === 'true',
      hideDelay: 100,
      keepVisibleOnButtonHover: true,
      checkMessageBounds: true,
    });

    // Store cleanup function
    this.hoverCleanups.set(messageElement, cleanup);

    // Button click handler
    button.addEventListener('click', e => {
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
    if (!button) {
      return;
    }

    // Update data attribute first
    button.setAttribute('data-bookmarked', isBookmarked ? 'true' : 'false');

    // Update native classes
    const bgClass = isBookmarked ? 'clp-button-primary' : 'bg-bg-100 hover:bg-bg-200';
    button.className = cn(
      'claude-bookmark-btn',
      'absolute',
      'z-1',
      'size-8', // Match MarkerButton size
      'rounded-md',
      bgClass,
      'border',
      'border-border-300',
      'flex',
      'items-center',
      'justify-center',
      'text-lg',
      'cursor-pointer',
      'transition-all',
      'duration-200',
      'shadow-sm',
      'hover:shadow-md',
      'hover:scale-110'
    );
    button.innerHTML = isBookmarked
      ? IconLibrary.bookmark(true, '#ffffff')
      : IconLibrary.bookmark(false, 'currentColor');

    // Update opacity - bookmarked always visible, otherwise check hover
    if (isBookmarked) {
      this.setButtonVisibility(button, true);
    } else {
      // Check if we're currently hovering
      const isHovering = messageElement.matches(':hover') || button.matches(':hover');
      this.setButtonVisibility(button, isHovering);
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

    // Remove buttons from DOM (WeakMap doesn't support forEach, so we query DOM)
    document.querySelectorAll('.claude-bookmark-btn').forEach(button => button.remove());

    // Reset WeakMaps (they'll be garbage collected when elements are removed)
    this.buttons = new WeakMap();
    this.buttonStates = new WeakMap();
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
