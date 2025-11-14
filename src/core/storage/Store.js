/**
 * Store - Namespace-based state container
 * Provides caching, validation, migrations, and reactivity
 */

import { EventEmitter } from '../EventEmitter.js';

export class Store extends EventEmitter {
  constructor(namespace, options = {}) {
    super();

    this.namespace = namespace;
    this.adapter = options.adapter;
    this.schema = options.schema;
    this.version = options.version || 1;
    this.defaultData = options.defaultData || {};

    // Cache configuration
    this.cache = null;
    this.cacheTimestamp = null;
    this.cacheTTL = options.cacheTTL || 5000; // 5 seconds default
    this.cacheEnabled = options.cache !== false;

    // Promise deduplication (prevent concurrent loads)
    this.loadingPromise = null;

    // Debug mode
    this.debug = options.debug || false;
  }

  /**
   * Log debug message
   */
  log(...args) {
    if (this.debug) {
      console.log(`[Store:${this.namespace}]`, ...args);
    }
  }

  /**
   * Check if cache is valid
   */
  isCacheValid() {
    if (!this.cacheEnabled || !this.cache) return false;
    if (!this.cacheTimestamp) return false;

    const age = Date.now() - this.cacheTimestamp;
    return age < this.cacheTTL;
  }

  /**
   * Invalidate cache
   */
  invalidateCache() {
    this.cache = null;
    this.cacheTimestamp = null;
    this.log('Cache invalidated');
  }

  /**
   * Get state (with cache and promise deduplication)
   * @param {string} [key] - Optional key for nested access
   * @returns {Promise<any>}
   */
  async get(key = null) {
    // Check cache first
    if (this.isCacheValid()) {
      this.log('Cache hit');
      return key ? this.cache[key] : this.cache;
    }

    this.log('Cache miss, loading from adapter');

    // Deduplicate concurrent load requests
    if (!this.loadingPromise) {
      this.log('Starting new load from adapter');
      this.loadingPromise = this.loadFromAdapter().finally(() => {
        this.loadingPromise = null;
      });
    } else {
      this.log('Reusing existing load promise');
    }

    try {
      const data = await this.loadingPromise;
      return key ? data[key] : data;
    } catch (error) {
      console.error(`[Store:${this.namespace}] Failed to get data:`, error);
      // Return default data on error
      const defaultData = this.createDefaultData();
      return key ? defaultData[key] : defaultData;
    }
  }

  /**
   * Load data from adapter (extracted for promise deduplication)
   */
  async loadFromAdapter() {
    try {
      // Load from adapter
      let data = await this.adapter.get(this.namespace);

      // If no data exists, use default
      if (!data) {
        data = this.createDefaultData();
      }

      // Ensure metadata exists
      if (!data.__meta) {
        data.__meta = {
          version: this.version,
          createdAt: new Date().toISOString()
        };
      }

      // Validate schema
      data = this.validate(data);

      // Update cache
      if (this.cacheEnabled) {
        this.cache = data;
        this.cacheTimestamp = Date.now();
      }

      return data;
    } catch (error) {
      console.error(`[Store:${this.namespace}] Failed to load from adapter:`, error);
      throw error;
    }
  }

  /**
   * Set state (with validation and reactivity)
   * @param {string|Object} keyOrData - Key name or full data object
   * @param {*} [value] - Value (if keyOrData is a key)
   * @returns {Promise<any>}
   */
  async set(keyOrData, value = undefined) {
    try {
      const current = await this.get();

      let updated;
      if (typeof keyOrData === 'object' && value === undefined) {
        // Full update: set({ bookmarks: [...] })
        updated = { ...current, ...keyOrData };
      } else {
        // Partial update: set('bookmarks', [...])
        updated = { ...current, [keyOrData]: value };
      }

      // Validate
      updated = this.validate(updated);

      // Ensure metadata
      if (!updated.__meta) {
        updated.__meta = { version: this.version };
      }
      updated.__meta.updatedAt = new Date().toISOString();

      // Save to adapter
      await this.adapter.set(this.namespace, updated);

      // Update cache
      if (this.cacheEnabled) {
        this.cache = updated;
        this.cacheTimestamp = Date.now();
      }

      this.log('State updated');

      // Emit change event
      this.emit('change', updated);

      return updated;
    } catch (error) {
      console.error(`[Store:${this.namespace}] Failed to set data:`, error);
      throw error;
    }
  }

  /**
   * Update with callback (atomic operation)
   * @param {Function} updater - Function that receives current state and returns new state
   * @returns {Promise<any>}
   */
  async update(updater) {
    const current = await this.get();
    const updated = updater(current);
    return this.set(updated);
  }

  /**
   * Clear store
   */
  async clear() {
    try {
      await this.adapter.remove(this.namespace);
      this.invalidateCache();
      this.log('Store cleared');
      this.emit('clear');
    } catch (error) {
      console.error(`[Store:${this.namespace}] Failed to clear:`, error);
      throw error;
    }
  }

  /**
   * Reset to default data
   */
  async reset() {
    const defaultData = this.createDefaultData();
    return this.set(defaultData);
  }

  /**
   * Subscribe to changes
   * @param {Function} callback - Called when state changes
   * @returns {Function} - Unsubscribe function
   */
  subscribe(callback) {
    return this.on('change', callback);
  }

  /**
   * Create default data with metadata
   */
  createDefaultData() {
    return {
      __meta: {
        version: this.version,
        createdAt: new Date().toISOString()
      },
      ...this.defaultData
    };
  }


  /**
   * Validate data against schema
   */
  validate(data) {
    if (!this.schema) return data;

    // Simple validation (can be extended with Zod/Yup if needed)
    // For now, just return data as-is
    // TODO: Implement schema validation if needed
    return data;
  }

  /**
   * Export data
   */
  async export() {
    const data = await this.get();

    return {
      type: this.namespace,
      version: this.version,
      timestamp: new Date().toISOString(),
      data
    };
  }

  /**
   * Import data (with merge option)
   * @param {Object} importData - Exported data object
   * @param {boolean} [merge=true] - Merge with existing data or replace
   */
  async import(importData, merge = true) {
    try {
      const { data, version } = importData;

      if (merge) {
        const current = await this.get();
        const merged = this.mergeImport(current, data);
        return this.set(merged);
      } else {
        return this.set(data);
      }
    } catch (error) {
      console.error(`[Store:${this.namespace}] Import failed:`, error);
      throw error;
    }
  }

  /**
   * Merge imported data with current data
   * Override this method in specific stores for custom merge logic
   */
  mergeImport(current, imported) {
    // Default: shallow merge, imported data takes precedence
    return { ...current, ...imported };
  }

  /**
   * Get storage info
   */
  async getStorageInfo() {
    return this.adapter.getInfo();
  }

  /**
   * Change adapter (e.g., switch from local to sync)
   * @param {BaseAdapter} newAdapter - New adapter instance
   * @param {boolean} [migrateData=true] - Migrate data to new adapter
   */
  async changeAdapter(newAdapter, migrateData = true) {
    if (migrateData) {
      // Load data from current adapter
      const data = await this.get();

      // Switch adapter
      this.adapter = newAdapter;

      // Save data to new adapter
      await this.set(data);

      this.log('Adapter changed and data migrated');
    } else {
      this.adapter = newAdapter;
      this.invalidateCache();
      this.log('Adapter changed');
    }
  }

  /**
   * Handle external storage changes (from other tabs/windows)
   * Used for cross-tab synchronization via chrome.storage.onChanged
   */
  onStorageChanged(newData) {
    this.log('External storage change detected');

    // Validate the new data
    if (newData && typeof newData === 'object') {
      // Update cache
      if (this.cacheEnabled) {
        this.cache = newData;
        this.cacheTimestamp = Date.now();
      }

      // Emit change event to notify subscribers
      this.emit('external-change', newData);
    }
  }
}
