import { stateManager } from '../core/StateManager.js';
import { getStoreConfig } from '../config/storeConfig.js';

const CONFIG = getStoreConfig('markers');

export class MarkerStore {
  constructor() {
    this.store = stateManager.createStore('markers', {
      adapter: CONFIG.storageType,
      version: CONFIG.version,
      defaultData: CONFIG.defaultData,
    });
  }

  async getAll() {
    const data = await this.store.get();
    return Array.isArray(data) ? data : data.markers || [];
  }

  async getByConversation(conversationUrl) {
    const normalized = this.normalizeUrl(conversationUrl);
    return this.store.getByIndex('conversationUrl', normalized);
  }

  async getCountByConversation(conversationUrl) {
    const markers = await this.getByConversation(conversationUrl);
    return markers.length;
  }

  async getById(markerId) {
    return this.store.get(markerId);
  }

  /**
   * Add new marker
   */
  async add(marker) {
    const normalized = {
      ...marker,
      conversationUrl: this.normalizeUrl(marker.conversationUrl),
      id: marker.id || crypto.randomUUID(),
      createdAt: marker.createdAt || new Date().toISOString(),
    };
    // Direct add via adapter
    return this.store.add(normalized);
  }

  async update(markerId, updates) {
    const marker = await this.getById(markerId);
    if (!marker) {
      return;
    }

    return this.store.put({
      ...marker,
      ...updates,
      id: markerId, // Ensure ID is present
      updatedAt: new Date().toISOString(),
    });
  }

  async clear() {
    return this.store.clear();
  }

  async remove(markerId) {
    return this.store.delete(markerId);
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
    const markers = await this.getAll();
    return JSON.stringify({ markers }, null, 2);
  }

  async import(jsonString, _merge = true) {
    try {
      const data = JSON.parse(jsonString);
      const markers = data.markers || [];
      for (const marker of markers) {
        await this.store.put(marker);
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  getStorageInfo() {
    return this.store.getStorageInfo();
  }
}

export const markerStore = new MarkerStore();
