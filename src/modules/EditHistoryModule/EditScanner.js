/**
 * EditScanner - Edit tarama ve tespit mantığı
 * 
 * Versiyon değişikliklerini tespit eder ve callback'leri çağırır.
 * Diğer modüller (Bookmark, EmojiMarker) onVersionChange callback'i
 * kaydederek versiyon değişikliklerini anında alabilir.
 * 
 * Race Condition Handling:
 * - DOM değişikliği sonrası stabilizasyon için bekleme
 * - Async callback'ler için proper await
 * - Debounce ile çoklu tetiklemeleri önleme
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
    this.lastEditData = new Map();
    this.versionChangeCallbacks = new Set();
    
    // Race condition prevention
    this.isScanning = false;
    this.pendingScan = false;
    this.lastScanTime = 0;
    this.minScanInterval = 150; // Minimum ms between scans

    scannerInstance = this;
  }

  static getInstance() {
    return scannerInstance;
  }

  /**
   * Register a callback for version changes
   * @param {Function} callback - Async function called with change data
   * @returns {Function} Unsubscribe function
   */
  onVersionChange(callback) {
    this.versionChangeCallbacks.add(callback);
    console.log(`[EditScanner] 📝 Callback registered (total: ${this.versionChangeCallbacks.size})`);

    return () => {
      this.versionChangeCallbacks.delete(callback);
    };
  }

  /**
   * Notify all registered callbacks - handles async callbacks properly
   */
  async notifyVersionChange(data) {
    console.log(`[EditScanner] 📡 Notifying ${this.versionChangeCallbacks.size} callbacks`);

    // Execute all callbacks and wait for them
    const promises = [];
    this.versionChangeCallbacks.forEach(callback => {
      try {
        const result = callback(data);
        // If callback returns a promise, track it
        if (result && typeof result.then === 'function') {
          promises.push(result.catch(err => {
            console.error('[EditScanner] Callback error:', err);
          }));
        }
      } catch (error) {
        console.error('[EditScanner] Sync callback error:', error);
      }
    });

    // Wait for all async callbacks to complete
    if (promises.length > 0) {
      await Promise.all(promises);
    }
  }

  /**
   * Start continuous scanning mode
   */
  start() {
    // Initial scan with delay for DOM to be ready
    setTimeout(() => this.scan(), 100);

    // DOM observer with debounce
    this.observer = DOMUtils.observeDOM(() => {
      clearTimeout(this.observerTimeout);
      this.observerTimeout = setTimeout(() => this.scan(), 200);
    });

    console.log('[EditScanner] ➡️ Started');
  }

  /**
   * Scan for edit changes with race condition protection
   */
  async scan() {
    // Prevent concurrent scans
    if (this.isScanning) {
      this.pendingScan = true;
      return;
    }

    // Enforce minimum scan interval
    const now = Date.now();
    const timeSinceLastScan = now - this.lastScanTime;
    if (timeSinceLastScan < this.minScanInterval) {
      clearTimeout(this.observerTimeout);
      this.observerTimeout = setTimeout(() => this.scan(), this.minScanInterval - timeSinceLastScan);
      return;
    }

    this.isScanning = true;
    this.lastScanTime = now;

    try {
      const editedPrompts = DOMUtils.getEditedPrompts();

      // Build current edit data map
      const currentEditData = new Map();
      editedPrompts.forEach(edit => {
        currentEditData.set(edit.containerId, edit.versionInfo);
      });

      // Detect changes
      let hasChanges = false;
      let changeReason = '';
      let isVersionChange = false;

      // Check count change
      if (currentEditData.size !== this.lastEditData.size) {
        hasChanges = true;
        changeReason = `Count: ${this.lastEditData.size} → ${currentEditData.size}`;
      }

      // Check for new containers
      if (!hasChanges) {
        for (const containerId of currentEditData.keys()) {
          if (!this.lastEditData.has(containerId)) {
            hasChanges = true;
            changeReason = `New container: ${containerId}`;
            break;
          }
        }
      }

      // Check for version changes in existing containers
      if (!hasChanges) {
        for (const [containerId, versionInfo] of currentEditData.entries()) {
          const lastVersionInfo = this.lastEditData.get(containerId);
          if (lastVersionInfo !== versionInfo) {
            hasChanges = true;
            isVersionChange = true;
            changeReason = `Version: ${containerId} "${lastVersionInfo}" → "${versionInfo}"`;
            break;
          }
        }
      }

      if (hasChanges) {
        this.lastCount = editedPrompts.length;
        this.lastEditData = currentEditData;

        // Call main callback (sync)
        this.onEditFound(editedPrompts);

        // Wait for DOM to stabilize after version change
        if (isVersionChange) {
          await this.waitForDOMStabilization();
        }

        // Notify all registered callbacks (async)
        console.log(`[EditScanner] 📡 Notifying: ${changeReason}`);
        await this.notifyVersionChange({
          changeReason,
          editCount: editedPrompts.length,
          isVersionChange,
          isAnyChange: true
        });

        console.log(`[EditScanner] ✅ Done: ${changeReason}`);
      }
    } finally {
      this.isScanning = false;

      // Process pending scan if any
      if (this.pendingScan) {
        this.pendingScan = false;
        setTimeout(() => this.scan(), 50);
      }
    }
  }

  /**
   * Wait for DOM to stabilize after a version change
   * Claude may take a moment to render the new content
   */
  async waitForDOMStabilization() {
    return new Promise(resolve => {
      let lastMessageCount = 0;
      let stableCount = 0;
      const maxChecks = 10;
      let checks = 0;

      const checkStability = () => {
        checks++;
        const messages = DOMUtils.findMessages ? DOMUtils.findMessages() : [];
        const currentCount = messages.length;

        if (currentCount === lastMessageCount && currentCount > 0) {
          stableCount++;
          if (stableCount >= 2) {
            // DOM is stable
            resolve();
            return;
          }
        } else {
          stableCount = 0;
        }

        lastMessageCount = currentCount;

        if (checks >= maxChecks) {
          // Timeout - proceed anyway
          resolve();
          return;
        }

        setTimeout(checkStability, 50);
      };

      checkStability();
    });
  }

  stop() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    if (this.observerTimeout) {
      clearTimeout(this.observerTimeout);
    }

    this.versionChangeCallbacks.clear();

    if (scannerInstance === this) {
      scannerInstance = null;
    }

    console.log('[EditScanner] 🛑 Stopped');
  }
}

export default EditScanner;
