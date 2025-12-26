/**
 * MarkerStore - Emoji marker management with conversation-aware filtering
 *
 * Markers are identified by content signature, not by index.
 * This allows different versions of the same conversation to have separate markers.
 */

import { stateManager } from '../core/StateManager.js';
import { debugLog } from '../config/debug.js';

export class MarkerStore {
  constructor() {
    this.store = stateManager.createStore('markers', {
      adapter: 'local',
      version: 2,
      defaultData: {
        markers: [],
      },
    });
  }

  async getAll() {
    const data = await this.store.get();
    return data.markers || [];
  }

  async getByConversation(conversationUrl) {
    const markers = await this.getAll();
    const normalized = this.normalizeUrl(conversationUrl);
    return markers.filter(m => m.conversationUrl === normalized);
  }

  async getCountByConversation(conversationUrl) {
    const markers = await this.getByConversation(conversationUrl);
    return markers.length;
  }

  async getById(markerId) {
    const markers = await this.getAll();
    return markers.find(m => m.id === markerId);
  }

  /**
   * Add new marker
   * Duplicate check is by content signature (not index)
   */
  async add(marker) {
    return this.store.update(data => {
      const markers = data.markers || [];

      const normalized = {
        ...marker,
        conversationUrl: this.normalizeUrl(marker.conversationUrl),
        id: marker.id || crypto.randomUUID(),
        createdAt: marker.createdAt || new Date().toISOString(),
      };

      // Check for duplicates by CONTENT SIGNATURE (not index)
      // This allows same index in different versions to have separate markers
      const exists = markers.some(
        m =>
          m.conversationUrl === normalized.conversationUrl &&
          m.contentSignature === normalized.contentSignature
      );

      if (exists) {
        console.warn(
          '[MarkerStore] Marker already exists for this content:',
          normalized.contentSignature
        );
        return data;
      }

      return {
        ...data,
        markers: [...markers, normalized],
      };
    });
  }

  async update(markerId, updates) {
    return this.store.update(data => {
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
        updatedAt: new Date().toISOString(),
      };

      return { ...data, markers: updated };
    });
  }

  async remove(markerId) {
    return this.store.update(data => ({
      ...data,
      markers: (data.markers || []).filter(m => m.id !== markerId),
    }));
  }

  async removeByConversation(conversationUrl) {
    const normalized = this.normalizeUrl(conversationUrl);
    return this.store.update(data => ({
      ...data,
      markers: (data.markers || []).filter(m => m.conversationUrl !== normalized),
    }));
  }

  async clear() {
    return this.store.set({ markers: [] });
  }

  async setStorageType(type) {
    if (type !== 'local' && type !== 'sync') {
      throw new Error(`Invalid storage type: ${type}`);
    }
    const newAdapter = stateManager.adapters[type];
    await this.store.changeAdapter(newAdapter, true);
    debugLog('marker', `Storage type changed to ${type}`);
  }

  getStorageType() {
    const adapter = this.store.adapter;
    if (adapter.constructor.name === 'ChromeLocalAdapter') {
      return 'local';
    }
    if (adapter.constructor.name === 'ChromeSyncAdapter') {
      return 'sync';
    }
    return 'unknown';
  }

  subscribe(callback) {
    return this.store.subscribe(data => callback(data.markers || []));
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
        const existingIds = new Set(current.map(m => m.id));
        const newMarkers = (imported.data.markers || []).filter(m => !existingIds.has(m.id));

        if (newMarkers.length > 0) {
          await this.store.update(data => ({
            ...data,
            markers: [...(data.markers || []), ...newMarkers],
          }));
        }

        return {
          success: true,
          imported: newMarkers.length,
          skipped: imported.data.markers.length - newMarkers.length,
        };
      } else {
        await this.store.set({ markers: imported.data.markers || [] });
        return { success: true, imported: imported.data.markers.length };
      }
    } catch (error) {
      console.error('[MarkerStore] Import failed:', error);
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

  async getStorageInfo() {
    return this.store.getStorageInfo();
  }
}

export const markerStore = new MarkerStore();
