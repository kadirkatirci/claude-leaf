/**
 * ChromeSyncAdapter - chrome.storage.sync implementation
 * Best for: Settings, small data that should sync across devices
 * Quota: 100KB total, 8KB per item, 512 items max
 */

import { BaseAdapter } from './BaseAdapter.js';

export class ChromeSyncAdapter extends BaseAdapter {
  constructor() {
    super();
    this.storageAPI = this.getStorageAPI();
    this.QUOTA_BYTES = 102400; // 100KB
    this.QUOTA_BYTES_PER_ITEM = 8192; // 8KB
    this.MAX_ITEMS = 512;

    // Listen for changes
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === 'sync') {
          // Convert to simpler format if needed or pass raw
          // Provide callback mechanism via StateManager or direct event
          // Ideally StateManager should inject a callback
          if (this.onChangeListener) {
            // Find which keys changed
            const changedData = {};
            Object.keys(changes).forEach(key => {
              changedData[key] = changes[key].newValue;
            });
            this.onChangeListener(changedData);
          }
        }
      });
    }
  }

  setChangeListener(callback) {
    this.onChangeListener = callback;
  }

  /**
   * Get Chrome storage API with fallback
   */
  getStorageAPI() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      return chrome.storage.sync;
    }

    console.warn(
      '[ChromeSyncAdapter] chrome.storage.sync unavailable, using localStorage fallback'
    );
    return this.createLocalStorageFallback();
  }

  /**
   * Create localStorage fallback for testing/development
   */
  createLocalStorageFallback() {
    const prefix = '__sync__';
    const QUOTA_BYTES_PER_ITEM = 8192; // 8KB - defined here for use in closure

    return {
      get: keys => {
        return new Promise(resolve => {
          const result = {};
          const keyArray = Array.isArray(keys) ? keys : [keys];

          keyArray.forEach(key => {
            try {
              const data = localStorage.getItem(prefix + key);
              result[key] = data ? JSON.parse(data) : undefined;
            } catch (error) {
              console.error(`[ChromeSyncAdapter] localStorage.getItem failed for ${key}:`, error);
              result[key] = undefined;
            }
          });

          resolve(result);
        });
      },
      set: items => {
        return new Promise((resolve, reject) => {
          try {
            Object.entries(items).forEach(([key, value]) => {
              const serialized = JSON.stringify(value);

              // Check size limit (8KB per item)
              if (serialized.length > QUOTA_BYTES_PER_ITEM) {
                throw new Error(`Item "${key}" exceeds 8KB limit (${serialized.length} bytes)`);
              }

              localStorage.setItem(prefix + key, serialized);
            });
            resolve();
          } catch (error) {
            if (error.name === 'QuotaExceededError') {
              reject(new Error('Storage quota exceeded. Please reduce data size.'));
            } else {
              reject(error);
            }
          }
        });
      },
      remove: keys => {
        return new Promise(resolve => {
          const keyArray = Array.isArray(keys) ? keys : [keys];
          keyArray.forEach(key => localStorage.removeItem(prefix + key));
          resolve();
        });
      },
      clear: () => {
        return new Promise(resolve => {
          // Only clear sync-prefixed items
          Object.keys(localStorage)
            .filter(key => key.startsWith(prefix))
            .forEach(key => localStorage.removeItem(key));
          resolve();
        });
      },
      getBytesInUse: keys => {
        return new Promise(resolve => {
          let totalBytes = 0;
          const keyArray =
            keys === null
              ? Object.keys(localStorage).filter(k => k.startsWith(prefix))
              : Array.isArray(keys)
                ? keys
                : [keys];

          keyArray.forEach(key => {
            const fullKey = key.startsWith(prefix) ? key : prefix + key;
            const value = localStorage.getItem(fullKey);
            if (value) {
              totalBytes += value.length;
            }
          });

          resolve(totalBytes);
        });
      },
    };
  }

  /**
   * Check if value exceeds quota
   */
  checkQuota(key, value) {
    const serialized = JSON.stringify(value);
    const bytes = new Blob([serialized]).size;

    if (bytes > this.QUOTA_BYTES_PER_ITEM) {
      throw new Error(
        `Value for key "${key}" exceeds chrome.storage.sync quota per item (${bytes} bytes > ${this.QUOTA_BYTES_PER_ITEM} bytes). ` +
          `Consider using ChromeLocalAdapter instead.`
      );
    }

    return bytes;
  }

  /**
   * Get value by key
   */
  get(key) {
    return new Promise((resolve, reject) => {
      this.storageAPI.get([key], result => {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(result[key]);
      });
    });
  }

  /**
   * Set value for key (with quota check)
   */
  set(key, value) {
    // Check quota before setting
    this.checkQuota(key, value);

    return new Promise((resolve, reject) => {
      this.storageAPI.set({ [key]: value }, () => {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.lastError) {
          const error = chrome.runtime.lastError.message;

          // Provide helpful error messages
          if (error.includes('QUOTA_BYTES')) {
            reject(
              new Error(
                'chrome.storage.sync quota exceeded (100KB total). Consider using ChromeLocalAdapter for large data.'
              )
            );
          } else if (error.includes('QUOTA_BYTES_PER_ITEM')) {
            reject(
              new Error(
                'Item exceeds 8KB limit for chrome.storage.sync. Consider splitting data or using ChromeLocalAdapter.'
              )
            );
          } else if (error.includes('MAX_ITEMS')) {
            reject(
              new Error(
                'Maximum items (512) exceeded for chrome.storage.sync. Consider using ChromeLocalAdapter.'
              )
            );
          } else {
            reject(new Error(error));
          }
          return;
        }
        resolve();
      });
    });
  }

  /**
   * Remove value by key
   */
  remove(key) {
    return new Promise((resolve, reject) => {
      this.storageAPI.remove(key, () => {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve();
      });
    });
  }

  /**
   * Clear all data
   */
  clear() {
    return new Promise((resolve, reject) => {
      this.storageAPI.clear(() => {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve();
      });
    });
  }

  /**
   * Get all keys
   */
  keys() {
    return new Promise((resolve, reject) => {
      this.storageAPI.get(null, result => {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(Object.keys(result || {}));
      });
    });
  }

  /**
   * Get storage info
   */
  getInfo() {
    return new Promise(resolve => {
      if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.sync) {
        resolve({
          type: 'ChromeSyncAdapter (fallback)',
          available: true,
          quota: this.QUOTA_BYTES,
          quotaPerItem: this.QUOTA_BYTES_PER_ITEM,
          maxItems: this.MAX_ITEMS,
          usage: 0,
        });
        return;
      }

      this.storageAPI.getBytesInUse(null, bytesInUse => {
        resolve({
          type: 'ChromeSyncAdapter',
          available: true,
          quota: this.QUOTA_BYTES,
          quotaPerItem: this.QUOTA_BYTES_PER_ITEM,
          maxItems: this.MAX_ITEMS,
          usage: bytesInUse || 0,
          usagePercent: (((bytesInUse || 0) / this.QUOTA_BYTES) * 100).toFixed(2) + '%',
        });
      });
    });
  }
}
