/**
 * MessageHub - Centralized DOM change management
 *
 * Uses a single MutationObserver to track all DOM changes,
 * analyzes them, and distributes events to relevant modules.
 *
 * Replaces: Multiple MessageObserverMixin instances + VersionManager
 *
 * Events emitted:
 * - hub:message_count_changed - When message count changes
 * - hub:version_changed - When edit version changes
 * - hub:content_changed - When any content changes
 * - hub:edit_session_changed - When inline edit textarea starts/ends
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
    this.pendingRescan = false;
    this.activeEditSession = null;

    // Configuration
    this.config = {
      debounceDelay: 300, // Consistent 300ms debounce
      stabilizationDelay: 100, // DOM stabilization wait
    };

    // State cache - keeping previous state for diff calculation
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
   * Start the hub
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
        throttle: 100, // First level throttle (in ObserverManager)
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
    this.pendingRescan = false;
    this.clearActiveEditSession('observer_stopped');

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
   * Schedule processing (debounce)
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
   * Analyze DOM changes and emit events
   */
  async process() {
    if (this.isProcessing) {
      this.pendingRescan = true;
      this.log('Already processing, pending rescan scheduled');
      return;
    }

    this.isProcessing = true;

    try {
      // 1. Invalidate cache
      messageCache.invalidate();

      // 2. Wait briefly for DOM stabilization
      await this.waitForStabilization();

      // 3. Collect all data at once
      const messages = DOMUtils.findMessages();
      this.syncEditSession(messages);
      const editedPrompts = DOMUtils.getEditedPrompts ? DOMUtils.getEditedPrompts() : [];

      // 4. Detect changes
      const changes = this.detectChanges(messages, editedPrompts);

      // 5. Process if there are changes
      if (changes.hasChanges) {
        // Update state
        this.updateState(messages, editedPrompts);

        // Emit events
        this.emitChanges(changes, messages, editedPrompts);
      }
    } catch (error) {
      console.error('[MessageHub] Process error:', error);
    } finally {
      this.isProcessing = false;
      if (this.pendingRescan) {
        this.pendingRescan = false;
        this.scheduleProcess();
      }
    }
  }

  /**
   * Wait for DOM stabilization
   */
  waitForStabilization() {
    return new Promise(resolve => {
      setTimeout(resolve, this.config.stabilizationDelay);
    });
  }

  /**
   * Detect changes
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

    // 1. Did message count change?
    if (messages.length !== this.lastState.messageCount) {
      changes.messageCountChanged = true;
      changes.contentChanged = true;
      changes.hasChanges = true;
      this.log(`Message count: ${this.lastState.messageCount} → ${messages.length}`);
    }

    // 2. Did edit count change?
    if (editedPrompts.length !== this.lastState.editedCount) {
      changes.versionChanged = true;
      changes.hasChanges = true;
      this.log(`Edit count: ${this.lastState.editedCount} → ${editedPrompts.length}`);
    }

    // 3. Did version strings change?
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

  getVersionInfoFromMessage(messageElement) {
    if (!messageElement) {
      return null;
    }

    const pattern = /^\d+\s*\/\s*\d+$/;

    const versionContainer = messageElement.querySelector('.inline-flex.items-center.gap-1');
    if (versionContainer) {
      const versionSpan = versionContainer.querySelector('span');
      if (versionSpan && pattern.test(versionSpan.textContent.trim())) {
        return versionSpan.textContent.trim();
      }
    }

    const userMessage = messageElement.querySelector('[data-testid="user-message"]');
    const allSpans = messageElement.querySelectorAll('span');
    for (const span of allSpans) {
      if (userMessage && userMessage.contains(span)) {
        continue;
      }
      const text = span.textContent.trim();
      if (pattern.test(text)) {
        return text;
      }
    }

    return null;
  }

  findActiveEditSession(messages) {
    const chatContainer = DOMUtils.getChatContainer();
    if (!chatContainer) {
      return null;
    }

    const textareas = Array.from(chatContainer.querySelectorAll('textarea'));
    for (const textarea of textareas) {
      if (textarea.closest('[data-testid="chat-input"], [data-testid="prompt-input"]')) {
        continue;
      }

      const editForm = textarea.closest('form');
      if (!editForm) {
        continue;
      }

      const hasSubmit = !!editForm.querySelector('button[type="submit"]');
      const hasCancel = !!editForm.querySelector('button[type="button"]');
      if (!hasSubmit || !hasCancel) {
        continue;
      }

      const messageIndex = messages.findIndex(message => message.contains(textarea));
      if (messageIndex < 0) {
        continue;
      }

      const messageElement = messages[messageIndex];
      const containerId = `edit-index-${messageIndex}`;
      const userMessage = messageElement.querySelector('[data-testid="user-message"]');
      messageElement.setAttribute('data-edit-container-id', containerId);
      if (userMessage) {
        userMessage.setAttribute('data-edit-container-id', containerId);
      }
      textarea.setAttribute('data-edit-container-id', containerId);

      return {
        sessionKey: `${window.location.pathname}|${containerId}`,
        conversationUrl: window.location.pathname,
        containerId,
        messageIndex,
        versionInfo: this.getVersionInfoFromMessage(messageElement),
        textarea,
        messageElement,
        timestamp: Date.now(),
      };
    }

    return null;
  }

  emitEditSessionChanged(active, reason, session) {
    this.log(`Emitting: hub:edit_session_changed (${reason})`);
    eventBus.emit(Events.HUB_EDIT_SESSION_CHANGED, {
      active,
      reason,
      session,
      timestamp: Date.now(),
    });
  }

  clearActiveEditSession(reason = 'ended') {
    if (!this.activeEditSession) {
      return;
    }

    const endedSession = this.activeEditSession;
    this.activeEditSession = null;
    this.emitEditSessionChanged(false, reason, endedSession);
  }

  syncEditSession(messages) {
    const detectedSession = this.findActiveEditSession(messages);

    if (!detectedSession) {
      this.clearActiveEditSession('ended');
      return;
    }

    if (!this.activeEditSession) {
      this.activeEditSession = detectedSession;
      this.emitEditSessionChanged(true, 'started', detectedSession);
      return;
    }

    const isSameSession =
      this.activeEditSession.sessionKey === detectedSession.sessionKey &&
      this.activeEditSession.textarea === detectedSession.textarea;

    if (isSameSession) {
      return;
    }

    this.clearActiveEditSession('switched');
    this.activeEditSession = detectedSession;
    this.emitEditSessionChanged(true, 'started', detectedSession);
  }

  /**
   * Update internal state
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
   * Emit events
   */
  emitChanges(changes, messages, editedPrompts) {
    // Central event data
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
   * Trigger manual scan (for VersionManager.scan() compatibility)
   */
  refresh() {
    this.log('Manual refresh requested');
    this.scheduleProcess();
  }

  /**
   * Force immediate scan (without waiting)
   */
  forceRefresh() {
    this.log('Force refresh requested');
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.process();
  }

  /**
   * Stop the hub
   */
  stop() {
    // Stop observer
    this.stopObserver();

    // Clean up navigation listener
    if (this.navigationUnsubscribe) {
      this.navigationUnsubscribe();
      this.navigationUnsubscribe = null;
    }

    // Reset state
    this.resetState();

    this.log('Stopped');
  }

  /**
   * Reset state (on page change)
   */
  resetState() {
    this.clearActiveEditSession('state_reset');
    this.lastState = {
      messageCount: 0,
      editedCount: 0,
      editVersions: new Map(),
    };
    this.pendingRescan = false;
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
      editSessionActive: !!this.activeEditSession,
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
