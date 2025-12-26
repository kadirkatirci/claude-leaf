/**
 * BookmarkStore - Bookmark management with conversation-aware filtering
 *
 * Bookmarks are identified by content signature, not by index.
 * This allows different versions of the same conversation to have separate bookmarks.
 */

import { stateManager } from '../core/StateManager.js';
import { getStoreConfig } from '../config/storeConfig.js';

const CONFIG = getStoreConfig('bookmarks');

export class BookmarkStore {
  constructor() {
    this.store = stateManager.createStore('bookmarks', {
      adapter: CONFIG.storageType,
      version: CONFIG.version,
      defaultData: CONFIG.defaultData,
    });
  }

  async getAll() {
    const data = await this.store.get();
    return data.bookmarks || [];
  }

  async getCategories() {
    const data = await this.store.get();
    return (
      data.categories || [{ id: 'default', name: 'General', color: '#667eea', isDefault: true }]
    );
  }

  addCategory(name, color) {
    return this.store.update(data => {
      const categories = data.categories || [];
      const newCategory = {
        id: crypto.randomUUID(),
        name,
        color: color || '#667eea',
        createdAt: new Date().toISOString(),
      };

      return {
        ...data,
        categories: [...categories, newCategory],
      };
    });
  }

  updateCategory(id, updates) {
    return this.store.update(data => {
      const categories = data.categories || [];
      const index = categories.findIndex(c => c.id === id);

      if (index === -1) {
        return data;
      }

      const newCategories = [...categories];
      newCategories[index] = { ...newCategories[index], ...updates };

      return { ...data, categories: newCategories };
    });
  }

  removeCategory(id) {
    return this.store.update(data => {
      const categories = data.categories || [];
      // Don't delete if it's the only one or default (unless forced, but let's keep it simple)
      const toDelete = categories.find(c => c.id === id);
      if (toDelete?.isDefault) {
        return data;
      }

      // Reset bookmarks with this category to default
      const bookmarks = (data.bookmarks || []).map(b => {
        if (b.categoryId === id) {
          return { ...b, categoryId: 'default' };
        }
        return b;
      });

      return {
        ...data,
        bookmarks,
        categories: categories.filter(c => c.id !== id),
      };
    });
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
  add(bookmark) {
    return this.store.update(data => {
      const bookmarks = data.bookmarks || [];

      const normalized = {
        ...bookmark,
        conversationUrl: this.normalizeUrl(bookmark.conversationUrl),
        id: bookmark.id || crypto.randomUUID(),
        createdAt: bookmark.createdAt || new Date().toISOString(),
        // Ensure category exists, else default
        categoryId: bookmark.categoryId || 'default',
        // Support full text if provided
        fullText: bookmark.fullText || bookmark.previewText || '',
      };

      // Check for duplicates by CONTENT SIGNATURE (not index)
      // This allows same index in different versions to have separate bookmarks
      const exists = bookmarks.some(
        b =>
          b.conversationUrl === normalized.conversationUrl &&
          b.contentSignature === normalized.contentSignature
      );

      if (exists) {
        console.warn(
          '[BookmarkStore] Bookmark already exists for this content:',
          normalized.contentSignature
        );
        return data;
      }

      return {
        ...data,
        bookmarks: [...bookmarks, normalized],
      };
    });
  }

  update(bookmarkId, updates) {
    return this.store.update(data => {
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
        updatedAt: new Date().toISOString(),
      };

      return { ...data, bookmarks: updated };
    });
  }

  remove(bookmarkId) {
    return this.store.update(data => ({
      ...data,
      bookmarks: (data.bookmarks || []).filter(b => b.id !== bookmarkId),
    }));
  }

  removeByConversation(conversationUrl) {
    const normalized = this.normalizeUrl(conversationUrl);
    return this.store.update(data => ({
      ...data,
      bookmarks: (data.bookmarks || []).filter(b => b.conversationUrl !== normalized),
    }));
  }

  clear() {
    return this.store.set({
      bookmarks: [],
      categories: [{ id: 'default', name: 'General', color: '#667eea', isDefault: true }],
    });
  }

  subscribe(callback) {
    return this.store.subscribe(data => callback(data.bookmarks || []));
  }

  subscribeToCategories(callback) {
    return this.store.subscribe(data => callback(data.categories || []));
  }

  async export() {
    const exported = await this.store.export();
    return JSON.stringify(exported, null, 2);
  }

  async import(jsonString, merge = true) {
    try {
      const imported = JSON.parse(jsonString);

      if (merge) {
        const currentData = await this.store.get();
        const currentBookmarks = currentData.bookmarks || [];
        const currentCategories = currentData.categories || [];

        const existingIds = new Set(currentBookmarks.map(b => b.id));
        const newBookmarks = (imported.data.bookmarks || []).filter(b => !existingIds.has(b.id));

        // Merge categories (simple check by ID)
        const existingCatIds = new Set(currentCategories.map(c => c.id));
        const newCategories = (imported.data.categories || []).filter(
          c => !existingCatIds.has(c.id)
        );

        await this.store.update(data => ({
          ...data,
          bookmarks: [...(data.bookmarks || []), ...newBookmarks],
          categories: [...(data.categories || []), ...newCategories],
        }));

        return {
          success: true,
          imported: newBookmarks.length,
          skipped: imported.data.bookmarks.length - newBookmarks.length,
        };
      } else {
        await this.store.set({
          bookmarks: imported.data.bookmarks || [],
          categories: imported.data.categories || [
            { id: 'default', name: 'General', color: '#667eea', isDefault: true },
          ],
        });
        return { success: true, imported: imported.data.bookmarks.length };
      }
    } catch (error) {
      console.error('[BookmarkStore] Import failed:', error);
      return { success: false, error: error.message };
    }
  }

  normalizeUrl(url) {
    if (!url) {
      return '';
    }
    try {
      if (url.startsWith('/')) {
        return url;
      }
      const parsed = new URL(url, window.location.origin);
      return parsed.pathname + parsed.search;
    } catch {
      return url;
    }
  }

  getStorageInfo() {
    return this.store.getStorageInfo();
  }
}

export const bookmarkStore = new BookmarkStore();
