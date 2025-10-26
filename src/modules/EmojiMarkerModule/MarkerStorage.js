/**
 * MarkerStorage - Handles all emoji marker storage operations
 */
export class MarkerStorage {
  constructor() {
    this.storageKey = 'claude-emoji-markers';
    this.storageType = 'local'; // 'local' or 'sync'
  }

  /**
   * Load markers from Chrome storage
   */
  async load() {
    return new Promise((resolve) => {
      const storage = this.storageType === 'sync' ? chrome.storage.sync : chrome.storage.local;
      storage.get([this.storageKey], (result) => {
        const markers = result[this.storageKey] || [];
        console.log(`[MarkerStorage] Loaded ${markers.length} markers from ${this.storageType} storage`);
        resolve(markers);
      });
    });
  }

  /**
   * Save markers to Chrome storage
   */
  async save(markers) {
    return new Promise((resolve) => {
      const storage = this.storageType === 'sync' ? chrome.storage.sync : chrome.storage.local;
      storage.set({ [this.storageKey]: markers }, () => {
        console.log(`[MarkerStorage] Saved ${markers.length} markers to ${this.storageType} storage`);
        resolve();
      });
    });
  }

  /**
   * Add a new marker (with duplicate prevention)
   */
  async add(marker, existingMarkers) {
    // Check if a marker already exists for this conversation + messageIndex
    const existingIndex = existingMarkers.findIndex(
      m => m.conversationUrl === marker.conversationUrl &&
           m.messageIndex === marker.messageIndex
    );

    if (existingIndex !== -1) {
      // Duplicate found: Update existing marker instead of adding new one
      console.log(`[MarkerStorage] Duplicate detected, updating existing marker at index ${marker.messageIndex}`);
      return this.update(existingMarkers[existingIndex].id, marker.emoji, existingMarkers);
    }

    // No duplicate: Add new marker
    const markers = [...existingMarkers, marker];
    await this.save(markers);
    return markers;
  }

  /**
   * Remove a marker by ID
   */
  async remove(markerId, existingMarkers) {
    const markers = existingMarkers.filter(m => m.id !== markerId);
    await this.save(markers);
    return markers;
  }

  /**
   * Update a marker (change emoji)
   */
  async update(markerId, newEmoji, existingMarkers) {
    const markers = existingMarkers.map(m =>
      m.id === markerId ? { ...m, emoji: newEmoji, timestamp: Date.now() } : m
    );
    await this.save(markers);
    return markers;
  }

  /**
   * Get markers for a specific conversation
   */
  getByConversation(conversationUrl, markers) {
    return markers.filter(m => m.conversationUrl === conversationUrl);
  }

  /**
   * Export markers to JSON file
   */
  async export(markers) {
    const dataStr = JSON.stringify(markers, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `claude-emoji-markers-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    console.log('[MarkerStorage] Exported markers');
    return markers.length;
  }

  /**
   * Import markers from JSON file
   */
  async import(existingMarkers) {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/json';

      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) {
          reject('No file selected');
          return;
        }

        const reader = new FileReader();
        reader.onload = async (event) => {
          try {
            const imported = JSON.parse(event.target.result);

            if (!Array.isArray(imported)) {
              throw new Error('Invalid marker file format');
            }

            // Merge markers (avoid duplicates)
            const existingIds = new Set(existingMarkers.map(m => m.id));
            const newMarkers = imported.filter(m => !existingIds.has(m.id));

            console.log(`[MarkerStorage] Imported ${newMarkers.length} new markers`);
            resolve(newMarkers);
          } catch (error) {
            reject(error);
          }
        };

        reader.readAsText(file);
      };

      input.click();
    });
  }

  /**
   * Set storage type (local or sync)
   */
  setStorageType(type) {
    if (type === 'local' || type === 'sync') {
      this.storageType = type;
      console.log(`[MarkerStorage] Storage type set to: ${type}`);
    }
  }

  /**
   * Get current storage type
   */
  getStorageType() {
    return this.storageType;
  }
}
