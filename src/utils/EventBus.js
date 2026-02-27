/**
 * EventBus - Event-driven communication between modules
 * Used for loosely coupled architecture
 */
class EventBus {
  constructor() {
    this.listeners = new Map();
  }

  /**
   * Add event listener
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }

    this.listeners.get(event).push(callback);

    // Return unsubscribe function
    return () => this.off(event, callback);
  }

  /**
   * Remove event listener
   * @param {string} event - Event name
   * @param {Function} callback - Callback to remove
   */
  off(event, callback) {
    if (!this.listeners.has(event)) {
      return;
    }

    const callbacks = this.listeners.get(event);
    const index = callbacks.indexOf(callback);

    if (index > -1) {
      callbacks.splice(index, 1);
    }
  }

  /**
   * Emit event
   * @param {string} event - Event name
   * @param {*} data - Event data
   */
  emit(event, data) {
    if (!this.listeners.has(event)) {
      return;
    }

    const callbacks = this.listeners.get(event);
    callbacks.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`EventBus error on event "${event}":`, error);
      }
    });
  }

  /**
   * One-time event listener
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   */
  once(event, callback) {
    const wrappedCallback = data => {
      callback(data);
      this.off(event, wrappedCallback);
    };

    this.on(event, wrappedCallback);
  }

  /**
   * Clear all listeners
   */
  clear() {
    this.listeners.clear();
  }
}

// Singleton instance
const eventBus = new EventBus();

// Event name constants
const Events = {
  // MessageHub events (central observer)
  HUB_MESSAGE_COUNT_CHANGED: 'hub:message_count_changed', // Message count changed
  HUB_VERSION_CHANGED: 'hub:version_changed', // Edit version changed
  HUB_CONTENT_CHANGED: 'hub:content_changed', // Any content change
  HUB_EDIT_SESSION_CHANGED: 'hub:edit_session_changed', // Edit textarea session changed

  // Message events (legacy, for backward compatibility)
  MESSAGES_UPDATED: 'messages:updated',
  MESSAGE_CLICKED: 'message:clicked',
  MESSAGE_SCROLLED: 'message:scrolled',

  // Edit/Version events
  EDIT_VERSION_CHANGED: 'edit:version_changed', // Fired when user changes edit version
  EDITS_UPDATED: 'edits:updated', // Fired when edited prompts list changes

  // Settings events
  SETTINGS_CHANGED: 'settings:changed',
  FEATURE_TOGGLED: 'feature:toggled',

  // Navigation events
  NAVIGATION_PREV: 'navigation:prev',
  NAVIGATION_NEXT: 'navigation:next',
  NAVIGATION_TOP: 'navigation:top',

  // UI events
  UI_READY: 'ui:ready',
  DOM_CHANGED: 'dom:changed',

  // SPA navigation (centralized)
  URL_CHANGED: 'url:changed',
};

export { eventBus, Events };
