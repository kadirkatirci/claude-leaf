/**
 * EditScanner - Edit tarama ve tespit mantığı
 */
import DOMUtils from '../../utils/DOMUtils.js';

class EditScanner {
  constructor(onEditFound) {
    this.onEditFound = onEditFound;
    this.observer = null;
    this.observerTimeout = null;
    this.lastCount = 0;
    this.lastEditIds = new Set(); // Track edit IDs to detect actual changes
  }

  /**
   * Start continuous scanning mode
   * Uses DOM observer only - no polling needed
   */
  start() {
    // 1. Initial scan
    setTimeout(() => this.scan(), 100);

    // 2. DOM observer (event-driven, no polling)
    this.observer = DOMUtils.observeDOM(() => {
      clearTimeout(this.observerTimeout);
      this.observerTimeout = setTimeout(() => this.scan(), 1000);
    });

    console.log('[EditScanner] ➡️ Continuous scanning started (event-driven)');
  }

  /**
   * Edit'leri tara
   * Only calls onEditFound if edits actually changed
   */
  scan() {
    const editedPrompts = DOMUtils.getEditedPrompts();

    // Create ID set for comparison
    const currentIds = new Set(editedPrompts.map(e => e.containerId));

    // Check if edits changed
    const idsChanged =
      currentIds.size !== this.lastEditIds.size ||
      [...currentIds].some(id => !this.lastEditIds.has(id));

    // Only notify if edits actually changed
    if (idsChanged) {
      this.lastCount = editedPrompts.length;
      this.lastEditIds = currentIds;
      this.onEditFound(editedPrompts);
    }
  }

  /**
   * Stop scanning
   */
  stop() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    if (this.observerTimeout) {
      clearTimeout(this.observerTimeout);
    }

    console.log('[EditScanner] 🛑 Scanning stopped');
  }
}

export default EditScanner;
