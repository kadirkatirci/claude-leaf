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
    const items = Array.isArray(data) ? data : data.bookmarks || [];
    return items.filter(item => !item.type || item.type === 'bookmark');
  }

  async getCategories() {
    // Robust cleanup: Always scan all items to find categories.
    // The 'type' index optimization is risky if index creation fails or is delayed.
    // Since category count is low, a full scan is acceptable and reliable.
    try {
      const allItems = await this.store.get();
      const storedCats = Array.isArray(allItems) ? allItems.filter(i => i.type === 'category') : [];

      const defaults = CONFIG.defaultData.categories;
      const all = [...defaults];

      storedCats.forEach(cat => {
        if (!all.find(c => c.id === cat.id)) {
          all.push(cat);
        }
      });
      return all;
    } catch (error) {
      console.error('[BookmarkStore] Failed to load categories:', error);
      return CONFIG.defaultData.categories;
    }
  }

  async addCategory(name, color) {
    const id = 'cat_' + crypto.randomUUID().substring(0, 8);
    const category = {
      id,
      name,
      color,
      type: 'category',
      createdAt: new Date().toISOString(),
    };
    return this.store.add(category);
  }

  async removeCategory(categoryId) {
    // Check if default
    const isDefault = CONFIG.defaultData.categories.find(c => c.id === categoryId);
    if (isDefault) {
      console.warn('Cannot remove default category');
      return;
    }

    // Reassign bookmarks to default category
    const bookmarks = await this.getAll();
    const toReassign = bookmarks.filter(b => b.categoryId === categoryId);

    console.log(
      `[BookmarkStore] Reassigning ${toReassign.length} bookmarks from ${categoryId} to default`
    );

    for (const bookmark of toReassign) {
      await this.update(bookmark.id, { categoryId: 'default' });
    }

    // Force cache invalidation to ensure next fetch sees updates
    this.store.invalidateCache();

    console.log(`[BookmarkStore] Deleting category ${categoryId}`);
    return this.store.delete(categoryId);
  }

  async getByConversation(conversationUrl) {
    const normalized = this.normalizeUrl(conversationUrl);
    // Use index, then filter by type 'bookmark' (implicit if no type matches category)
    const items = await this.store.getByIndex('conversationUrl', normalized);
    return items.filter(item => !item.type || item.type === 'bookmark');
  }

  async getById(bookmarkId) {
    return this.store.get(bookmarkId);
  }

  async add(bookmark) {
    const normalized = {
      ...bookmark,
      type: 'bookmark',
      conversationUrl: this.normalizeUrl(bookmark.conversationUrl),
      id: bookmark.id || crypto.randomUUID(),
      createdAt: bookmark.createdAt || new Date().toISOString(),
      categoryId: bookmark.categoryId || 'default',
    };
    // Direct add via adapter
    return this.store.add(normalized);
  }

  async update(bookmarkId, updates) {
    const bookmark = await this.getById(bookmarkId);
    if (!bookmark) {
      return;
    }

    const updatedBookmark = {
      ...bookmark,
      ...updates,
      id: bookmarkId, // Ensure ID is present for keyPath
      updatedAt: new Date().toISOString(),
    };

    return this.store.put(updatedBookmark);
  }

  async remove(bookmarkId) {
    return this.store.delete(bookmarkId);
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

  async export() {
    const bookmarks = await this.getAll();
    const categories = await this.getCategories();
    // Filter out default categories from export to avoid duplicates on import?
    // Actually, export everything. Import logic handles merging.
    return JSON.stringify({ bookmarks, categories }, null, 2);
  }

  async import(jsonString, _merge = true) {
    try {
      const data = JSON.parse(jsonString);

      // Import bookmarks
      for (const bookmark of data.bookmarks || []) {
        await this.add(bookmark);
      }

      // Import categories (skip defaults)
      const defaults = new Set(CONFIG.defaultData.categories.map(c => c.id));
      for (const category of data.categories || []) {
        if (!defaults.has(category.id)) {
          // If it doesn't have type, add it
          const cat = { ...category, type: 'category' };
          // Use put to upsert
          await this.store.put(cat);
        }
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

export const bookmarkStore = new BookmarkStore();
