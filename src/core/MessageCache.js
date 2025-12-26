/**
 * MessageCache - Shared cache for findMessages() results
 *
 * Prevents redundant DOM queries when multiple modules request messages
 * within a short time window. Provides 500ms TTL cache with automatic invalidation.
 *
 * Usage:
 *   const messages = messageCache.get();
 *   messageCache.invalidate(); // Force refresh
 */

import { DEBUG_FLAGS } from '../config/debug.js';

class MessageCache {
  constructor() {
    this.cache = null;
    this.cacheTime = 0;
    this.cacheTTL = 500; // 500ms cache lifetime (optimized from 100ms)
    this.findMessagesFn = null;
    this.isEnabled = true;

    if (typeof window !== 'undefined') {
      // Allow disabling via console for debugging
      window.messageCache = this;
    }
  }

  /**
   * Set the function to call for finding messages
   * @param {Function} fn - Function that returns message elements
   */
  setFindMessagesFunction(fn) {
    this.findMessagesFn = fn;
  }

  /**
   * Get messages (from cache or fresh query)
   * @returns {HTMLElement[]} Message elements
   */
  get() {
    if (!this.isEnabled) {
      return this.findMessagesFn ? this.findMessagesFn() : [];
    }

    const now = Date.now();
    const cacheAge = now - this.cacheTime;

    // Return cached result if still valid
    if (this.cache && cacheAge < this.cacheTTL) {
      if (DEBUG_FLAGS.cache) {
        console.log(`[MessageCache] Cache hit (age: ${cacheAge}ms)`);
      }
      return this.cache;
    }

    // Cache expired or doesn't exist - fetch fresh data
    if (this.findMessagesFn) {
      this.cache = this.findMessagesFn();
      this.cacheTime = now;

      if (DEBUG_FLAGS.cache) {
        console.log(`[MessageCache] Cache miss - fetched ${this.cache.length} messages`);
      }

      return this.cache;
    }

    return [];
  }

  /**
   * Invalidate cache (force next get() to fetch fresh data)
   */
  invalidate() {
    this.cache = null;
    this.cacheTime = 0;

    if (DEBUG_FLAGS.cache) {
      console.log('[MessageCache] Cache invalidated');
    }
  }

  /**
   * Enable/disable cache (for debugging)
   * @param {boolean} enabled
   */
  setEnabled(enabled) {
    this.isEnabled = enabled;
    if (!enabled) {
      this.invalidate();
    }

    if (DEBUG_FLAGS.cache) {
      console.log(`[MessageCache] Cache ${enabled ? 'enabled' : 'disabled'}`);
    }
  }

  /**
   * Get cache statistics
   * @returns {Object} Stats
   */
  getStats() {
    const now = Date.now();
    const cacheAge = this.cache ? now - this.cacheTime : null;

    return {
      isCached: !!this.cache,
      cacheAge: cacheAge,
      cacheSize: this.cache ? this.cache.length : 0,
      cacheTTL: this.cacheTTL,
      isEnabled: this.isEnabled,
      isValid: cacheAge !== null && cacheAge < this.cacheTTL,
    };
  }
}

// Export singleton instance
const messageCache = new MessageCache();

export default messageCache;
