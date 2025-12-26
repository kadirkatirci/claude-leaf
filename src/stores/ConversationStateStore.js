/**
 * ConversationStateStore - Unified store for conversation-scoped state
 * Handles folding states, collapse states, and other conversation-specific data
 * Uses IndexedDB for unlimited storage with LRU cleanup
 */

import { stateManager } from '../core/StateManager.js';
import { getStoreConfig } from '../config/storeConfig.js';
import { debugLog } from '../config/debug.js';

const CONFIG = getStoreConfig('conversation-states');

export class ConversationStateStore {
  constructor() {
    // Create store with IndexedDB adapter (unlimited storage)
    this.store = stateManager.createStore('conversation-states', {
      adapter: CONFIG.storageType,
      version: CONFIG.version,
      defaultData: CONFIG.defaultData,
      cacheTTL: CONFIG.cacheTTL,
    });

    this.currentConversationUrl = null;
    this.maxConversations = 50; // LRU cache size
    this.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
  }

  /**
   * Set current conversation URL
   * @param {string} url - Conversation URL
   */
  setCurrentConversation(url) {
    this.currentConversationUrl = this.normalizeUrl(url);
  }

  /**
   * Get current conversation URL
   */
  getCurrentConversation() {
    if (!this.currentConversationUrl) {
      this.currentConversationUrl = this.normalizeUrl(window.location.href);
    }
    return this.currentConversationUrl;
  }

  /**
   * Get state for current conversation
   * @param {string} stateType - Type of state ('folding', 'collapse', etc.)
   * @returns {Promise<Object>}
   */
  getCurrentState(stateType) {
    const conversationUrl = this.getCurrentConversation();
    return this.getState(conversationUrl, stateType);
  }

  /**
   * Get state for specific conversation
   * @param {string} conversationUrl - Conversation URL
   * @param {string} stateType - Type of state
   * @returns {Promise<Object>}
   */
  async getState(conversationUrl, stateType) {
    const normalized = this.normalizeUrl(conversationUrl);
    const allStates = await this.store.get();

    const conversationData = allStates[normalized];
    if (!conversationData) {
      return this.getDefaultStateFor(stateType);
    }

    // Update last accessed time
    await this.touchConversation(normalized);

    return conversationData[stateType] || this.getDefaultStateFor(stateType);
  }

  /**
   * Set state for current conversation
   * @param {string} stateType - Type of state
   * @param {Object} state - State data
   */
  setCurrentState(stateType, state) {
    const conversationUrl = this.getCurrentConversation();
    return this.setState(conversationUrl, stateType, state);
  }

  /**
   * Set state for specific conversation
   * @param {string} conversationUrl - Conversation URL
   * @param {string} stateType - Type of state
   * @param {Object} state - State data
   */
  setState(conversationUrl, stateType, state) {
    const normalized = this.normalizeUrl(conversationUrl);

    return this.store.update(data => {
      const conversationData = data[normalized] || {};

      const updated = {
        ...data,
        [normalized]: {
          ...conversationData,
          [stateType]: state,
          lastAccessed: Date.now(),
        },
      };

      // Run LRU cleanup
      return this.cleanupOldConversations(updated);
    });
  }

  /**
   * Update last accessed timestamp for conversation
   */
  touchConversation(conversationUrl) {
    const normalized = this.normalizeUrl(conversationUrl);

    return this.store.update(data => {
      if (!data[normalized]) {
        return data;
      }

      return {
        ...data,
        [normalized]: {
          ...data[normalized],
          lastAccessed: Date.now(),
        },
      };
    });
  }

  /**
   * Clear state for current conversation
   * @param {string} [stateType] - Optional state type, clears all if omitted
   */
  clearCurrentState(stateType = null) {
    const conversationUrl = this.getCurrentConversation();
    return this.clearState(conversationUrl, stateType);
  }

  /**
   * Clear state for specific conversation
   * @param {string} conversationUrl - Conversation URL
   * @param {string} [stateType] - Optional state type
   */
  clearState(conversationUrl, stateType = null) {
    const normalized = this.normalizeUrl(conversationUrl);

    return this.store.update(data => {
      if (!data[normalized]) {
        return data;
      }

      if (stateType) {
        // Clear specific state type
        const updated = { ...data };
        const conversationData = { ...updated[normalized] };
        delete conversationData[stateType];
        updated[normalized] = conversationData;
        return updated;
      } else {
        // Clear entire conversation
        const updated = { ...data };
        delete updated[normalized];
        return updated;
      }
    });
  }

  /**
   * Clear all conversation states
   */
  clearAll() {
    return this.store.set({});
  }

  /**
   * Get all conversation URLs
   */
  async getAllConversationUrls() {
    const data = await this.store.get();
    return Object.keys(data).filter(key => !key.startsWith('__'));
  }

  /**
   * Get conversation count
   */
  async getConversationCount() {
    const urls = await this.getAllConversationUrls();
    return urls.length;
  }

  /**
   * Cleanup old conversations using LRU strategy
   * Removes conversations that haven't been accessed in maxAge days
   * Or keeps only the most recent maxConversations
   */
  cleanupOldConversations(data) {
    const conversations = Object.entries(data)
      .filter(([key]) => !key.startsWith('__')) // Skip metadata
      .map(([url, state]) => ({
        url,
        state,
        lastAccessed: state.lastAccessed || 0,
      }));

    // Remove conversations older than maxAge
    const now = Date.now();
    const recentConversations = conversations.filter(conv => now - conv.lastAccessed < this.maxAge);

    // If still too many, keep only the most recent maxConversations
    if (recentConversations.length > this.maxConversations) {
      const sorted = recentConversations.sort((a, b) => b.lastAccessed - a.lastAccessed);
      const toKeep = sorted.slice(0, this.maxConversations);
      const removed = sorted.length - toKeep.length;

      if (removed > 0) {
        debugLog('conversation', `Cleaned up ${removed} old conversations (LRU)`);
      }

      const cleaned = { __meta: data.__meta || {} };
      toKeep.forEach(({ url, state }) => {
        cleaned[url] = state;
      });

      return cleaned;
    }

    // If some were removed by age
    if (recentConversations.length < conversations.length) {
      const removed = conversations.length - recentConversations.length;
      debugLog(
        'conversation',
        `Cleaned up ${removed} old conversations (age > ${this.maxAge / (24 * 60 * 60 * 1000)} days)`
      );

      const cleaned = { __meta: data.__meta || {} };
      recentConversations.forEach(({ url, state }) => {
        cleaned[url] = state;
      });

      return cleaned;
    }

    // No cleanup needed
    return data;
  }

  /**
   * Get default state structure for state type
   */
  getDefaultStateFor(stateType) {
    switch (stateType) {
      case 'folding':
        return {
          headings: {},
          codeBlocks: {},
          messages: {},
        };
      case 'collapse':
        return {};
      default:
        return {};
    }
  }

  /**
   * Normalize URL to pathname + search
   */
  normalizeUrl(url) {
    if (!url) {
      return '';
    }

    try {
      // If it's already a pathname, return as-is
      if (url.startsWith('/')) {
        return url;
      }

      // Parse full URL
      const parsed = new URL(url, window.location.origin);
      return parsed.pathname + parsed.search;
    } catch {
      console.warn('[ConversationStateStore] Failed to normalize URL:', url);
      return url;
    }
  }

  /**
   * Get storage info with conversation stats
   */
  async getStorageInfo() {
    const info = await this.store.getStorageInfo();
    const count = await this.getConversationCount();

    return {
      ...info,
      conversationCount: count,
      maxConversations: this.maxConversations,
      maxAge: `${this.maxAge / (24 * 60 * 60 * 1000)} days`,
    };
  }

  /**
   * Export conversation states
   */
  async export() {
    const exported = await this.store.export();
    return JSON.stringify(exported, null, 2);
  }

  /**
   * Import conversation states
   * @param {string} jsonString - JSON string
   * @param {boolean} merge - Merge with existing or replace
   */
  async import(jsonString, merge = true) {
    try {
      const imported = JSON.parse(jsonString);

      if (merge) {
        const current = await this.store.get();
        const merged = { ...current, ...imported.data };
        await this.store.set(merged);
        return { success: true };
      } else {
        await this.store.set(imported.data);
        return { success: true };
      }
    } catch (error) {
      console.error('[ConversationStateStore] Import failed:', error);
      return { success: false, error: error.message };
    }
  }
}

// Singleton instance
export const conversationStateStore = new ConversationStateStore();
