/**
 * StorageSync - Cross-tab synchronization via chrome.storage.onChanged
 * Keeps stores synchronized across multiple tabs/windows
 */

export class StorageSync {
  constructor() {
    this.stores = new Map(); // Map of namespace -> store instance
    this.listenerInitialized = false;
  }

  /**
   * Register a store for cross-tab synchronization
   * @param {string} namespace - Store namespace (e.g., 'settings', 'bookmarks')
   * @param {Store} store - Store instance
   */
  registerStore(namespace, store) {
    this.stores.set(namespace, store);
    console.log(`[StorageSync] Registered store: ${namespace}`);
  }

  /**
   * Initialize chrome.storage.onChanged listener
   * Must be called once per extension instance
   */
  initializeListener() {
    if (this.listenerInitialized) {
      console.warn('[StorageSync] Listener already initialized');
      return;
    }

    // Check if chrome storage API is available
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.onChanged) {
      console.warn('[StorageSync] chrome.storage.onChanged not available, cross-tab sync disabled');
      return;
    }

    console.log('[StorageSync] Initializing chrome.storage.onChanged listener');

    chrome.storage.onChanged.addListener((changes, areaName) => {
      this.handleStorageChange(changes, areaName);
    });

    this.listenerInitialized = true;
    console.log('[StorageSync] Listener initialized for areas: local, sync');
  }

  /**
   * Handle storage changes from other tabs/windows
   * @param {Object} changes - Changes object from chrome.storage.onChanged
   * @param {string} areaName - Storage area name ('local' or 'sync')
   */
  handleStorageChange(changes, areaName) {
    console.log(`[StorageSync] Storage change detected in ${areaName}:`, Object.keys(changes));

    for (const [key, change] of Object.entries(changes)) {
      const store = this.stores.get(key);

      if (!store) {
        // Not a registered store, might be backup or other data
        console.log(`[StorageSync] Change for unregistered key: ${key}`);
        continue;
      }

      // Get new value from change
      const newValue = change.newValue;

      if (!newValue) {
        console.log(`[StorageSync] Store ${key} was cleared`);
        store.invalidateCache();
        store.emit('external-clear');
        continue;
      }

      console.log(`[StorageSync] Updating store ${key} from external change`);

      // Update store's cache and notify subscribers
      try {
        store.onStorageChanged(newValue);
        console.log(`[StorageSync] Store ${key} updated successfully`);
      } catch (error) {
        console.error(`[StorageSync] Failed to update store ${key}:`, error);
      }
    }
  }

  /**
   * Get all registered stores
   */
  getRegisteredStores() {
    return Array.from(this.stores.keys());
  }

  /**
   * Get sync status
   */
  getStatus() {
    return {
      listenerInitialized: this.listenerInitialized,
      registeredStores: Array.from(this.stores.keys()),
      chromeStorageAvailable: typeof chrome !== 'undefined' && !!chrome.storage,
    };
  }
}

// Singleton instance
export const storageSync = new StorageSync();
