/**
 * SimpleArrayStorage - Simple storage for array-based data
 * Provides common storage operations for modules that store arrays
 * (like bookmarks, markers, etc.)
 */

export default class SimpleArrayStorage {
  constructor(storageKey, itemName = 'items') {
    this.storageKey = storageKey;
    this.itemName = itemName; // For logging: 'bookmarks', 'markers', etc.
    this.storageType = 'local'; // 'local' or 'sync'
  }

  /**
   * Get Chrome storage API
   */
  getStorageAPI() {
    const storage = this.storageType === 'sync' ? chrome.storage.sync : chrome.storage.local;
    return storage;
  }

  /**
   * Load items from Chrome storage with error handling
   */
  async load() {
    return new Promise((resolve, reject) => {
      const storage = this.getStorageAPI();
      storage.get([this.storageKey], (result) => {
        // Check for Chrome runtime errors
        if (chrome.runtime && chrome.runtime.lastError) {
          console.error(`[${this.itemName}Storage] Load failed:`, chrome.runtime.lastError);
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        const items = result[this.storageKey] || [];
        console.log(`[${this.itemName}Storage] Loaded ${items.length} ${this.itemName} from ${this.storageType} storage`);
        resolve(items);
      });
    });
  }

  /**
   * Save items to Chrome storage with error handling
   */
  async save(items) {
    return new Promise((resolve, reject) => {
      const storage = this.getStorageAPI();
      storage.set({ [this.storageKey]: items }, () => {
        // Check for Chrome runtime errors
        if (chrome.runtime && chrome.runtime.lastError) {
          console.error(`[${this.itemName}Storage] Save failed:`, chrome.runtime.lastError);
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        console.log(`[${this.itemName}Storage] Saved ${items.length} ${this.itemName} to ${this.storageType} storage`);
        resolve();
      });
    });
  }

  /**
   * Export items to JSON file
   * @param {Array} items - Items to export
   * @returns {Promise<number>} - Number of exported items
   */
  async export(items) {
    try {
      const dataStr = JSON.stringify(items, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);

      const link = document.createElement('a');
      link.href = url;
      link.download = `claude-${this.itemName}-${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      console.log(`[${this.itemName}Storage] Exported ${items.length} ${this.itemName}`);
      return items.length;
    } catch (error) {
      console.error(`[${this.itemName}Storage] Export failed:`, error);
      throw error;
    }
  }

  /**
   * Import items from JSON file with duplicate prevention
   * @param {Array} existingItems - Current items
   * @returns {Promise<Array>} - New items (excluding duplicates)
   */
  async import(existingItems) {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/json';

      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) {
          reject(new Error('No file selected'));
          return;
        }

        const reader = new FileReader();
        reader.onload = async (event) => {
          try {
            const imported = JSON.parse(event.target.result);

            if (!Array.isArray(imported)) {
              throw new Error(`Invalid ${this.itemName} file format`);
            }

            // Merge items (avoid duplicates by ID)
            const existingIds = new Set(existingItems.map(item => item.id));
            const newItems = imported.filter(item => !existingIds.has(item.id));

            console.log(`[${this.itemName}Storage] Imported ${newItems.length} new ${this.itemName}`);
            resolve(newItems);
          } catch (error) {
            console.error(`[${this.itemName}Storage] Import failed:`, error);
            reject(error);
          }
        };

        reader.readAsText(file);
      };

      input.click();
    });
  }

  /**
   * Set storage type (local or sync)
   */
  setStorageType(type) {
    if (type === 'local' || type === 'sync') {
      this.storageType = type;
      console.log(`[${this.itemName}Storage] Storage type set to: ${type}`);
    }
  }

  /**
   * Get current storage type
   */
  getStorageType() {
    return this.storageType;
  }
}
