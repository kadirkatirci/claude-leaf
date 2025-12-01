/**
 * EditHistoryStore - Edit history management
 * 
 * Stores:
 * 1. Individual edit versions (legacy)
 * 2. Conversation snapshots (full state at a given time)
 * 
 * Snapshots are used to reconstruct the branching tree.
 */

import { stateManager } from '../core/StateManager.js';
import { hashString } from '../utils/HashUtils.js';

export class EditHistoryStore {
    constructor() {
        this.store = stateManager.createStore('editHistory', {
            adapter: 'local',
            version: 2, // Bumped for snapshots
            defaultData: {
                history: [],
                snapshots: []
            }
        });
    }

    async getAll() {
        const data = await this.store.get();
        return data.history || [];
    }

    async getByConversation(conversationUrl) {
        const history = await this.getAll();
        const normalized = this.normalizeUrl(conversationUrl);
        return history.filter(h => h.conversationUrl === normalized);
    }

    /**
     * Get history for a specific message container
     * Uses containerId (hash-based) if available, otherwise falls back to index
     */
    async getHistoryForMessage(conversationUrl, containerId) {
        const history = await this.getByConversation(conversationUrl);
        return history.filter(h => h.containerId === containerId)
            .sort((a, b) => b.timestamp - a.timestamp);
    }

    /**
     * Add or update a history entry
     * Captures the content of a specific version
     */
    async addOrUpdate(entry) {
        return this.store.update((data) => {
            const history = data.history || [];
            const normalizedUrl = this.normalizeUrl(entry.conversationUrl);

            // Generate a unique ID for this specific version content
            // If content is same, we don't need to duplicate (unless version label changed?)
            // Actually, we want to track by (containerId + versionLabel)

            const existingIndex = history.findIndex(h =>
                h.conversationUrl === normalizedUrl &&
                h.containerId === entry.containerId &&
                h.versionLabel === entry.versionLabel
            );

            const newEntry = {
                ...entry,
                conversationUrl: normalizedUrl,
                id: entry.id || crypto.randomUUID(),
                timestamp: entry.timestamp || Date.now(),
                updatedAt: new Date().toISOString()
            };

            if (existingIndex !== -1) {
                // Update existing entry (e.g. if content was missing and now captured)
                // Only update if content changed or was empty
                const existing = history[existingIndex];
                if (existing.content === newEntry.content) {
                    return data; // No change needed
                }

                const updatedHistory = [...history];
                updatedHistory[existingIndex] = {
                    ...existing,
                    ...newEntry
                };
                return { ...data, history: updatedHistory };
            }

            return {
                ...data,
                history: [...history, newEntry]
            };
        });
    }

    async remove(id) {
        return this.store.update((data) => ({
            ...data,
            history: (data.history || []).filter(h => h.id !== id)
        }));
    }

    async clear() {
        return this.store.set({ history: [], snapshots: [] });
    }

    /**
     * Add a conversation snapshot
     * @param {Object} snapshot - { conversationUrl, timestamp, messages: [...] }
     */
    async addSnapshot(snapshot) {
        return this.store.update((data) => {
            const snapshots = data.snapshots || [];
            const normalizedUrl = this.normalizeUrl(snapshot.conversationUrl);

            // Generate unique ID based ONLY on content (not timestamp)
            // This prevents duplicate snapshots on page refresh
            const messageIds = snapshot.messages.map(m => `${m.containerId}:${m.version}`).join('|');
            const snapshotId = hashString(`${normalizedUrl}_${messageIds}`);

            // Check if this exact snapshot already exists
            const exists = snapshots.some(s => s.id === snapshotId);
            if (exists) {
                console.log('[EditHistoryStore] Snapshot already exists, skipping');
                return data;
            }

            const newSnapshot = {
                ...snapshot,
                id: snapshotId,
                conversationUrl: normalizedUrl,
                timestamp: snapshot.timestamp || Date.now(),
                createdAt: new Date().toISOString()
            };

            console.log('[EditHistoryStore] Adding snapshot:', snapshotId, newSnapshot.messages.length, 'messages');

            return {
                ...data,
                snapshots: [...snapshots, newSnapshot]
            };
        });
    }

    /**
     * Get all snapshots for a conversation
     */
    async getSnapshots(conversationUrl) {
        const data = await this.store.get();
        const normalized = this.normalizeUrl(conversationUrl);
        const snapshots = (data.snapshots || []).filter(s => s.conversationUrl === normalized);
        return snapshots.sort((a, b) => a.timestamp - b.timestamp);
    }

    /**
     * Clear all snapshots for a conversation
     */
    async clearSnapshots(conversationUrl) {
        const normalized = this.normalizeUrl(conversationUrl);
        return this.store.update((data) => ({
            ...data,
            snapshots: (data.snapshots || []).filter(s => s.conversationUrl !== normalized)
        }));
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
                const existingIds = new Set(current.map(h => h.id));
                const newEntries = (imported.data.history || []).filter(h => !existingIds.has(h.id));

                if (newEntries.length > 0) {
                    await this.store.update((data) => ({
                        ...data,
                        history: [...(data.history || []), ...newEntries]
                    }));
                }

                return { success: true, imported: newEntries.length };
            } else {
                await this.store.set({ history: imported.data.history || [] });
                return { success: true, imported: imported.data.history.length };
            }
        } catch (error) {
            console.error('[EditHistoryStore] Import failed:', error);
            return { success: false, error: error.message };
        }
    }

    normalizeUrl(url) {
        if (!url) return '';
        try {
            if (url.startsWith('/')) return url;
            const parsed = new URL(url, window.location.origin);
            return parsed.pathname;
        } catch (error) {
            return url;
        }
    }
}

export const editHistoryStore = new EditHistoryStore();
