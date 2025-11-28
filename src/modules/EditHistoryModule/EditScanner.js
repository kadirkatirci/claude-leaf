/**
 * EditScanner - Edit tarama ve tespit mantığı
 * 
 * Versiyon değişikliklerini tespit eder ve callback'leri çağırır.
 * Diğer modüller (Bookmark, EmojiMarker) onVersionChange callback'i
 * kaydederek versiyon değişikliklerini anında alabilir.
 * 
 * Bu yaklaşım EventBus'tan daha güvenilir çünkü:
 * - Senkron callback çağrısı (async event dispatch değil)
 * - Aynı DOM observer'ı paylaşıyor (duplicate observer yok)
 * - EditHistory ile aynı mekanizma (tutarlılık)
 */
import DOMUtils from '../../utils/DOMUtils.js';

// Singleton instance for shared access
let scannerInstance = null;

class EditScanner {
  constructor(onEditFound) {
    this.onEditFound = onEditFound;
    this.observer = null;
    this.observerTimeout = null;
    this.lastCount = 0;
    // Track both container IDs and version info to detect version changes
    this.lastEditData = new Map(); // Map<containerId, versionInfo>
    
    // Additional callbacks for version changes (used by Bookmark, EmojiMarker)
    this.versionChangeCallbacks = new Set();
    
    // Store singleton reference
    scannerInstance = this;
    console.log('[EditScanner] 🔧 Singleton instance created');
  }
  
  /**
   * Get the singleton scanner instance
   * Other modules can use this to register for version change notifications
   */
  static getInstance() {
    return scannerInstance;
  }
  
  /**
   * Register a callback for version changes
   * @param {Function} callback - Called with {changeReason, editCount} when version changes
   * @returns {Function} Unsubscribe function
   */
  onVersionChange(callback) {
    this.versionChangeCallbacks.add(callback);
    console.log(`[EditScanner] 📝 Version change callback registered (total: ${this.versionChangeCallbacks.size})`);
    
    // Return unsubscribe function
    return () => {
      this.versionChangeCallbacks.delete(callback);
      console.log(`[EditScanner] 📝 Version change callback removed (total: ${this.versionChangeCallbacks.size})`);
    };
  }
  
  /**
   * Notify all registered version change callbacks
   * Called synchronously for immediate response
   */
  notifyVersionChange(data) {
    console.log(`[EditScanner] 📡 Notifying ${this.versionChangeCallbacks.size} version change callbacks`);
    
    this.versionChangeCallbacks.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error('[EditScanner] Error in version change callback:', error);
      }
    });
  }

  /**
   * Start continuous scanning mode
   * Uses DOM observer only - no polling needed
   */
  start() {
    // 1. Initial scan
    setTimeout(() => this.scan(), 100);

    // 2. DOM observer (event-driven, no polling)
    // Reduced throttle to 200ms for faster version change detection
    this.observer = DOMUtils.observeDOM(() => {
      clearTimeout(this.observerTimeout);
      this.observerTimeout = setTimeout(() => this.scan(), 200);
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

    // Build current edit data map: containerId → versionInfo
    const currentEditData = new Map();
    editedPrompts.forEach(edit => {
      currentEditData.set(edit.containerId, edit.versionInfo);
    });

    // Check if anything changed
    let hasChanges = false;
    let changeReason = '';
    let isVersionChange = false;

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

    // 3. Check if version info changed for any existing container
    // THIS IS THE KEY CHECK for version changes (when user clicks edit arrows)
    if (!hasChanges) {
      for (const [containerId, versionInfo] of currentEditData.entries()) {
        const lastVersionInfo = this.lastEditData.get(containerId);
        if (lastVersionInfo !== versionInfo) {
          hasChanges = true;
          isVersionChange = true; // This is specifically a version change!
          changeReason = `Version changed for ${containerId}: "${lastVersionInfo}" → "${versionInfo}"`;
          break;
        }
      }
    }

    // Only notify if edits actually changed
    if (hasChanges) {
      this.lastCount = editedPrompts.length;
      this.lastEditData = currentEditData;
      
      // Call main callback (EditHistoryModule)
      this.onEditFound(editedPrompts);
      
      // If version changed, notify all registered callbacks immediately
      // This is the key for Bookmark and EmojiMarker to update instantly
      if (isVersionChange) {
        console.log(`[EditScanner] 🔄 ${changeReason}`);
        this.notifyVersionChange({
          changeReason,
          editCount: editedPrompts.length,
          isVersionChange: true
        });
      }
      
      console.log(`[EditScanner] ✅ Changes detected: ${changeReason}`);
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
    
    // Clear callbacks
    this.versionChangeCallbacks.clear();
    
    // Clear singleton
    if (scannerInstance === this) {
      scannerInstance = null;
    }

    console.log('[EditScanner] 🛑 Scanning stopped');
  }
}

export default EditScanner;
