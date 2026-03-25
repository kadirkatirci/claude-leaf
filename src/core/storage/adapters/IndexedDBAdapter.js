/**
 * IndexedDBAdapter - IndexedDB implementation
 * Best for: Large data, conversation states, folding states
 * Quota: Unlimited (with unlimitedStorage permission)
 *
 * Uses a simple key-value store pattern:
 * - Database: 'claude-leaf'
 * - Object Store: 'keyvalue'
 * - Index: key (unique)
 */

import { BaseAdapter } from './BaseAdapter.js';
import { STORE_CONFIG } from '../../../config/storeConfig.js';

export class IndexedDBAdapter extends BaseAdapter {
  constructor() {
    super();
    this.dbName = 'claude-leaf';
    this.dbVersion = 2; // Incremented for schema changes
    this.db = null;
  }

  /**
   * Initialize database connection
   */
  init() {
    if (this.db) {
      return Promise.resolve(this.db);
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

        // Iterate through STORE_CONFIG to create object stores
        Object.entries(STORE_CONFIG).forEach(([storeName, config]) => {
          if (config.storageType !== 'indexeddb' || !config.schema) {
            return;
          }

          // Create object store if it doesn't exist
          if (!db.objectStoreNames.contains(storeName)) {
            const objectStore = db.createObjectStore(storeName, {
              keyPath: config.schema.keyPath,
              autoIncrement: config.schema.autoIncrement || false,
            });

            // Create indexes
            if (config.schema.indexes) {
              config.schema.indexes.forEach(idx => {
                objectStore.createIndex(idx.name, idx.keyPath, idx.options);
              });
            }
          } else {
            // If store exists, check for new indexes (simple migration)
            const objectStore = request.transaction.objectStore(storeName);
            if (config.schema.indexes) {
              config.schema.indexes.forEach(idx => {
                if (!objectStore.indexNames.contains(idx.name)) {
                  objectStore.createIndex(idx.name, idx.keyPath, idx.options);
                }
              });
            }
          }
        });

        // Legacy cleanup (optional)
        if (db.objectStoreNames.contains('keyvalue')) {
          db.deleteObjectStore('keyvalue');
        }
      };
    });
  }

  /**
   * Get transaction
   */
  async getTransaction(storeName, mode = 'readonly') {
    const db = await this.init();
    return db.transaction([storeName], mode);
  }

  /**
   * Get object store
   */
  async getObjectStore(storeName, mode = 'readonly') {
    const transaction = await this.getTransaction(storeName, mode);
    return transaction.objectStore(storeName);
  }

  /**
   * Get item by key
   */
  async get(storeName, key) {
    try {
      const objectStore = await this.getObjectStore(storeName, 'readonly');
      return new Promise((resolve, reject) => {
        const request = objectStore.get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error(`[IndexedDB] Get failed for ${storeName}/${key}:`, error);
      throw error;
    }
  }

  /**
   * Add new item (fails if key exists)
   */
  async add(storeName, item) {
    try {
      const objectStore = await this.getObjectStore(storeName, 'readwrite');
      return new Promise((resolve, reject) => {
        const request = objectStore.add(item);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error(`[IndexedDB] Add failed for ${storeName}:`, error);
      throw error;
    }
  }

  /**
   * Put/Update item (overwrites if key exists)
   */
  async put(storeName, item) {
    try {
      const objectStore = await this.getObjectStore(storeName, 'readwrite');
      return new Promise((resolve, reject) => {
        const request = objectStore.put(item);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error(`[IndexedDB] Put failed for ${storeName}:`, error);
      throw error;
    }
  }

  async delete(storeName, key) {
    try {
      const objectStore = await this.getObjectStore(storeName, 'readwrite');
      return new Promise((resolve, reject) => {
        const request = objectStore.delete(key);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error(`[IndexedDB] Delete failed for ${storeName}/${key}:`, error);
      throw error;
    }
  }

  /**
   * Clear all items from store
   */
  async clear(storeName) {
    try {
      const objectStore = await this.getObjectStore(storeName, 'readwrite');
      return new Promise((resolve, reject) => {
        const request = objectStore.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error(`[IndexedDB] Clear failed for ${storeName}:`, error);
      throw error;
    }
  }

  /**
   * Get all items from store
   */
  async getAll(storeName) {
    try {
      const objectStore = await this.getObjectStore(storeName, 'readonly');
      return new Promise((resolve, reject) => {
        const request = objectStore.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error(`[IndexedDB] GetAll failed for ${storeName}:`, error);
      return [];
    }
  }

  /**
   * Get items by index
   */
  async getByIndex(storeName, indexName, value) {
    try {
      const objectStore = await this.getObjectStore(storeName, 'readonly');
      const index = objectStore.index(indexName);
      return new Promise((resolve, reject) => {
        const request = index.getAll(value);
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error(`[IndexedDB] GetByIndex failed for ${storeName}/${indexName}:`, error);
      return [];
    }
  }

  /**
   * Count items
   */
  async count(storeName) {
    try {
      const objectStore = await this.getObjectStore(storeName, 'readonly');
      return new Promise((resolve, reject) => {
        const request = objectStore.count();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      return 0;
    }
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

  /**
   * Get storage info
   */
  async getInfo() {
    if (navigator.storage && navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate();
      return {
        type: 'IndexedDBAdapter',
        quota: estimate.quota,
        usage: estimate.usage,
      };
    }
    return { type: 'IndexedDBAdapter', quota: 'unlimited' };
  }
}
