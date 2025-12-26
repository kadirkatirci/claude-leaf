/**
 * EventEmitter - Simple event emitter pattern
 * Lightweight alternative to using EventBus for store-specific events
 */

export class EventEmitter {
  constructor() {
    this.events = new Map();
  }

  /**
   * Subscribe to event
   * @param {string} event - Event name
   * @param {Function} callback - Event handler
   * @returns {Function} - Unsubscribe function
   */
  on(event, callback) {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }

    this.events.get(event).push(callback);

    // Return unsubscribe function
    return () => this.off(event, callback);
  }

  /**
   * Subscribe to event (one-time)
   * @param {string} event - Event name
   * @param {Function} callback - Event handler
   * @returns {Function} - Unsubscribe function
   */
  once(event, callback) {
    const wrapper = (...args) => {
      callback(...args);
      this.off(event, wrapper);
    };

    return this.on(event, wrapper);
  }

  /**
   * Unsubscribe from event
   * @param {string} event - Event name
   * @param {Function} callback - Event handler to remove
   */
  off(event, callback) {
    if (!this.events.has(event)) {
      return;
    }

    const callbacks = this.events.get(event);
    const index = callbacks.indexOf(callback);

    if (index !== -1) {
      callbacks.splice(index, 1);
    }

    // Clean up empty event arrays
    if (callbacks.length === 0) {
      this.events.delete(event);
    }
  }

  /**
   * Emit event
   * @param {string} event - Event name
   * @param {*} data - Event data
   */
  emit(event, data) {
    if (!this.events.has(event)) {
      return;
    }

    const callbacks = this.events.get(event);

    // Call all callbacks with error handling
    callbacks.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`[EventEmitter] Error in event handler for "${event}":`, error);
      }
    });
  }

  /**
   * Remove all listeners for event (or all events if no event specified)
   * @param {string} [event] - Event name (optional)
   */
  removeAllListeners(event) {
    if (event) {
      this.events.delete(event);
    } else {
      this.events.clear();
    }
  }

  /**
   * Get listener count for event
   * @param {string} event - Event name
   * @returns {number}
   */
  listenerCount(event) {
    return this.events.has(event) ? this.events.get(event).length : 0;
  }

  /**
   * Get all event names
   * @returns {string[]}
   */
  eventNames() {
    return Array.from(this.events.keys());
  }
}
