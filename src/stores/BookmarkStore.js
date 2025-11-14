/**
 * BookmarkStore - Bookmark management with conversation-aware filtering
 * Uses chrome.storage.local by default (can switch to sync via settings)
 */

import { stateManager } from '../core/StateManager.js';

export class BookmarkStore {
  constructor() {
    // Create store with local adapter (bookmarks can be large)
    this.store = stateManager.createStore('bookmarks', {
      adapter: 'local',
      version: 2,
      defaultData: {
        bookmarks: []
      }
    });
  }

  /**
   * Get all bookmarks
   */
  async getAll() {
    const data = await this.store.get();
    return data.bookmarks || [];
  }

  /**
   * Get bookmarks for specific conversation
   * @param {string} conversationUrl - Conversation URL or pathname
   */
  async getByConversation(conversationUrl) {
    const bookmarks = await this.getAll();
    const normalized = this.normalizeUrl(conversationUrl);

    return bookmarks.filter(b => b.conversationUrl === normalized);
  }

  /**
   * Get bookmark count for conversation
   */
  async getCountByConversation(conversationUrl) {
    const bookmarks = await this.getByConversation(conversationUrl);
    return bookmarks.length;
  }

  /**
   * Get bookmark by ID
   */
  async getById(bookmarkId) {
    const bookmarks = await this.getAll();
    return bookmarks.find(b => b.id === bookmarkId);
  }

  /**
   * Add new bookmark
   * @param {Object} bookmark - Bookmark data
   * @returns {Promise<Object>} - Created bookmark with ID
   */
  async add(bookmark) {
    return this.store.update((data) => {
      const bookmarks = data.bookmarks || [];

      // Normalize conversation URL
      const normalized = {
        ...bookmark,
        conversationUrl: this.normalizeUrl(bookmark.conversationUrl),
        id: bookmark.id || crypto.randomUUID(),
        createdAt: bookmark.createdAt || new Date().toISOString()
      };

      // Check for duplicates (same conversation + index)
      const exists = bookmarks.some(b =>
        b.conversationUrl === normalized.conversationUrl &&
        b.index === normalized.index
      );

      if (exists) {
        console.warn('[BookmarkStore] Bookmark already exists:', normalized);
        return data; // No change
      }

      return {
        ...data,
        bookmarks: [...bookmarks, normalized]
      };
    });
  }

  /**
   * Update bookmark
   * @param {string} bookmarkId - Bookmark ID
   * @param {Object} updates - Fields to update
   */
  async update(bookmarkId, updates) {
    return this.store.update((data) => {
      const bookmarks = data.bookmarks || [];

      const index = bookmarks.findIndex(b => b.id === bookmarkId);
      if (index === -1) {
        console.warn('[BookmarkStore] Bookmark not found:', bookmarkId);
        return data;
      }

      const updated = [...bookmarks];
      updated[index] = {
        ...updated[index],
        ...updates,
        updatedAt: new Date().toISOString()
      };

      return {
        ...data,
        bookmarks: updated
      };
    });
  }

  /**
   * Remove bookmark
   * @param {string} bookmarkId - Bookmark ID
   */
  async remove(bookmarkId) {
    return this.store.update((data) => ({
      ...data,
      bookmarks: (data.bookmarks || []).filter(b => b.id !== bookmarkId)
    }));
  }

  /**
   * Remove all bookmarks for conversation
   * @param {string} conversationUrl - Conversation URL
   */
  async removeByConversation(conversationUrl) {
    const normalized = this.normalizeUrl(conversationUrl);

    return this.store.update((data) => ({
      ...data,
      bookmarks: (data.bookmarks || []).filter(b => b.conversationUrl !== normalized)
    }));
  }

  /**
   * Clear all bookmarks
   */
  async clear() {
    return this.store.set({ bookmarks: [] });
  }

  /**
   * Set storage type (local or sync)
   * Automatically migrates data to new storage
   * @param {string} type - 'local' or 'sync'
   */
  async setStorageType(type) {
    if (type !== 'local' && type !== 'sync') {
      throw new Error(`Invalid storage type: ${type}. Must be 'local' or 'sync'`);
    }

    // Get current data
    const currentData = await this.store.get();

    // Get new adapter
    const newAdapter = stateManager.adapters[type];

    // Change adapter and migrate data
    await this.store.changeAdapter(newAdapter, true);

    console.log(`[BookmarkStore] Storage type changed to ${type}, data migrated`);
  }

  /**
   * Get current storage type
   */
  getStorageType() {
    const adapter = this.store.adapter;
    if (adapter.constructor.name === 'ChromeLocalAdapter') return 'local';
    if (adapter.constructor.name === 'ChromeSyncAdapter') return 'sync';
    return 'unknown';
  }

  /**
   * Subscribe to bookmark changes
   * @param {Function} callback - Called when bookmarks change
   */
  subscribe(callback) {
    return this.store.subscribe((data) => {
      callback(data.bookmarks || []);
    });
  }

  /**
   * Export bookmarks
   */
  async export() {
    const exported = await this.store.export();
    return JSON.stringify(exported, null, 2);
  }

  /**
   * Import bookmarks
   * @param {string} jsonString - JSON string of exported bookmarks
   * @param {boolean} merge - Merge with existing or replace
   */
  async import(jsonString, merge = true) {
    try {
      const imported = JSON.parse(jsonString);

      if (merge) {
        // Merge by ID (avoid duplicates)
        const current = await this.getAll();
        const existingIds = new Set(current.map(b => b.id));

        const newBookmarks = (imported.data.bookmarks || []).filter(b => !existingIds.has(b.id));

        if (newBookmarks.length > 0) {
          await this.store.update((data) => ({
            ...data,
            bookmarks: [...(data.bookmarks || []), ...newBookmarks]
          }));
        }

        return { success: true, imported: newBookmarks.length, skipped: imported.data.bookmarks.length - newBookmarks.length };
      } else {
        // Replace all
        await this.store.set({ bookmarks: imported.data.bookmarks || [] });
        return { success: true, imported: imported.data.bookmarks.length };
      }
    } catch (error) {
      console.error('[BookmarkStore] Import failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Normalize URL to pathname + search
   * Handles both full URLs and pathnames
   */
  normalizeUrl(url) {
    if (!url) return '';

    try {
      // If it's already a pathname, return as-is
      if (url.startsWith('/')) {
        return url;
      }

      // Parse full URL
      const parsed = new URL(url, window.location.origin);
      return parsed.pathname + parsed.search;
    } catch (error) {
      // If parsing fails, return original
      console.warn('[BookmarkStore] Failed to normalize URL:', url);
      return url;
    }
  }

  /**
   * Get storage info
   */
  async getStorageInfo() {
    return this.store.getStorageInfo();
  }
}

// Singleton instance
export const bookmarkStore = new BookmarkStore();
