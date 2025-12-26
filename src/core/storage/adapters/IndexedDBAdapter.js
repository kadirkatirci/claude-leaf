/**
 * IndexedDBAdapter - IndexedDB implementation
 * Best for: Large data, conversation states, folding states
 * Quota: Unlimited (with unlimitedStorage permission)
 *
 * Uses a simple key-value store pattern:
 * - Database: 'claude-productivity'
 * - Object Store: 'keyvalue'
 * - Index: key (unique)
 */

import { BaseAdapter } from './BaseAdapter.js';

export class IndexedDBAdapter extends BaseAdapter {
  constructor() {
    super();
    this.dbName = 'claude-productivity';
    this.dbVersion = 1;
    this.storeName = 'keyvalue';
    this.db = null;
  }

  /**
   * Initialize database connection
   */
  async init() {
    if (this.db) {
      return this.db;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        reject(new Error(`Failed to open IndexedDB: ${request.error}`));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = event => {
        const db = event.target.result;

        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(this.storeName)) {
          const objectStore = db.createObjectStore(this.storeName, { keyPath: 'key' });
          objectStore.createIndex('key', 'key', { unique: true });
        }
      };
    });
  }

  /**
   * Get transaction
   */
  async getTransaction(mode = 'readonly') {
    const db = await this.init();
    return db.transaction([this.storeName], mode);
  }

  /**
   * Get object store
   */
  async getObjectStore(mode = 'readonly') {
    const transaction = await this.getTransaction(mode);
    return transaction.objectStore(this.storeName);
  }

  /**
   * Get value by key
   */
  async get(key) {
    try {
      const objectStore = await this.getObjectStore('readonly');

      return new Promise((resolve, reject) => {
        const request = objectStore.get(key);

        request.onsuccess = () => {
          const result = request.result;
          resolve(result ? result.value : undefined);
        };

        request.onerror = () => {
          reject(new Error(`Failed to get key "${key}": ${request.error}`));
        };
      });
    } catch (error) {
      console.error('[IndexedDBAdapter] get() failed:', error);
      return undefined;
    }
  }

  /**
   * Set value for key
   */
  async set(key, value) {
    try {
      const objectStore = await this.getObjectStore('readwrite');

      return new Promise((resolve, reject) => {
        const request = objectStore.put({ key, value });

        request.onsuccess = () => {
          resolve();
        };

        request.onerror = () => {
          reject(new Error(`Failed to set key "${key}": ${request.error}`));
        };
      });
    } catch (error) {
      console.error('[IndexedDBAdapter] set() failed:', error);
      throw error;
    }
  }

  /**
   * Remove value by key
   */
  async remove(key) {
    try {
      const objectStore = await this.getObjectStore('readwrite');

      return new Promise((resolve, reject) => {
        const request = objectStore.delete(key);

        request.onsuccess = () => {
          resolve();
        };

        request.onerror = () => {
          reject(new Error(`Failed to remove key "${key}": ${request.error}`));
        };
      });
    } catch (error) {
      console.error('[IndexedDBAdapter] remove() failed:', error);
      throw error;
    }
  }

  /**
   * Clear all data
   */
  async clear() {
    try {
      const objectStore = await this.getObjectStore('readwrite');

      return new Promise((resolve, reject) => {
        const request = objectStore.clear();

        request.onsuccess = () => {
          resolve();
        };

        request.onerror = () => {
          reject(new Error(`Failed to clear store: ${request.error}`));
        };
      });
    } catch (error) {
      console.error('[IndexedDBAdapter] clear() failed:', error);
      throw error;
    }
  }

  /**
   * Get all keys
   */
  async keys() {
    try {
      const objectStore = await this.getObjectStore('readonly');

      return new Promise((resolve, reject) => {
        const request = objectStore.getAllKeys();

        request.onsuccess = () => {
          resolve(request.result || []);
        };

        request.onerror = () => {
          reject(new Error(`Failed to get keys: ${request.error}`));
        };
      });
    } catch (error) {
      console.error('[IndexedDBAdapter] keys() failed:', error);
      return [];
    }
  }

  /**
   * Get all values
   */
  async getAll() {
    try {
      const objectStore = await this.getObjectStore('readonly');

      return new Promise((resolve, reject) => {
        const request = objectStore.getAll();

        request.onsuccess = () => {
          const result = request.result || [];
          // Convert to key-value map
          const map = {};
          result.forEach(item => {
            map[item.key] = item.value;
          });
          resolve(map);
        };

        request.onerror = () => {
          reject(new Error(`Failed to get all values: ${request.error}`));
        };
      });
    } catch (error) {
      console.error('[IndexedDBAdapter] getAll() failed:', error);
      return {};
    }
  }

  /**
   * Get storage info
   */
  async getInfo() {
    try {
      // Get storage estimate (Chrome 52+)
      if (navigator.storage && navigator.storage.estimate) {
        const estimate = await navigator.storage.estimate();

        return {
          type: 'IndexedDBAdapter',
          available: true,
          quota: estimate.quota || 'unlimited',
          usage: estimate.usage || 0,
          usagePercent: estimate.quota
            ? (((estimate.usage || 0) / estimate.quota) * 100).toFixed(2) + '%'
            : 'N/A',
          isPersisted: (await navigator.storage?.persisted?.()) || false,
        };
      }

      return {
        type: 'IndexedDBAdapter',
        available: true,
        quota: 'unlimited',
        usage: 0,
      };
    } catch (error) {
      console.error('[IndexedDBAdapter] getInfo() failed:', error);
      return {
        type: 'IndexedDBAdapter',
        available: true,
        error: error.message,
      };
    }
  }

  /**
   * Request persistent storage (prevents data eviction)
   */
  async requestPersistentStorage() {
    if (navigator.storage && navigator.storage.persist) {
      const isPersisted = await navigator.storage.persist();
      console.log(`[IndexedDBAdapter] Persistent storage: ${isPersisted ? 'granted' : 'denied'}`);
      return isPersisted;
    }
    return false;
  }

  /**
   * Close database connection
   */
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}
