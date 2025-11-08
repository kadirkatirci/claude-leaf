/**
 * MessageObserverMixin - Reusable observer pattern for message tracking
 * Provides standardized DOM observation with throttling and message count tracking
 */

const MessageObserverMixin = {
  /**
   * Enhance a module with message observer capabilities
   * @param {Object} module - Module instance to enhance
   */
  enhance(module) {
    // Add properties
    module.observer = null;
    module.observerTimeout = null;
    module.lastMessageCount = 0;

    // Add methods
    module.setupMessageObserver = this.setupMessageObserver.bind(module);
    module.destroyMessageObserver = this.destroyMessageObserver.bind(module);
  },

  /**
   * Setup message observer with throttling and optional message count tracking
   * @param {Function} callback - Function to call when messages change
   * @param {Object} options - Configuration options
   * @param {number} options.throttleDelay - Delay in ms for throttling (default: 500)
   * @param {boolean} options.trackMessageCount - Only call callback if message count changes (default: true)
   * @param {boolean} options.checkConversationPage - Only observe on conversation pages (default: true)
   */
  setupMessageObserver(callback, options = {}) {
    const {
      throttleDelay = 500,
      trackMessageCount = true,
      checkConversationPage = true
    } = options;

    // Store callback for cleanup
    this.observerCallback = callback;

    // Create observer
    this.observer = this.dom.observeDOM(() => {
      // Don't process if not on conversation page (if enabled)
      if (checkConversationPage && !this.lastConversationState) {
        return;
      }

      // Clear existing timeout
      clearTimeout(this.observerTimeout);

      // Setup throttled callback
      this.observerTimeout = setTimeout(() => {
        if (trackMessageCount) {
          // Get current messages
          const messages = this.dom.findMessages();
          const currentCount = messages.length;

          // Only call callback if message count changed
          if (currentCount !== this.lastMessageCount) {
            if (this.log) {
              this.log(`Mesaj sayısı güncellendi: ${this.lastMessageCount} → ${currentCount}`);
            }
            this.lastMessageCount = currentCount;
            callback(messages, currentCount, this.lastMessageCount);
          }
        } else {
          // Call callback regardless of message count
          callback();
        }
      }, throttleDelay);
    });

    if (this.log) {
      this.log(`Message observer başlatıldı (throttle: ${throttleDelay}ms, trackCount: ${trackMessageCount})`);
    }
  },

  /**
   * Destroy message observer and cleanup
   */
  destroyMessageObserver() {
    // Clear timeout
    if (this.observerTimeout) {
      clearTimeout(this.observerTimeout);
      this.observerTimeout = null;
    }

    // Disconnect observer
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    // Reset state
    this.lastMessageCount = 0;
    this.observerCallback = null;

    if (this.log) {
      this.log('Message observer durduruldu');
    }
  }
};

export default MessageObserverMixin;
