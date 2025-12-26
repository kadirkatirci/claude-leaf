/**
 * ObserverManager - Centralized DOM observation management
 * Provides lifecycle management and performance optimization for MutationObservers
 */

import { debugLog } from '../config/debug.js';

class ObserverManager {
  constructor() {
    this.observers = new Map();
    this.throttledCallbacks = new Map();
    this.debugMode = false;
  }

  /**
   * Create and manage a MutationObserver
   * @param {string} id - Unique identifier for the observer
   * @param {Element} target - DOM element to observe
   * @param {Function} callback - Function to call on mutations
   * @param {Object} options - Observer configuration
   */
  observe(id, target, callback, options = {}) {
    // Disconnect existing observer if any
    this.disconnect(id);

    if (!target) {
      console.error('[ObserverManager] Invalid target for observer:', id);
      return null;
    }

    const {
      childList = true,
      subtree = true,
      attributes = false,
      attributeOldValue = false,
      characterData = false,
      characterDataOldValue = false,
      attributeFilter = undefined,
      throttle = 0,
      debounce = 0,
    } = options;

    // Create callback wrapper with throttle/debounce
    let wrappedCallback = callback;

    if (throttle > 0) {
      wrappedCallback = this.createThrottledCallback(id, callback, throttle);
    } else if (debounce > 0) {
      wrappedCallback = this.createDebouncedCallback(id, callback, debounce);
    }

    // Create observer
    const observer = new MutationObserver(mutations => {
      if (this.debugMode) {
        debugLog('observer', `Mutations detected for ${id}:`, mutations.length);
      }

      try {
        wrappedCallback(mutations);
      } catch (error) {
        console.error(`[ObserverManager] Error in observer callback ${id}:`, error);
      }
    });

    // Start observing
    const config = {
      childList,
      subtree,
      attributes,
      attributeOldValue,
      characterData,
      characterDataOldValue,
      attributeFilter,
    };

    observer.observe(target, config);

    // Store observer data
    this.observers.set(id, {
      observer,
      target,
      config,
      callback: wrappedCallback,
      originalCallback: callback,
    });

    if (this.debugMode) {
      debugLog('observer', `Started observing ${id}`, config);
    }

    return observer;
  }

  /**
   * Create throttled callback
   */
  createThrottledCallback(id, callback, delay) {
    let timeoutId = null;
    let lastCallTime = 0;

    const throttled = (...args) => {
      const now = Date.now();

      if (now - lastCallTime >= delay) {
        callback(...args);
        lastCallTime = now;
      } else {
        // Schedule call for later
        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        timeoutId = setTimeout(
          () => {
            callback(...args);
            lastCallTime = Date.now();
            timeoutId = null;
          },
          delay - (now - lastCallTime)
        );
      }
    };

    // Store for cleanup
    this.throttledCallbacks.set(`${id}_throttle`, { timeoutId, throttled });

    return throttled;
  }

  /**
   * Create debounced callback
   */
  createDebouncedCallback(id, callback, delay) {
    let timeoutId = null;

    const debounced = (...args) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      timeoutId = setTimeout(() => {
        callback(...args);
        timeoutId = null;
      }, delay);
    };

    // Store for cleanup
    this.throttledCallbacks.set(`${id}_debounce`, { timeoutId, debounced });

    return debounced;
  }

  /**
   * Temporarily pause an observer
   */
  pause(id) {
    const data = this.observers.get(id);
    if (!data) {
      return false;
    }

    data.observer.disconnect();
    data.paused = true;

    if (this.debugMode) {
      debugLog('observer', `Paused observer ${id}`);
    }

    return true;
  }

  /**
   * Resume a paused observer
   */
  resume(id) {
    const data = this.observers.get(id);
    if (!data || !data.paused) {
      return false;
    }

    data.observer.observe(data.target, data.config);
    data.paused = false;

    if (this.debugMode) {
      debugLog('observer', `Resumed observer ${id}`);
    }

    return true;
  }

  /**
   * Update observer configuration
   */
  update(id, newTarget, newCallback, newOptions) {
    const data = this.observers.get(id);
    if (!data) {
      return false;
    }

    // Disconnect current observer
    data.observer.disconnect();

    // Update and reconnect
    if (newTarget) {
      data.target = newTarget;
    }

    if (newCallback) {
      data.originalCallback = newCallback;
    }

    if (newOptions) {
      Object.assign(data.config, newOptions);
    }

    // Recreate with new settings
    this.observe(id, data.target, data.originalCallback, data.config);

    return true;
  }

  /**
   * Disconnect and remove an observer
   */
  disconnect(id) {
    const data = this.observers.get(id);
    if (!data) {
      return false;
    }

    // Disconnect observer
    data.observer.disconnect();

    // Clear any throttle/debounce timers
    const throttleData = this.throttledCallbacks.get(`${id}_throttle`);
    if (throttleData && throttleData.timeoutId) {
      clearTimeout(throttleData.timeoutId);
      this.throttledCallbacks.delete(`${id}_throttle`);
    }

    const debounceData = this.throttledCallbacks.get(`${id}_debounce`);
    if (debounceData && debounceData.timeoutId) {
      clearTimeout(debounceData.timeoutId);
      this.throttledCallbacks.delete(`${id}_debounce`);
    }

    // Remove from map
    this.observers.delete(id);

    if (this.debugMode) {
      debugLog('observer', `Disconnected observer ${id}`);
    }

    return true;
  }

  /**
   * Disconnect all observers
   */
  disconnectAll() {
    const count = this.observers.size;

    for (const [id] of this.observers) {
      this.disconnect(id);
    }

    if (this.debugMode) {
      debugLog('observer', `Disconnected all ${count} observers`);
    }

    return count;
  }

  /**
   * Get observer status
   */
  getStatus(id) {
    const data = this.observers.get(id);
    if (!data) {
      return null;
    }

    return {
      id,
      target: data.target,
      config: data.config,
      paused: data.paused || false,
    };
  }

  /**
   * Get all observer statuses
   */
  getAllStatuses() {
    const statuses = [];

    for (const [id] of this.observers) {
      statuses.push(this.getStatus(id));
    }

    return statuses;
  }

  /**
   * Check if observer exists
   */
  has(id) {
    return this.observers.has(id);
  }

  /**
   * Get observer count
   */
  getCount() {
    return this.observers.size;
  }

  /**
   * Set debug mode
   */
  setDebugMode(enabled) {
    this.debugMode = enabled;

    if (enabled) {
      debugLog('observer', 'Debug mode enabled');
      debugLog('observer', `Active observers: ${this.observers.size}`);
    }
  }

  /**
   * Batch operations to prevent observer triggers
   */
  async batch(id, operation) {
    const wasPaused = false;

    try {
      // Pause observer during operation
      if (this.has(id)) {
        this.pause(id);
      }

      // Execute operation
      const result = await operation();

      return result;
    } finally {
      // Resume observer
      if (this.has(id) && !wasPaused) {
        this.resume(id);
      }
    }
  }

  /**
   * Clean up and destroy
   */
  destroy() {
    this.disconnectAll();
    this.throttledCallbacks.clear();

    if (this.debugMode) {
      debugLog('observer', 'Destroyed');
    }
  }
}

// Export singleton instance
export default new ObserverManager();
