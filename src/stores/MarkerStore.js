/**
 * MarkerStore - Emoji marker management with conversation-aware filtering
 * Uses chrome.storage.local (larger quota, sync removed for simplicity)
 */

import { stateManager } from '../core/StateManager.js';

export class MarkerStore {
  constructor() {
    // Create store with local adapter (larger quota ~10MB vs sync 100KB)
    this.store = stateManager.createStore('markers', {
      adapter: 'local',
      version: 2,
      defaultData: {
        markers: []
      },
      migrations: {
        // v2: Normalize conversation URLs from full URL to pathname
        2: (data) => {
          if (data.markers) {
            data.markers = data.markers.map(marker => ({
              ...marker,
              conversationUrl: this.normalizeUrl(marker.conversationUrl)
            }));
          }
          return data;
        }
      }
    });
  }

  /**
   * Get all markers
   */
  async getAll() {
    const data = await this.store.get();
    return data.markers || [];
  }

  /**
   * Get markers for specific conversation
   * @param {string} conversationUrl - Conversation URL or pathname
   */
  async getByConversation(conversationUrl) {
    const markers = await this.getAll();
    const normalized = this.normalizeUrl(conversationUrl);

    return markers.filter(m => m.conversationUrl === normalized);
  }

  /**
   * Get marker count for conversation
   */
  async getCountByConversation(conversationUrl) {
    const markers = await this.getByConversation(conversationUrl);
    return markers.length;
  }

  /**
   * Get marker by ID
   */
  async getById(markerId) {
    const markers = await this.getAll();
    return markers.find(m => m.id === markerId);
  }

  /**
   * Add new marker
   * @param {Object} marker - Marker data
   * @returns {Promise<Object>} - Created marker with ID
   */
  async add(marker) {
    return this.store.update((data) => {
      const markers = data.markers || [];

      // Normalize conversation URL
      const normalized = {
        ...marker,
        conversationUrl: this.normalizeUrl(marker.conversationUrl),
        id: marker.id || crypto.randomUUID(),
        createdAt: marker.createdAt || new Date().toISOString()
      };

      // Check for duplicates (same conversation + index)
      const exists = markers.some(m =>
        m.conversationUrl === normalized.conversationUrl &&
        m.index === normalized.index
      );

      if (exists) {
        console.warn('[MarkerStore] Marker already exists:', normalized);
        return data; // No change
      }

      return {
        ...data,
        markers: [...markers, normalized]
      };
    });
  }

  /**
   * Update marker (e.g., change emoji)
   * @param {string} markerId - Marker ID
   * @param {Object} updates - Fields to update
   */
  async update(markerId, updates) {
    return this.store.update((data) => {
      const markers = data.markers || [];

      const index = markers.findIndex(m => m.id === markerId);
      if (index === -1) {
        console.warn('[MarkerStore] Marker not found:', markerId);
        return data;
      }

      const updated = [...markers];
      updated[index] = {
        ...updated[index],
        ...updates,
        updatedAt: new Date().toISOString()
      };

      return {
        ...data,
        markers: updated
      };
    });
  }

  /**
   * Remove marker
   * @param {string} markerId - Marker ID
   */
  async remove(markerId) {
    return this.store.update((data) => ({
      ...data,
      markers: (data.markers || []).filter(m => m.id !== markerId)
    }));
  }

  /**
   * Remove all markers for conversation
   * @param {string} conversationUrl - Conversation URL
   */
  async removeByConversation(conversationUrl) {
    const normalized = this.normalizeUrl(conversationUrl);

    return this.store.update((data) => ({
      ...data,
      markers: (data.markers || []).filter(m => m.conversationUrl !== normalized)
    }));
  }

  /**
   * Clear all markers
   */
  async clear() {
    return this.store.set({ markers: [] });
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

    // Get new adapter
    const newAdapter = stateManager.adapters[type];

    // Change adapter and migrate data
    await this.store.changeAdapter(newAdapter, true);

    console.log(`[MarkerStore] Storage type changed to ${type}, data migrated`);
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
   * Subscribe to marker changes
   * @param {Function} callback - Called when markers change
   */
  subscribe(callback) {
    return this.store.subscribe((data) => {
      callback(data.markers || []);
    });
  }

  /**
   * Export markers
   */
  async export() {
    const exported = await this.store.export();
    return JSON.stringify(exported, null, 2);
  }

  /**
   * Import markers
   * @param {string} jsonString - JSON string of exported markers
   * @param {boolean} merge - Merge with existing or replace
   */
  async import(jsonString, merge = true) {
    try {
      const imported = JSON.parse(jsonString);

      if (merge) {
        // Merge by ID (avoid duplicates)
        const current = await this.getAll();
        const existingIds = new Set(current.map(m => m.id));

        const newMarkers = (imported.data.markers || []).filter(m => !existingIds.has(m.id));

        if (newMarkers.length > 0) {
          await this.store.update((data) => ({
            ...data,
            markers: [...(data.markers || []), ...newMarkers]
          }));
        }

        return { success: true, imported: newMarkers.length, skipped: imported.data.markers.length - newMarkers.length };
      } else {
        // Replace all
        await this.store.set({ markers: imported.data.markers || [] });
        return { success: true, imported: imported.data.markers.length };
      }
    } catch (error) {
      console.error('[MarkerStore] Import failed:', error);
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
      console.warn('[MarkerStore] Failed to normalize URL:', url);
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
export const markerStore = new MarkerStore();
