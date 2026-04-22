import { stateManager } from '../core/StateManager.js';
import { getStoreConfig } from '../config/storeConfig.js';
import { broadcastStoreChange } from '../utils/StoreSyncChannel.js';

const CONFIG = getStoreConfig('annotations');

export class AnnotationStore {
  constructor() {
    this.store = stateManager.createStore('annotations', {
      adapter: CONFIG.storageType,
      version: CONFIG.version,
      defaultData: CONFIG.defaultData,
    });
  }

  notifyChange(action = 'updated') {
    broadcastStoreChange('annotations', action);
  }

  async getAll() {
    const data = await this.store.get();
    return Array.isArray(data) ? data : data.annotations || [];
  }

  getByConversation(conversationUrl) {
    const normalized = this.normalizeUrl(conversationUrl);
    return this.store.getByIndex('conversationUrl', normalized);
  }

  getById(annotationId) {
    return this.store.get(annotationId);
  }

  async add(annotation) {
    const now = new Date().toISOString();
    const normalized = {
      note: '',
      color: 'yellow',
      ...annotation,
      conversationUrl: this.normalizeUrl(annotation.conversationUrl),
      id: annotation.id || crypto.randomUUID(),
      createdAt: annotation.createdAt || now,
      updatedAt: annotation.updatedAt || now,
    };

    const result = await this.store.add(normalized);
    this.notifyChange('created');
    return result;
  }

  async update(annotationId, updates) {
    const annotation = await this.getById(annotationId);
    if (!annotation) {
      return;
    }

    const result = await this.store.put({
      ...annotation,
      ...updates,
      id: annotationId,
      conversationUrl: this.normalizeUrl(updates.conversationUrl || annotation.conversationUrl),
      updatedAt: new Date().toISOString(),
    });
    this.notifyChange('updated');
    return result;
  }

  async remove(annotationId) {
    const result = await this.store.delete(annotationId);
    this.notifyChange('deleted');
    return result;
  }

  async clear() {
    const result = await this.store.clear();
    this.notifyChange('cleared');
    return result;
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
    const annotations = await this.getAll();
    return JSON.stringify({ annotations }, null, 2);
  }

  async import(jsonString, _merge = true) {
    try {
      const data = JSON.parse(jsonString);
      const annotations = data.annotations || [];
      for (const annotation of annotations) {
        await this.store.put({
          ...annotation,
          conversationUrl: this.normalizeUrl(annotation.conversationUrl),
          id: annotation.id || crypto.randomUUID(),
          createdAt: annotation.createdAt || new Date().toISOString(),
          updatedAt: annotation.updatedAt || annotation.createdAt || new Date().toISOString(),
        });
      }
      this.notifyChange('imported');
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  getStorageInfo() {
    return this.store.getStorageInfo();
  }
}

export const annotationStore = new AnnotationStore();
