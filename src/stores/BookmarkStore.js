/**
 * BookmarkStore - Bookmark management with conversation-aware filtering
 * 
 * Bookmarks are identified by content signature, not by index.
 * This allows different versions of the same conversation to have separate bookmarks.
 */

import { stateManager } from '../core/StateManager.js';

export class BookmarkStore {
  constructor() {
    this.store = stateManager.createStore('bookmarks', {
      adapter: 'local',
      version: 2,
      defaultData: {
        bookmarks: []
      }
    });
  }

  async getAll() {
    const data = await this.store.get();
    return data.bookmarks || [];
  }

  async getByConversation(conversationUrl) {
    const bookmarks = await this.getAll();
    const normalized = this.normalizeUrl(conversationUrl);
    return bookmarks.filter(b => b.conversationUrl === normalized);
  }

  async getCountByConversation(conversationUrl) {
    const bookmarks = await this.getByConversation(conversationUrl);
    return bookmarks.length;
  }

  async getById(bookmarkId) {
    const bookmarks = await this.getAll();
    return bookmarks.find(b => b.id === bookmarkId);
  }

  /**
   * Add new bookmark
   * Duplicate check is by content signature (not index)
   */
  async add(bookmark) {
    return this.store.update((data) => {
      const bookmarks = data.bookmarks || [];

      const normalized = {
        ...bookmark,
        conversationUrl: this.normalizeUrl(bookmark.conversationUrl),
        id: bookmark.id || crypto.randomUUID(),
        createdAt: bookmark.createdAt || new Date().toISOString()
      };

      // Check for duplicates by CONTENT SIGNATURE (not index)
      // This allows same index in different versions to have separate bookmarks
      const exists = bookmarks.some(b =>
        b.conversationUrl === normalized.conversationUrl &&
        b.contentSignature === normalized.contentSignature
      );

      if (exists) {
        console.warn('[BookmarkStore] Bookmark already exists for this content:', normalized.contentSignature);
        return data;
      }

      return {
        ...data,
        bookmarks: [...bookmarks, normalized]
      };
    });
  }

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

      return { ...data, bookmarks: updated };
    });
  }

  async remove(bookmarkId) {
    return this.store.update((data) => ({
      ...data,
      bookmarks: (data.bookmarks || []).filter(b => b.id !== bookmarkId)
    }));
  }

  async removeByConversation(conversationUrl) {
    const normalized = this.normalizeUrl(conversationUrl);
    return this.store.update((data) => ({
      ...data,
      bookmarks: (data.bookmarks || []).filter(b => b.conversationUrl !== normalized)
    }));
  }

  async clear() {
    return this.store.set({ bookmarks: [] });
  }

  async setStorageType(type) {
    if (type !== 'local' && type !== 'sync') {
      throw new Error(`Invalid storage type: ${type}`);
    }
    const newAdapter = stateManager.adapters[type];
    await this.store.changeAdapter(newAdapter, true);
    console.log(`[BookmarkStore] Storage type changed to ${type}`);
  }

  getStorageType() {
    const adapter = this.store.adapter;
    if (adapter.constructor.name === 'ChromeLocalAdapter') return 'local';
    if (adapter.constructor.name === 'ChromeSyncAdapter') return 'sync';
    return 'unknown';
  }

  subscribe(callback) {
    return this.store.subscribe((data) => callback(data.bookmarks || []));
  }

  async export() {
    const exported = await this.store.export();
    return JSON.stringify(exported, null, 2);
  }

  async import(jsonString, merge = true) {
    try {
      const imported = JSON.parse(jsonString);

      if (merge) {
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
        await this.store.set({ bookmarks: imported.data.bookmarks || [] });
        return { success: true, imported: imported.data.bookmarks.length };
      }
    } catch (error) {
      console.error('[BookmarkStore] Import failed:', error);
      return { success: false, error: error.message };
    }
  }

  normalizeUrl(url) {
    if (!url) return '';
    try {
      if (url.startsWith('/')) return url;
      const parsed = new URL(url, window.location.origin);
      return parsed.pathname + parsed.search;
    } catch (error) {
      return url;
    }
  }

  async getStorageInfo() {
    return this.store.getStorageInfo();
  }
}

export const bookmarkStore = new BookmarkStore();
