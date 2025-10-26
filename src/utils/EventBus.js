/**
 * EventBus - Modüller arası event-driven iletişim
 * Loosely coupled architecture için kullanılır
 */
class EventBus {
  constructor() {
    this.listeners = new Map();
  }

  /**
   * Event dinleyici ekle
   * @param {string} event - Event adı
   * @param {Function} callback - Callback fonksiyonu
   * @returns {Function} Unsubscribe fonksiyonu
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    
    this.listeners.get(event).push(callback);
    
    // Unsubscribe fonksiyonu döndür
    return () => this.off(event, callback);
  }

  /**
   * Event dinleyiciyi kaldır
   * @param {string} event - Event adı
   * @param {Function} callback - Kaldırılacak callback
   */
  off(event, callback) {
    if (!this.listeners.has(event)) return;
    
    const callbacks = this.listeners.get(event);
    const index = callbacks.indexOf(callback);
    
    if (index > -1) {
      callbacks.splice(index, 1);
    }
  }

  /**
   * Event tetikle
   * @param {string} event - Event adı
   * @param {*} data - Event verisi
   */
  emit(event, data) {
    if (!this.listeners.has(event)) return;
    
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
   * Tek seferlik event dinleyici
   * @param {string} event - Event adı
   * @param {Function} callback - Callback fonksiyonu
   */
  once(event, callback) {
    const wrappedCallback = (data) => {
      callback(data);
      this.off(event, wrappedCallback);
    };
    
    this.on(event, wrappedCallback);
  }

  /**
   * Tüm dinleyicileri temizle
   */
  clear() {
    this.listeners.clear();
  }
}

// Singleton instance
const eventBus = new EventBus();

// Event isimleri için constants
const Events = {
  // Message events
  MESSAGES_UPDATED: 'messages:updated',
  MESSAGE_CLICKED: 'message:clicked',
  MESSAGE_SCROLLED: 'message:scrolled',

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
