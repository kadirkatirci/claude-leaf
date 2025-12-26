/**
 * AsyncManager - Centralized async operation management
 *
 * Handles all timers, intervals, and async operations in a single place.
 * Provides automatic cleanup, timeout protection, and event-driven alternatives to polling.
 *
 * Features:
 * - Centralized timer management (no more scattered setInterval/setTimeout)
 * - Automatic cleanup on destroy
 * - Timeout protection for all async operations
 * - Event-driven element waiting (no polling)
 * - Promise deduplication
 * - Retry logic with exponential backoff
 */

import { debugLog } from '../config/debug.js';

class AsyncManager {
  constructor() {
    this.timers = new Map(); // id -> {type, callback, interval, timer}
    this.promises = new Map(); // key -> promise
    this.observers = new Map(); // id -> {observer, callback}
    this.destroyed = false;
    this.nextTimerId = 1;
    this.debugMode = false;
  }

  /**
   * Set debug mode
   */
  setDebugMode(enabled) {
    this.debugMode = enabled;
  }

  /**
   * Register a timeout (replacement for setTimeout)
   * @param {Function} callback - Function to execute
   * @param {number} delay - Delay in milliseconds
   * @param {string} description - Description for debugging
   * @returns {number} Timer ID for cancellation
   */
  setTimeout(callback, delay, description = 'Unnamed timeout') {
    if (this.destroyed) {
      return null;
    }

    const timerId = this.nextTimerId++;

    const wrappedCallback = () => {
      if (this.destroyed) {
        return;
      }

      if (this.debugMode) {
        debugLog('async', `Executing timeout: ${description}`);
      }

      try {
        callback();
      } catch (error) {
        console.error(`[AsyncManager] Error in timeout (${description}):`, error);
      } finally {
        this.timers.delete(timerId);
      }
    };

    const timer = setTimeout(wrappedCallback, delay);

    this.timers.set(timerId, {
      type: 'timeout',
      callback,
      description,
      timer,
    });

    if (this.debugMode) {
      debugLog('async', `Registered timeout: ${description} (${delay}ms)`);
    }

    return timerId;
  }

  /**
   * Register an interval (replacement for setInterval)
   * @param {Function} callback - Function to execute
   * @param {number} interval - Interval in milliseconds
   * @param {string} description - Description for debugging
   * @returns {number} Timer ID for cancellation
   */
  setInterval(callback, interval, description = 'Unnamed interval') {
    if (this.destroyed) {
      return null;
    }

    const timerId = this.nextTimerId++;

    const wrappedCallback = () => {
      if (this.destroyed) {
        this.clearTimer(timerId);
        return;
      }

      if (this.debugMode) {
        debugLog('async', `Executing interval: ${description}`);
      }

      try {
        callback();
      } catch (error) {
        console.error(`[AsyncManager] Error in interval (${description}):`, error);
      }
    };

    const timer = setInterval(wrappedCallback, interval);

    this.timers.set(timerId, {
      type: 'interval',
      callback,
      interval,
      description,
      timer,
    });

    if (this.debugMode) {
      debugLog('async', `Registered interval: ${description} (${interval}ms)`);
    }

    return timerId;
  }

  /**
   * Clear a timer (timeout or interval)
   * @param {number} timerId - Timer ID to clear
   */
  clearTimer(timerId) {
    const timerInfo = this.timers.get(timerId);
    if (!timerInfo) {
      return;
    }

    if (timerInfo.type === 'timeout') {
      clearTimeout(timerInfo.timer);
    } else if (timerInfo.type === 'interval') {
      clearInterval(timerInfo.timer);
    }

    this.timers.delete(timerId);

    if (this.debugMode) {
      debugLog('async', `Cleared ${timerInfo.type}: ${timerInfo.description}`);
    }
  }

  /**
   * Wait for an element to appear (event-driven, no polling)
   * @param {string} selector - CSS selector
   * @param {number} timeout - Maximum wait time in milliseconds
   * @param {HTMLElement} root - Root element to observe (default: document.body)
   * @returns {Promise<HTMLElement>} The found element
   */
  waitForElement(selector, timeout = 10000, root = document.body) {
    if (this.destroyed) {
      throw new Error('AsyncManager is destroyed');
    }

    // Check if element already exists
    const existing = root.querySelector(selector);
    if (existing) {
      return existing;
    }

    return new Promise((resolve, reject) => {
      const observerId = `wait_${selector}_${Date.now()}`;
      let observer = null;
      let timeoutId = null;

      const cleanup = () => {
        if (observer) {
          observer.disconnect();
          this.observers.delete(observerId);
        }
        if (timeoutId) {
          this.clearTimer(timeoutId);
        }
      };

      // Set up timeout
      timeoutId = this.setTimeout(
        () => {
          cleanup();
          reject(new Error(`Element not found: ${selector} (timeout: ${timeout}ms)`));
        },
        timeout,
        `Wait for element: ${selector}`
      );

      // Set up observer
      observer = new MutationObserver(() => {
        const element = root.querySelector(selector);
        if (element) {
          cleanup();
          resolve(element);
        }
      });

      observer.observe(root, {
        childList: true,
        subtree: true,
      });

      this.observers.set(observerId, { observer, callback: null });
    });
  }

  /**
   * Execute an async operation with timeout protection
   * @param {Function} asyncFn - Async function to execute
   * @param {number} timeout - Timeout in milliseconds
   * @param {string} description - Description for debugging
   * @returns {Promise} Result of the async function
   */
  withTimeout(asyncFn, timeout = 30000, description = 'Async operation') {
    if (this.destroyed) {
      throw new Error('AsyncManager is destroyed');
    }

    return Promise.race([
      asyncFn(),
      new Promise((_, reject) => {
        this.setTimeout(
          () => {
            reject(new Error(`Operation timed out: ${description} (${timeout}ms)`));
          },
          timeout,
          `Timeout for: ${description}`
        );
      }),
    ]);
  }

  /**
   * Deduplicate async operations (prevent multiple identical requests)
   * @param {string} key - Unique key for the operation
   * @param {Function} asyncFn - Async function to execute
   * @returns {Promise} Result of the async function
   */
  deduplicate(key, asyncFn) {
    if (this.destroyed) {
      throw new Error('AsyncManager is destroyed');
    }

    // If already in progress, return existing promise
    if (this.promises.has(key)) {
      debugLog('AsyncManager', `Deduplicating operation: ${key}`);
      return this.promises.get(key);
    }

    // Create new promise
    const promise = asyncFn().finally(() => {
      this.promises.delete(key);
    });

    this.promises.set(key, promise);
    return promise;
  }

  /**
   * Retry an async operation with exponential backoff
   * @param {Function} asyncFn - Async function to execute
   * @param {number} maxRetries - Maximum number of retries
   * @param {number} initialDelay - Initial delay in milliseconds
   * @param {string} description - Description for debugging
   * @returns {Promise} Result of the async function
   */
  async retry(asyncFn, maxRetries = 3, initialDelay = 1000, description = 'Async operation') {
    if (this.destroyed) {
      throw new Error('AsyncManager is destroyed');
    }

    let lastError;
    let delay = initialDelay;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          debugLog('AsyncManager', `Retry attempt ${attempt} for: ${description}`);
        }

        return await asyncFn();
      } catch (error) {
        lastError = error;

        if (attempt < maxRetries) {
          await new Promise(resolve => {
            this.setTimeout(resolve, delay, `Retry delay for: ${description}`);
          });
          delay *= 2; // Exponential backoff
        }
      }
    }

    throw new Error(
      `Failed after ${maxRetries} retries: ${description}. Last error: ${lastError?.message}`
    );
  }

  /**
   * Throttle a function (limit execution frequency)
   * @param {Function} fn - Function to throttle
   * @param {number} delay - Minimum delay between executions
   * @returns {Function} Throttled function
   */
  throttle(fn, delay) {
    let timeoutId = null;
    let lastExecTime = 0;

    return (...args) => {
      if (this.destroyed) {
        return;
      }

      const now = Date.now();
      const timeSinceLastExec = now - lastExecTime;

      if (timeSinceLastExec >= delay) {
        lastExecTime = now;
        fn.apply(this, args);
      } else {
        if (timeoutId) {
          this.clearTimer(timeoutId);
        }

        const remainingDelay = delay - timeSinceLastExec;
        timeoutId = this.setTimeout(
          () => {
            lastExecTime = Date.now();
            fn.apply(this, args);
          },
          remainingDelay,
          `Throttle for function`
        );
      }
    };
  }

  /**
   * Debounce a function (delay execution until idle)
   * @param {Function} fn - Function to debounce
   * @param {number} delay - Delay in milliseconds
   * @returns {Function} Debounced function
   */
  debounce(fn, delay) {
    let timeoutId = null;

    return (...args) => {
      if (this.destroyed) {
        return;
      }

      if (timeoutId) {
        this.clearTimer(timeoutId);
      }

      timeoutId = this.setTimeout(
        () => {
          fn.apply(this, args);
        },
        delay,
        `Debounce for function`
      );
    };
  }

  /**
   * Get statistics about active operations
   * @returns {Object} Statistics
   */
  getStats() {
    const stats = {
      timers: {
        timeouts: 0,
        intervals: 0,
        total: this.timers.size,
      },
      promises: this.promises.size,
      observers: this.observers.size,
    };

    for (const timer of this.timers.values()) {
      if (timer.type === 'timeout') {
        stats.timers.timeouts++;
      } else if (timer.type === 'interval') {
        stats.timers.intervals++;
      }
    }

    return stats;
  }

  /**
   * List all active operations (for debugging)
   * @returns {Object} Active operations
   */
  listActiveOperations() {
    const operations = {
      timers: [],
      promises: Array.from(this.promises.keys()),
      observers: Array.from(this.observers.keys()),
    };

    for (const [id, timer] of this.timers.entries()) {
      operations.timers.push({
        id,
        type: timer.type,
        description: timer.description,
        interval: timer.interval,
      });
    }

    return operations;
  }

  /**
   * Clear all timers and operations
   */
  clearAll() {
    // Clear all timers
    for (const timerId of this.timers.keys()) {
      this.clearTimer(timerId);
    }

    // Clear all observers
    for (const { observer } of this.observers.values()) {
      if (observer) {
        observer.disconnect();
      }
    }
    this.observers.clear();

    // Clear promises (they'll resolve/reject on their own)
    this.promises.clear();

    debugLog('AsyncManager', 'Cleared all operations');
  }

  /**
   * Destroy the manager and clean up all resources
   */
  destroy() {
    this.destroyed = true;
    this.clearAll();
    debugLog('AsyncManager', 'Destroyed');
  }
}

// Export as singleton
const asyncManager = new AsyncManager();
export default asyncManager;
