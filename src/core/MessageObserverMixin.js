/**
 * MessageObserverMixin - Reusable observer pattern for message tracking
 * Provides standardized DOM observation with throttling and message count tracking
 *
 * @deprecated Bu mixin artık kullanılmamalıdır. Bunun yerine MessageHub kullanın.
 *
 * Yeni kod için:
 * - this.subscribe(Events.HUB_MESSAGE_COUNT_CHANGED, callback) - mesaj sayısı değiştiğinde
 * - this.subscribe(Events.HUB_VERSION_CHANGED, callback) - edit version değiştiğinde
 * - this.subscribe(Events.HUB_CONTENT_CHANGED, callback) - herhangi bir içerik değişikliğinde
 *
 * MessageHub tüm modüller için tek bir MutationObserver kullanır ve
 * merkezi event dağıtımı sağlar.
 *
 * v2.1.1 - Added MessageCache invalidation for performance
 *
 * Note: EditScanner handles version changes separately. This mixin checks
 * the _isUpdating flag to avoid race conditions during version change processing.
 */

import messageCache from './MessageCache.js';

const MessageObserverMixin = {
  /**
   * Enhance a module with message observer capabilities
   * @deprecated Use MessageHub events instead (HUB_MESSAGE_COUNT_CHANGED, HUB_CONTENT_CHANGED)
   * @param {Object} module - Module instance to enhance
   */
  enhance(module) {
    console.warn(
      `[MessageObserverMixin] @deprecated - ${module.name || 'Unknown'} modülü hala MessageObserverMixin kullanıyor. ` +
        "Bunun yerine MessageHub event'lerini kullanın: HUB_MESSAGE_COUNT_CHANGED, HUB_CONTENT_CHANGED"
    );

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
      forceInitialCallback = false,
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

        // IMPORTANT: Invalidate message cache before fetching
        // This ensures all modules get fresh data after DOM changes
        if (typeof messageCache !== 'undefined' && messageCache.invalidate) {
          messageCache.invalidate();
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
  },
};

export default MessageObserverMixin;
