/**
 * DataService - Centralized data export/import/clear for popup
 * Reads store configurations from shared/storeConfig.json
 * This ensures popup and content script use the same store definitions
 *
 * IMPORTANT: For IndexedDB stores, popup sends messages to content script
 * because popup runs in extension context while IndexedDB is in page context
 */

const DataService = {
  // Will be loaded from storeConfig.json
  storeConfig: null,

  /**
   * Initialize by loading store config
   */
  async init() {
    if (this.storeConfig) {
      return this.storeConfig;
    }

    try {
      // storeConfig.json is copied to popup/ folder during build
      const response = await fetch('./storeConfig.json');
      if (!response.ok) {
        throw new Error('Failed to load storeConfig.json');
      }
      this.storeConfig = await response.json();
      console.log('[DataService] Store config loaded:', Object.keys(this.storeConfig.stores));
      return this.storeConfig;
    } catch (error) {
      console.error('[DataService] Failed to load store config:', error);
      throw error;
    }
  },

  /**
   * Get store configuration
   */
  getStoreConfig(storeId) {
    if (!this.storeConfig) {
      throw new Error('DataService not initialized. Call init() first.');
    }
    return this.storeConfig.stores[storeId];
  },

  /**
   * Get all exportable stores
   */
  getExportableStores() {
    if (!this.storeConfig) {
      return [];
    }
    return Object.entries(this.storeConfig.stores)
      .filter(([, config]) => config.exportable)
      .map(([id, config]) => ({ id, ...config }));
  },

  /**
   * Get storage API based on type
   */
  getStorage(type) {
    return type === 'sync' ? chrome.storage.sync : chrome.storage.local;
  },

  /**
   * Send message to content script and get response
   * Used for IndexedDB operations since popup can't access page's IndexedDB
   */
  async sendToContentScript(message) {
    return new Promise((resolve, reject) => {
      chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
        if (!tabs[0]) {
          reject(new Error('No active tab found'));
          return;
        }

        chrome.tabs.sendMessage(tabs[0].id, message, response => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          if (response?.error) {
            reject(new Error(response.error));
            return;
          }
          resolve(response);
        });
      });
    });
  },

  /**
   * Read data from a store
   */
  async readStore(storeId) {
    const config = this.getStoreConfig(storeId);
    if (!config) {
      throw new Error(`Unknown store: ${storeId}`);
    }

    // For IndexedDB stores, request data from content script
    if (config.storageType === 'indexeddb') {
      try {
        const response = await this.sendToContentScript({
          type: 'STORE_READ',
          storeId,
        });
        return response?.data || null;
      } catch (error) {
        console.warn(`[DataService] Failed to read ${storeId} from content script:`, error);
        return null;
      }
    }

    // For chrome.storage, read directly
    const storage = this.getStorage(config.storageType);
    const result = await storage.get([storeId]);
    return result[storeId] || null;
  },

  /**
   * Write data to a store
   */
  async writeStore(storeId, data) {
    const config = this.getStoreConfig(storeId);
    if (!config) {
      throw new Error(`Unknown store: ${storeId}`);
    }

    // Ensure __meta exists
    if (!data.__meta) {
      data.__meta = {
        version: config.version,
        createdAt: new Date().toISOString(),
      };
    }
    data.__meta.updatedAt = new Date().toISOString();

    // For IndexedDB stores, send to content script
    if (config.storageType === 'indexeddb') {
      await this.sendToContentScript({
        type: 'STORE_WRITE',
        storeId,
        data,
      });
      return;
    }

    // For chrome.storage, write directly
    const storage = this.getStorage(config.storageType);
    await storage.set({ [storeId]: data });
  },

  /**
   * Clear a store (reset to defaults or remove)
   */
  async clearStore(storeId, resetToDefaults = false) {
    const config = this.getStoreConfig(storeId);
    if (!config) {
      throw new Error(`Unknown store: ${storeId}`);
    }

    if (resetToDefaults && config.defaultData) {
      await this.writeStore(storeId, { ...config.defaultData });
      return;
    }

    // For IndexedDB stores, send to content script
    if (config.storageType === 'indexeddb') {
      await this.sendToContentScript({
        type: 'STORE_CLEAR',
        storeId,
      });
      return;
    }

    // For chrome.storage, remove directly
    const storage = this.getStorage(config.storageType);
    await storage.remove([storeId]);
  },

  /**
   * Export selected stores
   * @param {string[]} storeIds - Array of store IDs to export
   * @param {Object} currentSettings - Current settings from popup (for settings export)
   * @returns {Object} Export data object
   */
  async exportData(storeIds, currentSettings = null) {
    await this.init();

    const exportData = {
      __export: {
        version: 2,
        timestamp: new Date().toISOString(),
        source: 'claude-productivity-extension',
      },
    };

    for (const storeId of storeIds) {
      const config = this.getStoreConfig(storeId);
      if (!config || !config.exportable) {
        continue;
      }

      if (storeId === 'settings' && currentSettings) {
        exportData.settings = currentSettings;
        continue;
      }

      const data = await this.readStore(storeId);
      if (data) {
        // Export full store data (including all nested properties)
        const { __meta, ...storeData } = data;
        exportData[storeId] = {
          version: __meta?.version || config.version,
          ...storeData,
        };
      }
    }

    return exportData;
  },

  /**
   * Import data with merge support
   * @param {Object} importData - Data to import
   * @param {boolean} merge - Whether to merge with existing data
   * @returns {Object} Import result { success, imported, skipped, errors }
   */
  async importData(importData, merge = true) {
    await this.init();

    const result = {
      success: true,
      imported: {},
      skipped: {},
      errors: [],
    };

    // Detect format: new format has __export, old format is flat
    const isNewFormat = !!importData.__export;

    for (const [key, value] of Object.entries(importData)) {
      // Skip metadata
      if (key === '__export') {
        continue;
      }

      try {
        if (key === 'settings') {
          // Settings import handled separately by popup
          result.imported.settings = true;
          continue;
        }

        // Map old keys to store IDs
        const storeId = this.mapKeyToStoreId(key);
        if (!storeId) {
          result.skipped[key] = 'Unknown data type';
          continue;
        }

        const config = this.getStoreConfig(storeId);
        if (!config) {
          result.skipped[key] = 'Store not configured';
          continue;
        }

        await this.importStore(storeId, value, merge, isNewFormat, result);
      } catch (error) {
        result.errors.push({ key, error: error.message });
        result.success = false;
      }
    }

    return result;
  },

  /**
   * Map export keys to store IDs (handles both old and new formats)
   */
  mapKeyToStoreId(key) {
    const keyMap = {
      bookmarks: 'bookmarks',
      markers: 'markers',
      emojiMarkers: 'markers', // Old format compatibility
      editHistory: 'editHistory',
      history: 'editHistory', // Old format compatibility
    };
    return keyMap[key] || null;
  },

  /**
   * Import data into a specific store
   */
  async importStore(storeId, importValue, merge, isNewFormat, result) {
    const config = this.getStoreConfig(storeId);
    const current = (await this.readStore(storeId)) || { ...config.defaultData };

    // Normalize import data based on format
    let normalized;
    if (isNewFormat && typeof importValue === 'object') {
      // New format: { version: 2, bookmarks: [...], categories: [...] }
      // Remove version field, keep rest
      const { version: _v, ...data } = importValue;
      void _v; // Explicitly mark as intentionally unused
      normalized = data;
    } else {
      // Old format: direct array
      normalized = this.normalizeOldFormat(storeId, importValue, config);
    }

    if (merge) {
      const merged = this.mergeStoreData(storeId, current, normalized);
      await this.writeStore(storeId, merged);
      result.imported[storeId] = this.countItems(storeId, normalized);
    } else {
      await this.writeStore(storeId, normalized);
      result.imported[storeId] = this.countItems(storeId, normalized);
    }
  },

  /**
   * Normalize old export format to new structure
   */
  normalizeOldFormat(storeId, data, config) {
    // Old format was just the array directly
    if (Array.isArray(data)) {
      // Use defaultData structure from config
      const normalized = { ...config.defaultData };

      // Find the main array field and set it
      switch (storeId) {
        case 'bookmarks':
          normalized.bookmarks = data;
          break;
        case 'markers':
          normalized.markers = data;
          break;
        case 'editHistory':
          normalized.history = data;
          break;
        default:
          return data;
      }
      return normalized;
    }
    return data;
  },

  /**
   * Merge imported data with existing data
   */
  mergeStoreData(storeId, current, imported) {
    switch (storeId) {
      case 'bookmarks':
        return this.mergeBookmarks(current, imported);
      case 'markers':
        return this.mergeMarkers(current, imported);
      case 'editHistory':
        return this.mergeEditHistory(current, imported);
      default:
        return { ...current, ...imported };
    }
  },

  mergeBookmarks(current, imported) {
    const existingIds = new Set((current.bookmarks || []).map(b => b.id));
    const existingCatIds = new Set((current.categories || []).map(c => c.id));

    const newBookmarks = (imported.bookmarks || []).filter(b => !existingIds.has(b.id));
    const newCategories = (imported.categories || []).filter(
      c => !existingCatIds.has(c.id) && !c.isDefault
    );

    return {
      bookmarks: [...(current.bookmarks || []), ...newBookmarks],
      categories: [...(current.categories || []), ...newCategories],
    };
  },

  mergeMarkers(current, imported) {
    const existingIds = new Set((current.markers || []).map(m => m.id));
    const newMarkers = (imported.markers || []).filter(m => !existingIds.has(m.id));

    return {
      markers: [...(current.markers || []), ...newMarkers],
    };
  },

  mergeEditHistory(current, imported) {
    const existingHistoryIds = new Set((current.history || []).map(h => h.id));
    const existingSnapshotIds = new Set((current.snapshots || []).map(s => s.id));

    const newHistory = (imported.history || []).filter(h => !existingHistoryIds.has(h.id));
    const newSnapshots = (imported.snapshots || []).filter(s => !existingSnapshotIds.has(s.id));

    return {
      history: [...(current.history || []), ...newHistory],
      snapshots: [...(current.snapshots || []), ...newSnapshots],
    };
  },

  /**
   * Count items in store data for reporting
   */
  countItems(storeId, data) {
    switch (storeId) {
      case 'bookmarks':
        return (data.bookmarks || []).length;
      case 'markers':
        return (data.markers || []).length;
      case 'editHistory':
        return (data.history || []).length + (data.snapshots || []).length;
      default:
        return 0;
    }
  },

  /**
   * Get storage statistics
   */
  async getStorageStats() {
    await this.init();
    const stats = {};

    for (const storeId of Object.keys(this.storeConfig.stores)) {
      const data = await this.readStore(storeId);
      stats[storeId] = {
        exists: !!data,
        itemCount: data ? this.countItems(storeId, data) : 0,
        version: data?.__meta?.version || null,
        lastUpdated: data?.__meta?.updatedAt || null,
      };
    }

    // Get storage usage
    if (chrome.storage.local.getBytesInUse) {
      stats.localBytesUsed = await new Promise(resolve => {
        chrome.storage.local.getBytesInUse(null, resolve);
      });
    }

    if (chrome.storage.sync.getBytesInUse) {
      stats.syncBytesUsed = await new Promise(resolve => {
        chrome.storage.sync.getBytesInUse(null, resolve);
      });
    }

    return stats;
  },
};

// Make available globally for popup.js
window.DataService = DataService;
