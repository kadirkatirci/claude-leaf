/**
 * StoreSyncChannel - Broadcasts IndexedDB-backed store updates across Claude tabs.
 *
 * Uses BroadcastChannel when available and debounces bursts of writes so
 * remote tabs only refresh once per store/action pair.
 */

import { debugLog } from '../config/debug.js';

const CHANNEL_NAME = 'claude-leaf-store-sync';
const DEFAULT_DEBOUNCE_MS = 150;
const SOURCE_ID =
  (typeof crypto !== 'undefined' && crypto.randomUUID && crypto.randomUUID()) ||
  `store-sync-${Date.now()}-${Math.random().toString(16).slice(2)}`;

class StoreSyncChannel {
  constructor() {
    this.channel = null;
    this.listeners = new Set();
    this.pendingBroadcasts = new Map();
    this.initialize();
  }

  initialize() {
    if (this.channel || typeof BroadcastChannel === 'undefined') {
      return;
    }

    this.channel = new BroadcastChannel(CHANNEL_NAME);
    this.channel.onmessage = event => {
      const message = event?.data;
      if (!message || message.sourceId === SOURCE_ID) {
        return;
      }

      for (const listener of this.listeners) {
        try {
          listener(message);
        } catch (error) {
          console.error('[StoreSyncChannel] Listener failed:', error);
        }
      }
    };
  }

  subscribe(callback) {
    this.initialize();
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  broadcast(storeId, action = 'updated', options = {}) {
    this.initialize();
    if (!this.channel || !storeId) {
      return;
    }

    const { immediate = false, debounceMs = DEFAULT_DEBOUNCE_MS } = options;
    const key = `${storeId}:${action}`;
    const send = () => {
      this.pendingBroadcasts.delete(key);

      const payload = {
        storeId,
        action,
        sourceId: SOURCE_ID,
        timestamp: Date.now(),
      };

      debugLog('sync', 'Broadcasting store change', payload);
      this.channel.postMessage(payload);
    };

    if (immediate) {
      const existingTimer = this.pendingBroadcasts.get(key);
      if (existingTimer) {
        clearTimeout(existingTimer);
        this.pendingBroadcasts.delete(key);
      }
      send();
      return;
    }

    const existingTimer = this.pendingBroadcasts.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(send, debounceMs);
    this.pendingBroadcasts.set(key, timer);
  }

  destroy() {
    this.pendingBroadcasts.forEach(timer => {
      clearTimeout(timer);
    });
    this.pendingBroadcasts.clear();
    this.listeners.clear();

    if (this.channel) {
      this.channel.onmessage = null;
      if (typeof this.channel.close === 'function') {
        this.channel.close();
      }
      this.channel = null;
    }
  }
}

export const storeSyncChannel = new StoreSyncChannel();

export function broadcastStoreChange(storeId, action = 'updated', options = {}) {
  storeSyncChannel.broadcast(storeId, action, options);
}
