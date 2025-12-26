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
    this.retryAttempts = 3;
    this.retryDelayMs = 100; // Start with 100ms, exponential backoff
  }

  /**
   * Get Chrome storage API with fallback
   */
  getStorageAPI() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      return chrome.storage.local;
    }

    console.warn(
      '[ChromeLocalAdapter] chrome.storage.local unavailable, using localStorage fallback'
    );
    return this.createLocalStorageFallback();
  }

  /**
   * Create localStorage fallback for testing/development
   */
  createLocalStorageFallback() {
    return {
      get: keys => {
        return new Promise(resolve => {
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
      set: items => {
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
      remove: keys => {
        return new Promise(resolve => {
          const keyArray = Array.isArray(keys) ? keys : [keys];
          keyArray.forEach(key => localStorage.removeItem(key));
          resolve();
        });
      },
      clear: () => {
        return new Promise(resolve => {
          localStorage.clear();
          resolve();
        });
      },
    };
  }

  /**
   * Check for Chrome runtime errors
   */
  checkChromeError() {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.lastError) {
      return new Error(chrome.runtime.lastError.message);
    }
    return null;
  }

  /**
   * Exponential backoff delay
   */
  async delay(attemptNumber) {
    const delayMs = this.retryDelayMs * Math.pow(2, attemptNumber);
    return new Promise(resolve => {
      setTimeout(resolve, delayMs);
    });
  }

  /**
   * Retry wrapper for storage operations
   */
  async withRetry(operation, operationName = 'operation') {
    let lastError;

    for (let attempt = 0; attempt < this.retryAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        if (attempt < this.retryAttempts - 1) {
          console.warn(
            `[ChromeLocalAdapter] ${operationName} failed (attempt ${attempt + 1}/${this.retryAttempts}):`,
            error.message
          );
          await this.delay(attempt);
        }
      }
    }

    console.error(
      `[ChromeLocalAdapter] ${operationName} failed after ${this.retryAttempts} attempts`,
      lastError
    );
    throw lastError;
  }

  /**
   * Get value by key (with retry)
   */
  async get(key) {
    return this.withRetry(async () => {
      return new Promise((resolve, reject) => {
        try {
          this.storageAPI.get([key], result => {
            const error = this.checkChromeError();
            if (error) {
              reject(error);
              return;
            }

            // Validate result is an object
            if (!result || typeof result !== 'object') {
              reject(new Error('Invalid storage response'));
              return;
            }

            resolve(result[key]);
          });
        } catch (error) {
          reject(error);
        }
      });
    }, `get('${key}')`);
  }

  /**
   * Set value for key (with retry and quota checking)
   */
  async set(key, value) {
    return this.withRetry(async () => {
      // Validate value
      if (value === undefined) {
        throw new Error('Cannot store undefined value');
      }

      // Check if value is serializable
      try {
        JSON.stringify(value);
      } catch (error) {
        throw new Error(`Value not serializable: ${error.message}`);
      }

      return new Promise((resolve, reject) => {
        try {
          this.storageAPI.set({ [key]: value }, () => {
            const error = this.checkChromeError();
            if (error) {
              // Check if it's a quota error
              if (
                error.message.includes('QUOTA_BYTES_PER_ITEM') ||
                error.message.includes('QuotaExceededError') ||
                error.message.includes('quota')
              ) {
                reject(new Error(`Storage quota exceeded for key '${key}': ${error.message}`));
              } else {
                reject(error);
              }
              return;
            }
            resolve();
          });
        } catch (error) {
          reject(error);
        }
      });
    }, `set('${key}')`);
  }

  /**
   * Remove value by key (with retry)
   */
  async remove(key) {
    return this.withRetry(async () => {
      return new Promise((resolve, reject) => {
        try {
          this.storageAPI.remove(key, () => {
            const error = this.checkChromeError();
            if (error) {
              reject(error);
              return;
            }
            resolve();
          });
        } catch (error) {
          reject(error);
        }
      });
    }, `remove('${key}')`);
  }

  /**
   * Clear all data (with retry)
   */
  async clear() {
    return this.withRetry(async () => {
      return new Promise((resolve, reject) => {
        try {
          this.storageAPI.clear(() => {
            const error = this.checkChromeError();
            if (error) {
              reject(error);
              return;
            }
            resolve();
          });
        } catch (error) {
          reject(error);
        }
      });
    }, 'clear()');
  }

  /**
   * Get all keys
   */
  async keys() {
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
  async getInfo() {
    return new Promise(resolve => {
      if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
        resolve({
          type: 'ChromeLocalAdapter (fallback)',
          available: true,
          quota: 10 * 1024 * 1024, // ~10MB localStorage limit
          usage: 0,
        });
        return;
      }

      chrome.storage.local.getBytesInUse(null, bytesInUse => {
        resolve({
          type: 'ChromeLocalAdapter',
          available: true,
          quota: chrome.storage.local.QUOTA_BYTES || 'unlimited',
          usage: bytesInUse || 0,
        });
      });
    });
  }
}
