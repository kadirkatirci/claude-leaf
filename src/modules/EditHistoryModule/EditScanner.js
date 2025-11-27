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
    // Track both container IDs and version info to detect version changes
    this.lastEditData = new Map(); // Map<containerId, versionInfo>
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
   * Calls onEditFound if:
   * - New edited messages added/removed (container ID changes)
   * - Version info changed within existing edited messages (version number changes)
   */
  scan() {
    const editedPrompts = DOMUtils.getEditedPrompts();

    console.log(`[EditScanner] 🔍 Scanning... found ${editedPrompts.length} edited prompts`);

    // Build current edit data map: containerId → versionInfo
    const currentEditData = new Map();
    editedPrompts.forEach(edit => {
      currentEditData.set(edit.containerId, edit.versionInfo);
      console.log(`[EditScanner] 📝 Container: ${edit.containerId}, Version: ${edit.versionInfo}`);
    });

    // Check if anything changed
    let hasChanges = false;
    let changeReason = '';

    // 1. Check if container count changed (new/removed messages)
    if (currentEditData.size !== this.lastEditData.size) {
      hasChanges = true;
      changeReason = `Count changed: ${this.lastEditData.size} → ${currentEditData.size}`;
    }

    // 2. Check if any container ID is new or removed
    if (!hasChanges) {
      for (const containerId of currentEditData.keys()) {
        if (!this.lastEditData.has(containerId)) {
          hasChanges = true;
          changeReason = `New container: ${containerId}`;
          break;
        }
      }
    }

    // 3. Check if version info changed for any existing container (THIS IS THE FIX!)
    if (!hasChanges) {
      for (const [containerId, versionInfo] of currentEditData.entries()) {
        const lastVersionInfo = this.lastEditData.get(containerId);
        console.log(`[EditScanner] 🔎 Comparing ${containerId}: "${lastVersionInfo}" vs "${versionInfo}"`);
        if (lastVersionInfo !== versionInfo) {
          hasChanges = true;
          changeReason = `Version changed for ${containerId}: ${lastVersionInfo} → ${versionInfo}`;
          console.log(`[EditScanner] 🔄 ${changeReason}`);
          break;
        }
      }
    }

    console.log(`[EditScanner] 📊 Has changes: ${hasChanges}${changeReason ? ' - ' + changeReason : ''}`);

    // Only notify if edits actually changed
    if (hasChanges) {
      this.lastCount = editedPrompts.length;
      this.lastEditData = currentEditData;
      this.onEditFound(editedPrompts);
      console.log(`[EditScanner] ✅ Edit changes detected and notified: ${editedPrompts.length} edited messages`);
    } else {
      console.log(`[EditScanner] ⏭️ No changes detected, skipping update`);
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
