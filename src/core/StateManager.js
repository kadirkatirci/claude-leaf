/**
 * StateManager - Global state management system
 * Central registry for all stores with adapter management
 */

import { Store } from './storage/Store.js';
import {
  ChromeLocalAdapter,
  ChromeSyncAdapter,
  IndexedDBAdapter
} from './storage/adapters/index.js';

export class StateManager {
  constructor() {
    this.stores = new Map();
    this.adapters = {
      local: new ChromeLocalAdapter(),
      sync: new ChromeSyncAdapter(),
      indexeddb: new IndexedDBAdapter()
    };

    this.debug = false;
  }

  /**
   * Enable/disable debug mode
   */
  setDebugMode(enabled) {
    this.debug = enabled;
    this.stores.forEach(store => {
      store.debug = enabled;
    });
  }

  /**
   * Create or get a store
   * @param {string} namespace - Store namespace (e.g., 'bookmarks', 'settings')
   * @param {Object} options - Store configuration
   * @returns {Store}
   */
  createStore(namespace, options = {}) {
    // Return existing store if already created
    if (this.stores.has(namespace)) {
      if (this.debug) {
        console.log(`[StateManager] Returning existing store: ${namespace}`);
      }
      return this.stores.get(namespace);
    }

    // Get adapter
    const adapterType = options.adapter || 'local';
    const adapter = this.adapters[adapterType];

    if (!adapter) {
      throw new Error(`Unknown adapter type: ${adapterType}. Valid types: local, sync, indexeddb`);
    }

    // Create store
    const store = new Store(namespace, {
      adapter,
      schema: options.schema,
      version: options.version || 1,
      migrations: options.migrations || {},
      defaultData: options.defaultData || {},
      cacheTTL: options.cacheTTL,
      cache: options.cache,
      debug: this.debug || options.debug
    });

    // Register store
    this.stores.set(namespace, store);

    if (this.debug) {
      console.log(`[StateManager] Created store: ${namespace} (adapter: ${adapterType})`);
    }

    // Connect adapter changes to store if adapter supports it
    if (adapter.setChangeListener) {
      adapter.setChangeListener((changes) => {
        if (changes[namespace]) {
          store.onStorageChanged(changes[namespace]);
        }
      });
    }

    return store;
  }

  /**
   * Get existing store
   * @param {string} namespace - Store namespace
   * @returns {Store|undefined}
   */
  getStore(namespace) {
    return this.stores.get(namespace);
  }

  /**
   * Check if store exists
   * @param {string} namespace - Store namespace
   * @returns {boolean}
   */
  hasStore(namespace) {
    return this.stores.has(namespace);
  }

  /**
   * Delete store
   * @param {string} namespace - Store namespace
   */
  deleteStore(namespace) {
    const store = this.stores.get(namespace);
    if (store) {
      store.removeAllListeners();
      this.stores.delete(namespace);

      if (this.debug) {
        console.log(`[StateManager] Deleted store: ${namespace}`);
      }
    }
  }

  /**
   * Get all store names
   * @returns {string[]}
   */
  getStoreNames() {
    return Array.from(this.stores.keys());
  }

  /**
   * Clear all stores
   */
  async clearAll() {
    const promises = Array.from(this.stores.values()).map(store => store.clear());
    await Promise.all(promises);

    if (this.debug) {
      console.log('[StateManager] All stores cleared');
    }
  }

  /**
   * Get storage info for all adapters
   */
  async getStorageInfo() {
    const info = {};

    for (const [name, adapter] of Object.entries(this.adapters)) {
      try {
        info[name] = await adapter.getInfo();
      } catch (error) {
        info[name] = { error: error.message };
      }
    }

    return info;
  }

  /**
   * Export all stores
   */
  async exportAll() {
    const exports = {};

    for (const [namespace, store] of this.stores) {
      try {
        exports[namespace] = await store.export();
      } catch (error) {
        console.error(`[StateManager] Failed to export ${namespace}:`, error);
        exports[namespace] = { error: error.message };
      }
    }

    return {
      version: '2.0',
      timestamp: new Date().toISOString(),
      stores: exports
    };
  }

  /**
   * Import all stores
   */
  async importAll(importData, merge = true) {
    const { stores } = importData;
    const results = {};

    for (const [namespace, data] of Object.entries(stores)) {
      try {
        const store = this.getStore(namespace);
        if (store) {
          await store.import(data, merge);
          results[namespace] = { success: true };
        } else {
          results[namespace] = { success: false, error: 'Store not found' };
        }
      } catch (error) {
        console.error(`[StateManager] Failed to import ${namespace}:`, error);
        results[namespace] = { success: false, error: error.message };
      }
    }

    return results;
  }

  /**
   * Reset all stores to defaults
   */
  async resetAll() {
    const promises = Array.from(this.stores.values()).map(store => store.reset());
    await Promise.all(promises);

    if (this.debug) {
      console.log('[StateManager] All stores reset to defaults');
    }
  }
}

// Singleton instance
export const stateManager = new StateManager();

// Export for debugging in console
if (typeof window !== 'undefined') {
  window.__stateManager = stateManager;
}
