/**
 * VersionManager - Shared version detection logic
 *
 * @deprecated Bu sınıf artık MessageHub tarafından destekleniyor.
 * Yeni kod için doğrudan Events.HUB_VERSION_CHANGED event'ini kullanın.
 *
 * Geriye uyumluluk için korunmuştur:
 * - onVersionChange() → eventBus.on(Events.HUB_VERSION_CHANGED) wrapper
 * - scan() → messageHub.refresh() wrapper
 * - start()/stop() → no-op (MessageHub tarafından yönetiliyor)
 */

import { eventBus, Events } from '../utils/EventBus.js';
import { messageHub } from './MessageHub.js';

class VersionManager {
  constructor() {
    this.callbacks = new Set();
    this.isStarted = false;
    this.hubUnsubscribe = null;
  }

  /**
   * @deprecated MessageHub.start() tarafından yönetiliyor
   */
  start() {
    if (this.isStarted) return;
    this.isStarted = true;

    // MessageHub'dan version change event'lerini dinle
    this.hubUnsubscribe = eventBus.on(Events.HUB_VERSION_CHANGED, (data) => {
      // Eski callback formatına dönüştür
      const legacyData = {
        reason: 'Version change from MessageHub',
        edits: data.editedPrompts,
        isVersionChange: true
      };
      this.notifySubscribers(legacyData);
    });

    console.log('[VersionManager] 🚀 Started (delegating to MessageHub)');
  }

  /**
   * @deprecated MessageHub.stop() tarafından yönetiliyor
   */
  stop() {
    if (this.hubUnsubscribe) {
      this.hubUnsubscribe();
      this.hubUnsubscribe = null;
    }
    this.isStarted = false;
    console.log('[VersionManager] 🛑 Stopped');
  }

  /**
   * Register for version changes
   * @deprecated Doğrudan eventBus.on(Events.HUB_VERSION_CHANGED) kullanın
   */
  onVersionChange(callback) {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  /**
   * Trigger a scan
   * @deprecated Doğrudan messageHub.refresh() kullanın
   */
  scan() {
    messageHub.refresh();
  }

  /**
   * Force immediate scan
   * @deprecated Doğrudan messageHub.forceRefresh() kullanın
   */
  forceRefresh() {
    messageHub.forceRefresh();
  }

  /**
   * Notify all legacy subscribers
   * @private
   */
  notifySubscribers(data) {
    this.callbacks.forEach(cb => {
      try {
        cb(data);
      } catch (err) {
        console.error('[VersionManager] Callback error:', err);
      }
    });
  }
}

// Singleton
export const versionManager = new VersionManager();
