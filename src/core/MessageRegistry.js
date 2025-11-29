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
 * 
 * StableId Strategy:
 * - Based on user message content hash + occurrence index
 * - User message content never changes (even when edit version changes)
 * - Occurrence index handles duplicate messages (same user text sent twice)
 */

import { hashString } from '../utils/HashUtils.js';
import DOMUtilsCore from '../utils/DOMUtils-Core.js';
import ObserverManager from '../managers/ObserverManager.js';

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
    
    // Callbacks for different event types
    this.changeCallbacks = new Set();
    this.versionCallbacks = new Set();
    
    // Track edit versions for change detection
    this.editVersions = new Map(); // stableId -> versionInfo
    
    registryInstance = this;
    
    // Debug: Make accessible from console
    window.__messageRegistry = this;
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
   * Initialize and start observing
   */
  start() {
    if (this.isStarted) {
      return;
    }
    
    // Initial scan
    this.scan();
    
    // Setup DOM observer using ObserverManager
    const chatContainer = DOMUtilsCore.getChatContainer();
    
    if (chatContainer) {
      ObserverManager.observe(
        this.observerId,
        chatContainer,
        () => {
          clearTimeout(this.observerTimeout);
          this.observerTimeout = setTimeout(() => this.scan(), 150);
        },
        {
          childList: true,
          subtree: true,
          attributes: false,
          throttle: 100
        }
      );
      
      this.isStarted = true;
    } else {
      // Retry after a short delay
      setTimeout(() => {
        if (!this.isStarted) {
          this.start();
        }
      }, 500);
    }
  }
  
  /**
   * Stop observing
   */
  stop() {
    ObserverManager.disconnect(this.observerId);
    
    if (this.observerTimeout) {
      clearTimeout(this.observerTimeout);
      this.observerTimeout = null;
    }
    
    this.changeCallbacks.clear();
    this.versionCallbacks.clear();
    this.isStarted = false;
  }
  
  /**
   * Scan DOM and update message registry
   */
  scan() {
    if (!DOMUtilsCore.isOnConversationPage()) {
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
            to: versionInfo
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
        hasEditHistory: totalVersions > 1
      };
      
      newMessages.push(messageData);
      newMessageMap.set(stableId, messageData);
    });
    
    if (!hasChanges && newMessages.length !== this.messages.length) {
      hasChanges = true;
      changeReason = changeReason || `Message count: ${this.messages.length} → ${newMessages.length}`;
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
    if (!element) return '';
    
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
      'style'
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
    return this.messages.find(m => 
      m.contentPreview.toLowerCase().trim().substring(0, 50) === normalized
    ) || null;
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
      ...this.resolveMarker(marker)
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
}

export default MessageRegistry;
