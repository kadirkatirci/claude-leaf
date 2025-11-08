/**
 * BaseStorage - Abstract base class for storage operations
 * Provides common storage functionality for Chrome extensions
 */

export default class BaseStorage {
  constructor(storageKey, defaultData = {}) {
    this.storageKey = storageKey;
    this.defaultData = defaultData;
    this.cache = null;
    this.storageType = 'local'; // 'local' or 'sync'
  }

  /**
   * Get the Chrome storage API with proper fallback
   */
  getStorageAPI() {
    if (typeof chrome === 'undefined' || !chrome.storage) {
      console.warn('[BaseStorage] Chrome storage API unavailable, using localStorage fallback');
      return this.createLocalStorageFallback();
    }
    return chrome.storage[this.storageType];
  }

  /**
   * Create localStorage fallback with proper error handling
   */
  createLocalStorageFallback() {
    return {
      get: (key) => {
        try {
          const data = localStorage.getItem(key);
          return Promise.resolve({ [key]: data ? JSON.parse(data) : {} });
        } catch (error) {
          console.error('[BaseStorage] localStorage.getItem failed:', error);
          return Promise.reject(new Error(`Failed to read from localStorage: ${error.message}`));
        }
      },
      set: (data) => {
        try {
          const key = Object.keys(data)[0];
          const value = Object.values(data)[0];
          localStorage.setItem(key, JSON.stringify(value));
          return Promise.resolve();
        } catch (error) {
          console.error('[BaseStorage] localStorage.setItem failed:', error);
          // Check for quota exceeded error
          if (error.name === 'QuotaExceededError') {
            return Promise.reject(new Error('Storage quota exceeded. Please free up space.'));
          }
          return Promise.reject(new Error(`Failed to write to localStorage: ${error.message}`));
        }
      },
      remove: (key) => {
        try {
          localStorage.removeItem(key);
          return Promise.resolve();
        } catch (error) {
          console.error('[BaseStorage] localStorage.removeItem failed:', error);
          return Promise.reject(new Error(`Failed to remove from localStorage: ${error.message}`));
        }
      }
    };
  }

  /**
   * Set storage type (local or sync)
   */
  setStorageType(type) {
    if (type === 'local' || type === 'sync') {
      this.storageType = type;
      this.cache = null; // Clear cache when switching storage
    }
  }

  /**
   * Load data from storage with proper error handling
   */
  async load() {
    try {
      const storage = this.getStorageAPI();
      const result = await new Promise((resolve, reject) => {
        storage.get(this.storageKey, (result) => {
          // Check for Chrome runtime errors
          if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve(result);
        });
      });

      const data = result[this.storageKey] || this.defaultData;
      this.cache = data;
      return data;
    } catch (error) {
      console.error(`[BaseStorage] Failed to load ${this.storageKey}:`, error);
      // Return default data as fallback, but log the error
      this.notifyError('load', error);
      return this.defaultData;
    }
  }

  /**
   * Save data to storage with proper error handling
   */
  async save(data) {
    try {
      const storage = this.getStorageAPI();
      await new Promise((resolve, reject) => {
        storage.set({ [this.storageKey]: data }, () => {
          // Check for Chrome runtime errors
          if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve();
        });
      });

      this.cache = data;
      return { success: true };
    } catch (error) {
      console.error(`[BaseStorage] Failed to save ${this.storageKey}:`, error);
      this.notifyError('save', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get all items
   */
  async getAll() {
    const data = await this.load();
    return this.extractItems(data);
  }

  /**
   * Get items for a specific context (e.g., conversation)
   */
  async getForContext(contextId) {
    const data = await this.load();
    return this.filterByContext(data, contextId);
  }

  /**
   * Add a new item
   */
  async add(item) {
    const data = await this.load();

    // Check for duplicates
    if (this.isDuplicate(data, item)) {
      return this.handleDuplicate(data, item);
    }

    // Add the item
    const updatedData = this.addItem(data, item);
    await this.save(updatedData);
    return this.extractItems(updatedData);
  }

  /**
   * Update an existing item
   */
  async update(itemId, updates) {
    const data = await this.load();
    const updatedData = this.updateItem(data, itemId, updates);
    await this.save(updatedData);
    return this.extractItems(updatedData);
  }

  /**
   * Remove an item
   */
  async remove(itemId) {
    const data = await this.load();
    const updatedData = this.removeItem(data, itemId);
    await this.save(updatedData);
    return this.extractItems(updatedData);
  }

  /**
   * Clear all data
   */
  async clear() {
    await this.save(this.defaultData);
    return true;
  }

  /**
   * Export data to JSON
   */
  async export() {
    const data = await this.load();
    const exportData = {
      type: this.storageKey,
      version: '2.0',
      timestamp: new Date().toISOString(),
      data: data
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Import data from JSON
   */
  async import(jsonString) {
    try {
      const importData = JSON.parse(jsonString);

      // Validate import data
      if (!importData.type || importData.type !== this.storageKey) {
        throw new Error('Invalid import data type');
      }

      // Handle version differences
      const data = this.migrateData(importData.data, importData.version);

      // Merge with existing data
      const currentData = await this.load();
      const mergedData = this.mergeData(currentData, data);

      await this.save(mergedData);
      return { success: true, count: this.countItems(mergedData) };
    } catch (error) {
      console.error('[BaseStorage] Import failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get item count
   */
  async getCount(contextId = null) {
    const data = await this.load();

    if (contextId) {
      const filtered = this.filterByContext(data, contextId);
      return filtered.length;
    }

    return this.countItems(data);
  }

  // Abstract methods to implement in subclasses
  extractItems(data) {
    throw new Error('extractItems() must be implemented in subclass');
  }

  filterByContext(data, contextId) {
    throw new Error('filterByContext() must be implemented in subclass');
  }

  isDuplicate(data, item) {
    throw new Error('isDuplicate() must be implemented in subclass');
  }

  handleDuplicate(data, item) {
    throw new Error('handleDuplicate() must be implemented in subclass');
  }

  addItem(data, item) {
    throw new Error('addItem() must be implemented in subclass');
  }

  updateItem(data, itemId, updates) {
    throw new Error('updateItem() must be implemented in subclass');
  }

  removeItem(data, itemId) {
    throw new Error('removeItem() must be implemented in subclass');
  }

  countItems(data) {
    throw new Error('countItems() must be implemented in subclass');
  }

  mergeData(currentData, newData) {
    // Default implementation - override if needed
    return { ...currentData, ...newData };
  }

  migrateData(data, version) {
    // Default implementation - override for version migration
    return data;
  }

  /**
   * Notify error to user/system
   * Override this method to implement custom error notifications
   */
  notifyError(operation, error) {
    // Default implementation - just log
    // Subclasses can override to show user notifications
    console.error(`[BaseStorage] ${operation} operation failed:`, error.message);

    // In the future, could emit event for UI notification:
    // EventBus.emit('storage:error', { operation, error: error.message, storageKey: this.storageKey });
  }
}