/**
 * MessageObserverMixin - Reusable observer pattern for message tracking
 * Provides standardized DOM observation with throttling and message count tracking
 * 
 * Note: EditScanner handles version changes separately. This mixin checks
 * the _isUpdating flag to avoid race conditions during version change processing.
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
   */
  setupMessageObserver(callback, options = {}) {
    const {
      throttleDelay = 500,
      trackMessageCount = true,
      checkConversationPage = true,
      forceInitialCallback = false
    } = options;

    // Store callback for cleanup
    this.observerCallback = callback;
    this.hasCalledInitialCallback = false;

    // Create observer
    this.observer = this.dom.observeDOM(() => {
      // Don't process if not on conversation page
      if (checkConversationPage && !this.lastConversationState) {
        return;
      }

      // Clear existing timeout
      clearTimeout(this.observerTimeout);

      // Setup throttled callback
      this.observerTimeout = setTimeout(() => {
        // Skip if module is currently updating via EditScanner
        // This prevents race conditions between observer and version change handler
        if (this._isUpdating) {
          return;
        }

        if (trackMessageCount) {
          const messages = this.dom.findMessages();
          const currentCount = messages.length;

          const shouldCallCallback =
            currentCount !== this.lastMessageCount ||
            (forceInitialCallback && !this.hasCalledInitialCallback);

          if (shouldCallCallback) {
            if (this.log) {
              this.log(`Mesaj sayısı güncellendi: ${this.lastMessageCount} → ${currentCount}`);
            }
            this.lastMessageCount = currentCount;
            this.hasCalledInitialCallback = true;
            callback(messages, currentCount, this.lastMessageCount);
          }
        } else {
          this.hasCalledInitialCallback = true;
          callback();
        }
      }, throttleDelay);
    });

    if (this.log) {
      this.log(`Message observer başlatıldı (throttle: ${throttleDelay}ms)`);
    }
  },

  /**
   * Destroy message observer and cleanup
   */
  destroyMessageObserver() {
    if (this.observerTimeout) {
      clearTimeout(this.observerTimeout);
      this.observerTimeout = null;
    }

    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    this.lastMessageCount = 0;
    this.observerCallback = null;

    if (this.log) {
      this.log('Message observer durduruldu');
    }
  }
};

export default MessageObserverMixin;
