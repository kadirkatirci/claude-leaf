/**
 * MessageRegistry - Centralized message management
 *
 * Single Source of Truth for all message-related operations.
 * All modules (Navigation, Bookmark, EmojiMarker, EditHistory) use this registry
 * instead of finding messages independently.
 *
 * Key Features:
 * - Stable IDs that survive version changes and page reloads
 * - Centralized DOM observation (single observer for all modules)
 * - Consistent message list across all modules
 * - Edit version change detection
 * - Navigation-aware with automatic restart on page change
 *
 * StableId Strategy:
 * - Based on user message content hash + occurrence index
 * - User message content never changes (even when edit version changes)
 * - Occurrence index handles duplicate messages (same user text sent twice)
 */

import { hashString } from '../utils/HashUtils.js';
import DOMUtilsCore from '../utils/DOMUtils-Core.js';
import ObserverManager from '../managers/ObserverManager.js';
import navigationInterceptor, { PageType } from './NavigationInterceptor.js';
import domReadyChecker from '../utils/DOMReadyChecker.js';

// Singleton instance
let registryInstance = null;

class MessageRegistry {
  constructor() {
    // Singleton pattern - return existing instance
    if (registryInstance) {
      return registryInstance;
    }

    this.messages = [];
    this.messageMap = new Map(); // stableId -> message data
    this.observerId = 'message-registry';
    this.observerTimeout = null;
    this.lastScanTime = 0;
    this.isStarted = false;
    this.isStarting = false; // Prevent concurrent start attempts
    this.debugMode = false;

    // Callbacks for different event types
    this.changeCallbacks = new Set();
    this.versionCallbacks = new Set();

    // Track edit versions for change detection
    this.editVersions = new Map(); // stableId -> versionInfo

    // Navigation subscription
    this.navigationUnsubscribe = null;

    // Retry state
    this.startRetryCount = 0;
    this.maxStartRetries = 10;
    this.startRetryTimer = null;

    registryInstance = this;

    // Debug: Make accessible from console
    window.__messageRegistry = this;
    // Measurement toggle (disabled by default to avoid console spam)
    this.measurementEnabled = false;
  }

  /**
   * Get singleton instance
   */
  static getInstance() {
    if (!registryInstance) {
      new MessageRegistry();
    }
    return registryInstance;
  }

  /**
   * Initialize and start observing with robust retry mechanism
   */
  async start() {
    if (this.isStarted) {
      this.log('Already started, skipping');
      return;
    }

    if (this.isStarting) {
      this.log('Start already in progress, skipping');
      return;
    }

    this.isStarting = true;
    this.log('Starting MessageRegistry...');

    try {
      // Subscribe to navigation events first
      this.setupNavigationListener();

      // Check if we're on a conversation page
      const state = navigationInterceptor.getState();

      if (!state.isConversationPage) {
        this.log(`Not on conversation page (${state.pageType}), waiting for navigation`);
        this.isStarting = false;
        return;
      }

      // Wait for DOM to be ready
      const isReady = await domReadyChecker.waitForConversationReady({
        maxWait: 5000,
        requireMessages: false,
      });

      if (!isReady) {
        this.log('DOM not ready after waiting, will retry on next navigation');
        this.isStarting = false;
        return;
      }

      // Try to start observer with retry
      await this.startObserverWithRetry();
    } catch (error) {
      console.error('[MessageRegistry] Error during start:', error);
      this.isStarting = false;
    }
  }

  /**
   * Start observer with exponential backoff retry
   */
  async startObserverWithRetry() {
    const maxRetries = this.maxStartRetries;
    let delay = 100;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      this.startRetryCount = attempt;

      const chatContainer = DOMUtilsCore.getChatContainer();

      if (chatContainer) {
        // Initial scan
        this.scan();

        // Setup DOM observer
        ObserverManager.observe(
          this.observerId,
          chatContainer,
          mutations => {
            // Observer callback measurement + mutation count reporting
            const cbStart = this.measurementEnabled ? performance.now() : 0;

            clearTimeout(this.observerTimeout);
            this.observerTimeout = setTimeout(() => {
              const scanStart = this.measurementEnabled ? performance.now() : 0;
              try {
                this.scan();
              } finally {
                if (this.measurementEnabled) {
                  const scanEnd = performance.now();
                  const cbEnd = performance.now();
                  const scanMs = Math.round(scanEnd - scanStart);
                  const cbMs = Math.round(cbEnd - cbStart);
                  const mCount = Array.isArray(mutations) ? mutations.length : 0;

                  console.groupCollapsed(
                    '[MR] MessageRegistry scan',
                    `${scanMs}ms`,
                    `mutations:${mCount}`,
                    `messages:${this.messages.length}`
                  );
                  console.log('[MR] scan time:', `${scanMs}ms`);
                  console.log('[MR] observer callback overhead:', `${cbMs}ms`);
                  console.log('[MR] mutation count:', mCount);
                  console.groupEnd();
                }
              }
            }, 150);

            if (this.measurementEnabled) {
              const cbNow = performance.now();
              const entryMs = Math.round(cbNow - cbStart);
              if (entryMs > 5) {
                console.log('[MR] observer callback entry overhead:', `${entryMs}ms`);
              }
            }
          },
          {
            childList: true,
            subtree: true,
            attributes: false,
            throttle: 100,
          }
        );

        this.isStarted = true;
        this.isStarting = false;
        this.startRetryCount = 0;

        this.log(
          `Started successfully after ${attempt + 1} attempts, found ${this.messages.length} messages`
        );
        return;
      }

      this.log(`Chat container not found, retry ${attempt + 1}/${maxRetries} in ${delay}ms`);

      await new Promise(resolve => setTimeout(resolve, delay));
      delay = Math.min(delay * 1.5, 1000); // Exponential backoff, max 1s
    }

    this.log(`Failed to start after ${maxRetries} retries`);
    this.isStarting = false;
  }

  /**
   * Setup navigation listener for automatic restart on page change
   */
  setupNavigationListener() {
    // Clean up existing subscription
    if (this.navigationUnsubscribe) {
      this.navigationUnsubscribe();
    }

    this.navigationUnsubscribe = navigationInterceptor.onNavigate(event => {
      this.handleNavigationEvent(event);
    });

    this.log('Navigation listener setup');
  }

  /**
   * Handle navigation events
   */
  async handleNavigationEvent(event) {
    // Skip initial events (handled by start())
    if (event.type === 'initial' && this.isStarted) {
      return;
    }

    this.log(`Navigation event: ${event.type}, pageType: ${event.pageType}`);

    // Leaving conversation page
    if (event.wasConversationPage && !event.isConversationPage) {
      this.log('Left conversation page, clearing messages');
      this.clearAndStop();
      return;
    }

    // Entering conversation page
    if (event.isConversationPage) {
      // If coming from /new page, this is a new conversation
      if (event.wasNewChatPage) {
        this.log('Navigated from /new to conversation, restarting');
      } else if (event.wasConversationPage) {
        this.log('Navigated between conversations, restarting');
      } else {
        this.log('Entered conversation page, starting');
      }

      // Stop current observation
      this.stopObserver();

      // Wait for new page DOM to be ready
      const isReady = await domReadyChecker.waitForConversationReady({
        maxWait: 5000,
        requireMessages: false,
      });

      if (isReady) {
        // Restart observer for new conversation
        this.isStarted = false;
        this.isStarting = false;
        await this.startObserverWithRetry();
      } else {
        this.log('New conversation DOM not ready, will retry');
      }
    }
  }

  /**
   * Stop observer only (keep navigation listener)
   */
  stopObserver() {
    ObserverManager.disconnect(this.observerId);

    if (this.observerTimeout) {
      clearTimeout(this.observerTimeout);
      this.observerTimeout = null;
    }

    if (this.startRetryTimer) {
      clearTimeout(this.startRetryTimer);
      this.startRetryTimer = null;
    }

    this.isStarted = false;
    this.isStarting = false;
  }

  /**
   * Clear messages and stop observer
   */
  clearAndStop() {
    this.stopObserver();

    // Clear messages
    if (this.messages.length > 0) {
      this.messages = [];
      this.messageMap.clear();
      this.editVersions.clear();
      this.notifyChange('page_changed', []);
    }
  }

  /**
   * Stop observing completely (including navigation listener)
   */
  stop() {
    this.stopObserver();

    // Clean up navigation listener
    if (this.navigationUnsubscribe) {
      this.navigationUnsubscribe();
      this.navigationUnsubscribe = null;
    }

    this.changeCallbacks.clear();
    this.versionCallbacks.clear();

    this.log('Stopped completely');
  }

  /**
   * Restart the registry (full stop and start)
   */
  async restart() {
    this.log('Restarting...');
    this.stopObserver();

    // Brief delay to allow DOM to settle
    await new Promise(resolve => setTimeout(resolve, 100));

    this.isStarted = false;
    this.isStarting = false;
    await this.start();
  }

  /**
   * Scan DOM and update message registry
   */
  scan() {
    // Check if we're on a conversation page using NavigationInterceptor
    const state = navigationInterceptor.getState();

    if (!state.isConversationPage) {
      if (this.messages.length > 0) {
        this.messages = [];
        this.messageMap.clear();
        this.editVersions.clear();
        this.notifyChange('page_changed', []);
      }
      return;
    }

    const elements = DOMUtilsCore.findActualMessages();
    const newMessages = [];
    const newMessageMap = new Map();
    const hashOccurrences = new Map();

    let hasChanges = false;
    let hasVersionChange = false;
    let changeReason = '';
    const versionChanges = [];

    elements.forEach((element, domIndex) => {
      const userMessageEl = element.querySelector('[data-testid="user-message"]');
      const isUserMessage = !!userMessageEl;

      let userContent = '';
      let parentStableId = null;

      if (isUserMessage) {
        userContent = userMessageEl.textContent.trim();
      } else {
        for (let i = domIndex - 1; i >= 0; i--) {
          const prevUserMsg = elements[i].querySelector('[data-testid="user-message"]');
          if (prevUserMsg) {
            userContent = prevUserMsg.textContent.trim();
            break;
          }
        }
      }

      const userHash = hashString(userContent.substring(0, 200));
      const occurrence = hashOccurrences.get(userHash) || 0;
      hashOccurrences.set(userHash, occurrence + 1);

      const messageType = isUserMessage ? 'u' : 'c';
      const stableId = `msg-${userHash}-${occurrence}-${messageType}`;

      if (!isUserMessage) {
        parentStableId = `msg-${userHash}-${occurrence}-u`;
      }

      const contentEl = isUserMessage ? userMessageEl : element;
      const contentText = this.getCleanText(contentEl);
      const contentSignature = hashString(contentText.substring(0, 500));
      const contentPreview = contentText.substring(0, 100).trim();

      let versionInfo = null;
      let currentVersion = null;
      let totalVersions = null;

      const allSpans = element.querySelectorAll('span');
      for (const span of allSpans) {
        const text = span.textContent.trim();
        if (/^\d+\s*\/\s*\d+$/.test(text)) {
          versionInfo = text;
          const parts = text.split('/');
          currentVersion = parseInt(parts[0].trim());
          totalVersions = parseInt(parts[1].trim());
          break;
        }
      }

      if (versionInfo && this.editVersions.has(stableId)) {
        const lastVersion = this.editVersions.get(stableId);
        if (lastVersion !== versionInfo) {
          hasVersionChange = true;
          versionChanges.push({
            stableId,
            from: lastVersion,
            to: versionInfo,
          });
          changeReason = `Version changed: ${stableId} "${lastVersion}" → "${versionInfo}"`;
        }
      }

      if (versionInfo) {
        this.editVersions.set(stableId, versionInfo);
      }

      const messageData = {
        element,
        stableId,
        domIndex,
        isUserMessage,
        parentStableId,
        contentSignature,
        contentPreview,
        versionInfo,
        currentVersion,
        totalVersions,
        hasEditHistory: totalVersions > 1,
      };

      newMessages.push(messageData);
      newMessageMap.set(stableId, messageData);
    });

    if (!hasChanges && newMessages.length !== this.messages.length) {
      hasChanges = true;
      changeReason =
        changeReason || `Message count: ${this.messages.length} → ${newMessages.length}`;
    }

    if (!hasChanges) {
      const oldIds = new Set(this.messages.map(m => m.stableId));
      const newIds = new Set(newMessages.map(m => m.stableId));

      for (const id of newIds) {
        if (!oldIds.has(id)) {
          hasChanges = true;
          changeReason = changeReason || `New message: ${id}`;
          break;
        }
      }

      if (!hasChanges) {
        for (const id of oldIds) {
          if (!newIds.has(id)) {
            hasChanges = true;
            changeReason = changeReason || `Removed message: ${id}`;
            break;
          }
        }
      }
    }

    this.messages = newMessages;
    this.messageMap = newMessageMap;
    this.lastScanTime = Date.now();

    if (hasChanges || hasVersionChange) {
      if (hasVersionChange) {
        this.notifyVersionChange(versionChanges);
      }
      this.notifyChange(changeReason, newMessages);
    }
  }

  /**
   * Get clean text content from element
   */
  getCleanText(element) {
    if (!element) {
      return '';
    }

    const clone = element.cloneNode(true);

    const selectorsToRemove = [
      '.emoji-marker-btn',
      '.emoji-marker-badge',
      '.emoji-marker-options',
      '.claude-bookmark-btn',
      '.bookmark-badge',
      '[class*="marker"]',
      '[class*="bookmark"]',
      'button',
      'script',
      'style',
    ];

    selectorsToRemove.forEach(selector => {
      clone.querySelectorAll(selector).forEach(el => el.remove());
    });

    return clone.textContent.trim();
  }

  /**
   * Subscribe to any message changes
   */
  onChange(callback) {
    this.changeCallbacks.add(callback);
    return () => {
      this.changeCallbacks.delete(callback);
    };
  }

  /**
   * Subscribe to edit version changes only
   */
  onVersionChange(callback) {
    this.versionCallbacks.add(callback);
    return () => {
      this.versionCallbacks.delete(callback);
    };
  }

  notifyChange(reason, messages) {
    this.log(`Change: ${reason}, ${messages.length} messages`);

    this.changeCallbacks.forEach(callback => {
      try {
        callback(reason, messages);
      } catch (error) {
        console.error('[MessageRegistry] Error in change callback:', error);
      }
    });
  }

  notifyVersionChange(versionChanges) {
    this.versionCallbacks.forEach(callback => {
      try {
        callback(versionChanges);
      } catch (error) {
        console.error('[MessageRegistry] Error in version callback:', error);
      }
    });
  }

  getMessages() {
    return this.messages;
  }

  getElements() {
    return this.messages.map(m => m.element);
  }

  getByStableId(stableId) {
    return this.messageMap.get(stableId) || null;
  }

  getByIndex(index) {
    return this.messages[index] || null;
  }

  findBySignature(signature) {
    return this.messages.find(m => m.contentSignature === signature) || null;
  }

  findByPreview(preview) {
    const normalized = preview.toLowerCase().trim().substring(0, 50);
    return (
      this.messages.find(
        m => m.contentPreview.toLowerCase().trim().substring(0, 50) === normalized
      ) || null
    );
  }

  /**
   * Resolve a marker/bookmark to current message
   */
  resolveMarker(marker) {
    if (marker.stableId) {
      const message = this.getByStableId(marker.stableId);
      if (message) {
        return { message, status: 'exact', resolvedIndex: message.domIndex };
      }
    }

    if (marker.contentSignature) {
      const message = this.findBySignature(marker.contentSignature);
      if (message) {
        return { message, status: 'signature', resolvedIndex: message.domIndex };
      }
    }

    const preview = marker.messagePreview || marker.previewText;
    if (preview) {
      const message = this.findByPreview(preview);
      if (message) {
        return { message, status: 'preview', resolvedIndex: message.domIndex };
      }
    }

    if (marker.index !== undefined && marker.index >= 0 && marker.index < this.messages.length) {
      const message = this.messages[marker.index];
      return { message, status: 'index', resolvedIndex: marker.index };
    }

    return { message: null, status: 'not_found', resolvedIndex: null };
  }

  resolveMarkers(markers) {
    return markers.map(marker => ({
      marker,
      ...this.resolveMarker(marker),
    }));
  }

  getValidMarkers(markers) {
    return this.resolveMarkers(markers).filter(result => result.message !== null);
  }

  get length() {
    return this.messages.length;
  }

  getCurrentVisibleIndex() {
    return DOMUtilsCore.getCurrentVisibleMessageIndex(this.getElements());
  }

  getEditedMessages() {
    return this.messages.filter(m => m.hasEditHistory);
  }

  rescan() {
    this.scan();
  }

  /**
   * Enable or disable measurement logging
   * Call at runtime via `window.__messageRegistry.setMeasurementEnabled(true)`
   */
  setMeasurementEnabled(enabled) {
    this.measurementEnabled = !!enabled;
    if (this.measurementEnabled) {
      console.log('[MR] MessageRegistry measurement enabled');
    } else {
      console.log('[MR] MessageRegistry measurement disabled');
    }
  }

  /**
   * Set debug mode
   */
  setDebugMode(enabled) {
    this.debugMode = enabled;
  }

  /**
   * Log helper
   */
  log(...args) {
    if (this.debugMode) {
      console.log('[MessageRegistry]', ...args);
    }
  }

  /**
   * Get status for debugging
   */
  getStatus() {
    return {
      isStarted: this.isStarted,
      isStarting: this.isStarting,
      messageCount: this.messages.length,
      callbackCount: this.changeCallbacks.size,
      versionCallbackCount: this.versionCallbacks.size,
      lastScanTime: this.lastScanTime,
      startRetryCount: this.startRetryCount,
      hasNavigationListener: !!this.navigationUnsubscribe,
    };
  }
}

export default MessageRegistry;
