/**
 * MessageHub - Merkezi DOM değişiklik yönetimi
 *
 * Tek MutationObserver ile tüm DOM değişikliklerini izler,
 * analiz eder ve ilgili modüllere event olarak dağıtır.
 *
 * Replaces: Multiple MessageObserverMixin instances + VersionManager
 *
 * Events emitted:
 * - hub:message_count_changed - Mesaj sayısı değiştiğinde
 * - hub:version_changed - Edit version değiştiğinde
 * - hub:content_changed - Herhangi bir içerik değişikliğinde
 */

import DOMUtils from '../utils/DOMUtils.js';
import ObserverManager from '../managers/ObserverManager.js';
import navigationInterceptor from './NavigationInterceptor.js';
import { eventBus, Events } from '../utils/EventBus.js';
import messageCache from './MessageCache.js';
import { debugLog } from '../config/debug.js';

class MessageHub {
  constructor() {
    this.observer = null;
    this.debounceTimer = null;
    this.isProcessing = false;
    this.isStarted = false;

    // Configuration
    this.config = {
      debounceDelay: 300, // Tutarlı 300ms debounce
      stabilizationDelay: 100, // DOM stabilizasyon bekleme
    };

    // State cache - önceki durumu tutarak diff hesaplama
    this.lastState = {
      messageCount: 0,
      editedCount: 0,
      editVersions: new Map(), // containerId -> versionString
    };

    // Debug
    this.debugMode = false;

    // Navigation listener cleanup
    this.navigationUnsubscribe = null;
  }

  /**
   * Hub'ı başlat
   */
  start() {
    if (this.isStarted) {
      this.log('Already started, skipping');
      return;
    }

    // Setup navigation listener for page transitions
    this.setupNavigationListener();

    const target = DOMUtils.getChatContainer();
    if (!target) {
      console.warn('[MessageHub] Chat container not found, retrying in 500ms');
      setTimeout(() => this.start(), 500);
      return;
    }

    this.startObserver(target);
  }

  /**
   * Setup navigation listener to handle page transitions
   */
  setupNavigationListener() {
    if (this.navigationUnsubscribe) {
      this.navigationUnsubscribe();
    }

    this.navigationUnsubscribe = navigationInterceptor.onNavigate(event => {
      // When entering a conversation page, restart observer
      if (event.isConversationPage && !event.wasConversationPage) {
        this.log('Navigation: entering conversation page, restarting...');
        this.restart();
      }
      // When leaving conversation page, reset state
      else if (!event.isConversationPage && event.wasConversationPage) {
        this.log('Navigation: leaving conversation page, resetting state...');
        this.resetState();
        this.stopObserver();
      }
    });
  }

  /**
   * Start the MutationObserver
   */
  startObserver(target) {
    if (!target) {
      target = DOMUtils.getChatContainer();
    }

    if (!target) {
      console.warn('[MessageHub] Chat container not found for observer');
      return;
    }

    this.observer = ObserverManager.observe(
      'message-hub',
      target,
      () => {
        this.scheduleProcess();
      },
      {
        childList: true,
        subtree: true,
        attributes: false,
        throttle: 100, // İlk seviye throttle (ObserverManager'da)
      }
    );

    this.isStarted = true;
    this.log('Started');

    // Initial scan
    setTimeout(() => this.process(), 200);
  }

  /**
   * Stop only the observer (keep navigation listener)
   */
  stopObserver() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    ObserverManager.disconnect('message-hub');
    this.observer = null;
    this.isStarted = false;
    this.log('Observer stopped');
  }

  /**
   * Restart the hub (for page transitions)
   */
  restart() {
    this.log('Restarting...');
    this.stopObserver();
    this.resetState();

    // Wait a bit for DOM to stabilize, then start
    setTimeout(() => {
      const target = DOMUtils.getChatContainer();
      if (target) {
        this.startObserver(target);
      } else {
        // Retry if container not ready yet
        this.log('Container not ready, scheduling retry...');
        setTimeout(() => this.restart(), 300);
      }
    }, 200);
  }

  /**
   * İşlemeyi planla (debounce)
   */
  scheduleProcess() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.process();
    }, this.config.debounceDelay);
  }

  /**
   * DOM değişikliklerini analiz et ve event'leri yayınla
   */
  async process() {
    if (this.isProcessing) {
      this.log('Already processing, skipping');
      return;
    }

    this.isProcessing = true;

    try {
      // 1. Cache'i invalidate et
      messageCache.invalidate();

      // 2. DOM stabilizasyonu için kısa bekle
      await this.waitForStabilization();

      // 3. Tek seferde tüm veriyi topla
      const messages = DOMUtils.findMessages();
      const editedPrompts = DOMUtils.getEditedPrompts ? DOMUtils.getEditedPrompts() : [];

      // 4. Değişiklikleri tespit et
      const changes = this.detectChanges(messages, editedPrompts);

      // 5. Değişiklik varsa işle
      if (changes.hasChanges) {
        // State'i güncelle
        this.updateState(messages, editedPrompts);

        // Event'leri yayınla
        this.emitChanges(changes, messages, editedPrompts);
      }
    } catch (error) {
      console.error('[MessageHub] Process error:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * DOM stabilizasyonu için bekle
   */
  waitForStabilization() {
    return new Promise(resolve => {
      setTimeout(resolve, this.config.stabilizationDelay);
    });
  }

  /**
   * Değişiklikleri tespit et
   */
  detectChanges(messages, editedPrompts) {
    const changes = {
      hasChanges: false,
      messageCountChanged: false,
      versionChanged: false,
      contentChanged: false,
      details: {
        oldMessageCount: this.lastState.messageCount,
        newMessageCount: messages.length,
        oldEditCount: this.lastState.editedCount,
        newEditCount: editedPrompts.length,
        editChanges: [],
      },
    };

    // 1. Mesaj sayısı değişti mi?
    if (messages.length !== this.lastState.messageCount) {
      changes.messageCountChanged = true;
      changes.contentChanged = true;
      changes.hasChanges = true;
      this.log(`Message count: ${this.lastState.messageCount} → ${messages.length}`);
    }

    // 2. Edit sayısı değişti mi?
    if (editedPrompts.length !== this.lastState.editedCount) {
      changes.versionChanged = true;
      changes.hasChanges = true;
      this.log(`Edit count: ${this.lastState.editedCount} → ${editedPrompts.length}`);
    }

    // 3. Version string'leri değişti mi?
    if (!changes.versionChanged) {
      for (const edit of editedPrompts) {
        const lastVersion = this.lastState.editVersions.get(edit.containerId);
        if (lastVersion !== edit.versionInfo) {
          changes.versionChanged = true;
          changes.hasChanges = true;
          changes.details.editChanges.push({
            containerId: edit.containerId,
            oldVersion: lastVersion,
            newVersion: edit.versionInfo,
          });
          this.log(`Version change: ${edit.containerId} (${lastVersion} → ${edit.versionInfo})`);
        }
      }
    }

    return changes;
  }

  /**
   * Internal state'i güncelle
   */
  updateState(messages, editedPrompts) {
    this.lastState.messageCount = messages.length;
    this.lastState.editedCount = editedPrompts.length;

    this.lastState.editVersions.clear();
    editedPrompts.forEach(edit => {
      this.lastState.editVersions.set(edit.containerId, edit.versionInfo);
    });
  }

  /**
   * Event'leri yayınla
   */
  emitChanges(changes, messages, editedPrompts) {
    // Merkezi event data
    const eventData = {
      messages,
      messageCount: messages.length,
      editedPrompts,
      editCount: editedPrompts.length,
      changes: changes.details,
      timestamp: Date.now(),
    };

    // 1. Message count changed
    if (changes.messageCountChanged) {
      this.log('Emitting: hub:message_count_changed');
      eventBus.emit(Events.HUB_MESSAGE_COUNT_CHANGED, eventData);

      // Backward compatibility
      eventBus.emit(Events.MESSAGES_UPDATED, messages);
    }

    // 2. Version changed
    if (changes.versionChanged) {
      this.log('Emitting: hub:version_changed');
      eventBus.emit(Events.HUB_VERSION_CHANGED, eventData);
    }

    // 3. Any content change
    if (changes.contentChanged || changes.versionChanged) {
      this.log('Emitting: hub:content_changed');
      eventBus.emit(Events.HUB_CONTENT_CHANGED, eventData);
    }
  }

  /**
   * Manuel tarama tetikle (VersionManager.scan() uyumluluğu için)
   */
  refresh() {
    this.log('Manual refresh requested');
    this.scheduleProcess();
  }

  /**
   * Zorla anında tarama (beklemeden)
   */
  forceRefresh() {
    this.log('Force refresh requested');
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.process();
  }

  /**
   * Hub'ı durdur
   */
  stop() {
    // Stop observer
    this.stopObserver();

    // Clean up navigation listener
    if (this.navigationUnsubscribe) {
      this.navigationUnsubscribe();
      this.navigationUnsubscribe = null;
    }

    // State'i sıfırla
    this.resetState();

    this.log('Stopped');
  }

  /**
   * State'i sıfırla (sayfa değişikliğinde)
   */
  resetState() {
    this.lastState = {
      messageCount: 0,
      editedCount: 0,
      editVersions: new Map(),
    };
    this.log('State reset');
  }

  /**
   * Durum bilgisi
   */
  getStatus() {
    return {
      isStarted: this.isStarted,
      isProcessing: this.isProcessing,
      lastState: {
        messageCount: this.lastState.messageCount,
        editedCount: this.lastState.editedCount,
        editVersionCount: this.lastState.editVersions.size,
      },
      config: { ...this.config },
    };
  }

  /**
   * Debug modu
   */
  setDebugMode(enabled) {
    this.debugMode = enabled;
    this.log(`Debug mode: ${enabled ? 'ON' : 'OFF'}`);
  }

  /**
   * Log helper
   */
  log(...args) {
    if (this.debugMode) {
      debugLog('messageHub', ...args);
    }
  }
}

// Singleton export
export const messageHub = new MessageHub();
export default messageHub;
