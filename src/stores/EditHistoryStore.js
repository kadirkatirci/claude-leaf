import { stateManager } from '../core/StateManager.js';
import { getStoreConfig } from '../config/storeConfig.js';
import { hashString } from '../utils/HashUtils.js';
import { debugLog } from '../config/debug.js';

const CONFIG = getStoreConfig('editHistory');

export class EditHistoryStore {
  constructor() {
    this.store = stateManager.createStore('editHistory', {
      adapter: CONFIG.storageType,
      version: CONFIG.version,
      defaultData: CONFIG.defaultData,
    });
  }

  async getAll() {
    const data = await this.store.get();
    const items = Array.isArray(data) ? data : data.history || [];
    // Filter only history items (type undefined or 'history')
    return items.filter(item => !item.type || item.type === 'history');
  }

  async getByConversation(conversationUrl) {
    const normalized = this.normalizeUrl(conversationUrl);
    // Get all items for conversation (both history and snapshots) then filter
    const items = await this.store.getByIndex('conversationUrl', normalized);
    return items.filter(item => !item.type || item.type === 'history');
  }

  async getHistoryForMessage(conversationUrl, containerId) {
    const normalizedUrl = this.normalizeUrl(conversationUrl);
    const history = await this.store.getByIndex('containerId', containerId);
    return history
      .filter(
        item =>
          (!item.type || item.type === 'history') &&
          item.containerId === containerId &&
          item.conversationUrl === normalizedUrl
      )
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  async addOrUpdate(entry) {
    const normalizedUrl = this.normalizeUrl(entry.conversationUrl);

    // Check if exists using granular query
    const history = await this.store.getByIndex('containerId', entry.containerId);

    const existing = history.find(
      h =>
        h.conversationUrl === normalizedUrl &&
        h.versionLabel === entry.versionLabel &&
        (!h.type || h.type === 'history')
    );

    const newEntry = {
      ...entry,
      type: 'history',
      conversationUrl: normalizedUrl,
      id: existing ? existing.id : entry.id || crypto.randomUUID(),
      timestamp: entry.timestamp || Date.now(),
      updatedAt: new Date().toISOString(),
    };

    if (existing) {
      if (existing.content === newEntry.content) {
        return; // No change
      }
      return this.store.put(newEntry);
    } else {
      return this.store.add(newEntry);
    }
  }

  async remove(id) {
    return this.store.delete(id);
  }

  async clear() {
    return this.store.clear();
  }

  async addSnapshot(snapshot) {
    const normalizedUrl = this.normalizeUrl(snapshot.conversationUrl);

    // Generate unique ID based on content
    const messageIds = snapshot.messages.map(m => `${m.containerId}:${m.version}`).join('|');
    const snapshotId = hashString(`${normalizedUrl}_${messageIds}`);

    const newSnapshot = {
      ...snapshot,
      id: snapshotId,
      type: 'snapshot',
      conversationUrl: normalizedUrl,
      timestamp: snapshot.timestamp || Date.now(),
      createdAt: new Date().toISOString(),
    };

    debugLog('editHistory', `Adding snapshot: ${snapshotId}`);

    // Using put to handle idempotency (overwrite if same hash)
    return this.store.put(newSnapshot);
  }

  async getSnapshots(conversationUrl) {
    const normalized = this.normalizeUrl(conversationUrl);
    const items = await this.store.getByIndex('conversationUrl', normalized);
    return items.filter(item => item.type === 'snapshot').sort((a, b) => a.timestamp - b.timestamp);
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
    const allItems = await this.store.get();
    const items = Array.isArray(allItems) ? allItems : [];
    const history = items.filter(i => !i.type || i.type === 'history');
    const snapshots = items.filter(i => i.type === 'snapshot');

    return JSON.stringify({ history, snapshots }, null, 2);
  }

  async import(jsonString) {
    try {
      const data = JSON.parse(jsonString);

      // Import history
      for (const item of data.history || []) {
        await this.addOrUpdate(item);
      }

      // Import snapshots
      for (const snapshot of data.snapshots || []) {
        await this.addSnapshot(snapshot);
      }

      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
}

export const editHistoryStore = new EditHistoryStore();
