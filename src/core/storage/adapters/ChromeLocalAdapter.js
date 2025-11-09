/**
 * ChromeLocalAdapter - chrome.storage.local implementation
 * Best for: Large data, bookmarks, markers
 * Quota: ~10MB (can be unlimited with permission)
 */

import { BaseAdapter } from './BaseAdapter.js';

export class ChromeLocalAdapter extends BaseAdapter {
  constructor() {
    super();
    this.storageAPI = this.getStorageAPI();
  }

  /**
   * Get Chrome storage API with fallback
   */
  getStorageAPI() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      return chrome.storage.local;
    }

    console.warn('[ChromeLocalAdapter] chrome.storage.local unavailable, using localStorage fallback');
    return this.createLocalStorageFallback();
  }

  /**
   * Create localStorage fallback for testing/development
   */
  createLocalStorageFallback() {
    return {
      get: (keys) => {
        return new Promise((resolve) => {
          const result = {};
          const keyArray = Array.isArray(keys) ? keys : [keys];

          keyArray.forEach(key => {
            try {
              const data = localStorage.getItem(key);
              result[key] = data ? JSON.parse(data) : undefined;
            } catch (error) {
              console.error(`[ChromeLocalAdapter] localStorage.getItem failed for ${key}:`, error);
              result[key] = undefined;
            }
          });

          resolve(result);
        });
      },
      set: (items) => {
        return new Promise((resolve, reject) => {
          try {
            Object.entries(items).forEach(([key, value]) => {
              localStorage.setItem(key, JSON.stringify(value));
            });
            resolve();
          } catch (error) {
            if (error.name === 'QuotaExceededError') {
              reject(new Error('Storage quota exceeded. Please free up space.'));
            } else {
              reject(error);
            }
          }
        });
      },
      remove: (keys) => {
        return new Promise((resolve) => {
          const keyArray = Array.isArray(keys) ? keys : [keys];
          keyArray.forEach(key => localStorage.removeItem(key));
          resolve();
        });
      },
      clear: () => {
        return new Promise((resolve) => {
          localStorage.clear();
          resolve();
        });
      }
    };
  }

  /**
   * Get value by key
   */
  async get(key) {
    return new Promise((resolve, reject) => {
      this.storageAPI.get([key], (result) => {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(result[key]);
      });
    });
  }

  /**
   * Set value for key
   */
  async set(key, value) {
    return new Promise((resolve, reject) => {
      this.storageAPI.set({ [key]: value }, () => {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve();
      });
    });
  }

  /**
   * Remove value by key
   */
  async remove(key) {
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
  async clear() {
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
  async keys() {
    return new Promise((resolve, reject) => {
      this.storageAPI.get(null, (result) => {
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
  async getInfo() {
    return new Promise((resolve) => {
      if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
        resolve({
          type: 'ChromeLocalAdapter (fallback)',
          available: true,
          quota: 10 * 1024 * 1024, // ~10MB localStorage limit
          usage: 0
        });
        return;
      }

      chrome.storage.local.getBytesInUse(null, (bytesInUse) => {
        resolve({
          type: 'ChromeLocalAdapter',
          available: true,
          quota: chrome.storage.local.QUOTA_BYTES || 'unlimited',
          usage: bytesInUse || 0
        });
      });
    });
  }
}
