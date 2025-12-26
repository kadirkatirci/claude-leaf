/**
 * HoverButtonManager - Manages hover-triggered buttons on messages
 * Provides consistent hover behavior for buttons that appear on message hover
 */

export default class HoverButtonManager {
  /**
   * Attach hover listeners to show/hide button on message hover
   * @param {HTMLElement} messageElement - The message element to attach listeners to
   * @param {HTMLElement} button - The button to show/hide
   * @param {Object} options - Configuration options
   * @param {Function} options.persistWhen - Function that returns true if button should stay visible
   * @param {number} options.hideDelay - Delay before hiding button (ms)
   * @param {boolean} options.keepVisibleOnButtonHover - Keep visible when hovering button itself
   * @param {boolean} options.checkMessageBounds - Check if mouse is within message bounds on button leave
   */
  static attachHoverListeners(messageElement, button, options = {}) {
    const {
      persistWhen = () => false,
      hideDelay = 0,
      keepVisibleOnButtonHover = true,
      checkMessageBounds = false,
    } = options;

    let hoverTimeout = null;

    /**
     * Show the button
     */
    const showButton = () => {
      if (hoverTimeout) {
        clearTimeout(hoverTimeout);
        hoverTimeout = null;
      }
      button.style.opacity = '1';
      if (button.style.pointerEvents !== undefined) {
        button.style.pointerEvents = 'auto';
      }
    };

    /**
     * Hide the button (with optional delay)
     */
    const hideButton = () => {
      if (hoverTimeout) {
        clearTimeout(hoverTimeout);
      }

      // Check if button should persist (e.g., bookmarked)
      if (persistWhen()) {
        button.style.opacity = '1';
        return;
      }

      // Hide with delay if specified
      if (hideDelay > 0) {
        hoverTimeout = setTimeout(() => {
          button.style.opacity = '0';
          if (button.style.pointerEvents !== undefined) {
            button.style.pointerEvents = 'none';
          }
        }, hideDelay);
      } else {
        button.style.opacity = '0';
        if (button.style.pointerEvents !== undefined) {
          button.style.pointerEvents = 'none';
        }
      }
    };

    // Show button on message hover
    messageElement.addEventListener('mouseenter', showButton);
    messageElement.addEventListener('mouseleave', hideButton);

    // Keep visible when hovering button itself
    if (keepVisibleOnButtonHover) {
      button.addEventListener('mouseenter', showButton);

      if (checkMessageBounds) {
        // Advanced: Check if mouse is within message bounds on button leave
        button.addEventListener('mouseleave', e => {
          const rect = messageElement.getBoundingClientRect();
          if (
            e.clientX >= rect.left &&
            e.clientX <= rect.right &&
            e.clientY >= rect.top &&
            e.clientY <= rect.bottom
          ) {
            showButton();
          } else {
            hideButton();
          }
        });
      } else {
        // Simple: Just hide on button leave
        button.addEventListener('mouseleave', hideButton);
      }
    }

    // Store cleanup function
    return () => {
      if (hoverTimeout) {
        clearTimeout(hoverTimeout);
      }
      messageElement.removeEventListener('mouseenter', showButton);
      messageElement.removeEventListener('mouseleave', hideButton);
      if (keepVisibleOnButtonHover) {
        button.removeEventListener('mouseenter', showButton);
        button.removeEventListener('mouseleave', hideButton);
      }
    };
  }

  /**
   * Simplified version for buttons that should always hide when not hovering
   * @param {HTMLElement} messageElement - The message element
   * @param {HTMLElement} button - The button to show/hide
   */
  static attachSimpleHover(messageElement, button) {
    return this.attachHoverListeners(messageElement, button, {
      persistWhen: () => false,
      hideDelay: 0,
      keepVisibleOnButtonHover: false,
    });
  }

  /**
   * Version for buttons that persist when a condition is met (e.g., bookmarked)
   * @param {HTMLElement} messageElement - The message element
   * @param {HTMLElement} button - The button to show/hide
   * @param {Function} persistWhen - Function that returns true if button should stay visible
   */
  static attachPersistentHover(messageElement, button, persistWhen) {
    return this.attachHoverListeners(messageElement, button, {
      persistWhen,
      hideDelay: 0,
      keepVisibleOnButtonHover: false,
    });
  }

  /**
   * Version for buttons with delay and bounds checking (for emoji markers)
   * @param {HTMLElement} messageElement - The message element
   * @param {HTMLElement} button - The button to show/hide
   * @param {number} hideDelay - Delay before hiding (ms)
   */
  static attachDelayedHover(messageElement, button, hideDelay = 100) {
    return this.attachHoverListeners(messageElement, button, {
      persistWhen: () => false,
      hideDelay,
      keepVisibleOnButtonHover: true,
      checkMessageBounds: true,
    });
  }
}
