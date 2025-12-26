/**
 * ExpandButton - Expand/Collapse button UI
 * Refactored to use only Claude native classes
 */
import DOMUtils from '../../utils/DOMUtils.js';
import IconLibrary from '../../components/primitives/IconLibrary.js';

class ExpandButton {
  constructor(getTheme, onToggle) {
    this.getTheme = getTheme;
    this.onToggle = onToggle;
  }

  /**
   * Create expand button
   */
  create(messageElement, isCollapsed) {
    // Button container (will be added next to edit button)
    const container = DOMUtils.createElement('div');
    container.className = 'claude-expand-button-container inline-flex gap-2';

    const button = DOMUtils.createElement('button');
    // Use collapse icon when expanded (shows what action will happen)
    // Use expand icon when collapsed (shows what action will happen)
    button.innerHTML = isCollapsed
      ? IconLibrary.expand('currentColor', 12) // Reduced icon size
      : IconLibrary.collapse('currentColor', 16); // Reduced icon size

    // Match navigation button style (compact, icon-only) - half size
    button.className =
      'claude-expand-btn size-5 inline-flex items-center justify-center border-0.5 overflow-hidden !rounded-full p-0.5 shadow-sm hover:shadow-md bg-bg-000/80 hover:bg-bg-000 backdrop-blur transition-all duration-200 border-border-300 cursor-pointer hover:scale-110';

    // Add tooltip
    button.title = isCollapsed ? 'Expand message' : 'Collapse message';

    // Click handler
    button.addEventListener('click', e => {
      e.stopPropagation();
      this.onToggle(messageElement);
      // Note: Button text will be updated in onMessageStateChanged
    });

    container.appendChild(button);
    return container;
  }

  /**
   * Insert expand button below the message
   */
  insertNextToEditButton(messageElement, expandButton) {
    // First remove existing button (if any)
    this.remove(messageElement);

    // Find target container for the message
    let targetContainer = messageElement;

    // If message is inside a wrapper, use the wrapper
    if (messageElement.parentElement?.classList.contains('claude-message-collapsed')) {
      targetContainer = messageElement.parentElement;
    }

    // Create separate footer for all messages (consistent appearance)
    const footer = DOMUtils.createElement('div');
    footer.className = 'claude-expand-footer mt-3 flex justify-start pl-2';
    footer.appendChild(expandButton);

    // Add right after the message (outside wrapper)
    if (targetContainer.parentElement) {
      targetContainer.parentElement.insertBefore(footer, targetContainer.nextSibling);
    } else {
      targetContainer.appendChild(footer);
    }
  }

  /**
   * Remove button
   */
  remove(messageElement) {
    // Find message container
    let current = messageElement;
    if (messageElement.parentElement?.classList.contains('claude-message-collapsed')) {
      current = messageElement.parentElement;
    }

    // Find and remove footer
    const nextSibling = current.nextElementSibling;
    if (nextSibling?.classList.contains('claude-expand-footer')) {
      nextSibling.remove();
    }
  }
}

export default ExpandButton;
