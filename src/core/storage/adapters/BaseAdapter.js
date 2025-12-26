/**
 * BaseAdapter - Abstract base class for storage adapters
 * All storage adapters must extend this class and implement the required methods
 */

export class BaseAdapter {
  /**
   * Get value by key
   * @param {string} key - Storage key
   * @returns {Promise<any>} - Stored value or undefined
   */
  get(_key) {
    throw new Error('BaseAdapter.get() must be implemented by subclass');
  }

  /**
   * Set value for key
   * @param {string} key - Storage key
   * @param {any} value - Value to store
   * @returns {Promise<void>}
   */
  set(_key, _value) {
    throw new Error('BaseAdapter.set() must be implemented by subclass');
  }

  /**
   * Remove value by key
   * @param {string} key - Storage key
   * @returns {Promise<void>}
   */
  remove(_key) {
    throw new Error('BaseAdapter.remove() must be implemented by subclass');
  }

  /**
   * Clear all data
   * @returns {Promise<void>}
   */
  clear() {
    throw new Error('BaseAdapter.clear() must be implemented by subclass');
  }

  /**
   * Get all keys
   * @returns {Promise<string[]>}
   */
  keys() {
    throw new Error('BaseAdapter.keys() must be implemented by subclass');
  }

  /**
   * Get storage info (size, quota, etc.)
   * @returns {Promise<Object>}
   */
  getInfo() {
    return Promise.resolve({
      type: this.constructor.name,
      available: true,
    });
  }
}
