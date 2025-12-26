/**
 * EditUI - UI components (highlights)
 */
import DOMUtils from '../../utils/DOMUtils.js';

class EditUI {
  constructor(getTheme, onButtonClick, onCollapseAllClick) {
    this.getTheme = getTheme;
    this.onButtonClick = onButtonClick;
    this.onCollapseAllClick = onCollapseAllClick;
    this.lastHighlightedElements = new Set(); // Track highlighted elements
  }

  /**
   * Highlight'ları güncelle
   * Only updates DOM if highlighted elements actually changed
   */
  updateHighlights(editedPrompts, shouldHighlight) {
    if (!shouldHighlight) {
      // Remove all highlights if disabled
      if (this.lastHighlightedElements.size > 0) {
        this.lastHighlightedElements.forEach(el => {
          el.classList.remove('claude-edit-highlighted');
        });
        this.lastHighlightedElements.clear();
      }
      return;
    }

    const currentElements = new Set(editedPrompts.map(e => e.element));

    // Check if highlighted elements changed
    const elementsChanged =
      currentElements.size !== this.lastHighlightedElements.size ||
      [...currentElements].some(el => !this.lastHighlightedElements.has(el));

    if (!elementsChanged) {
      return; // Nothing changed, skip DOM updates
    }

    // Remove highlights from elements that are no longer edited
    this.lastHighlightedElements.forEach(el => {
      if (!currentElements.has(el)) {
        el.classList.remove('claude-edit-highlighted');
      }
    });

    // Add highlights to new edited elements
    currentElements.forEach(el => {
      if (!this.lastHighlightedElements.has(el)) {
        el.classList.add('claude-edit-highlighted');
      }
    });

    this.lastHighlightedElements = currentElements;
  }
}

export default EditUI;
