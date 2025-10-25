/**
 * BookmarkStorage - Handles all bookmark storage operations
 */
export class BookmarkStorage {
  constructor() {
    this.storageKey = 'claude-bookmarks';
    this.storageType = 'local'; // 'local' or 'sync'
  }

  /**
   * Load bookmarks from Chrome storage
   */
  async load() {
    return new Promise((resolve) => {
      const storage = this.storageType === 'sync' ? chrome.storage.sync : chrome.storage.local;
      storage.get([this.storageKey], (result) => {
        const bookmarks = result[this.storageKey] || [];
        console.log(`[BookmarkStorage] Loaded ${bookmarks.length} bookmarks from ${this.storageType} storage`);
        resolve(bookmarks);
      });
    });
  }

  /**
   * Save bookmarks to Chrome storage
   */
  async save(bookmarks) {
    return new Promise((resolve) => {
      const storage = this.storageType === 'sync' ? chrome.storage.sync : chrome.storage.local;
      storage.set({ [this.storageKey]: bookmarks }, () => {
        console.log(`[BookmarkStorage] Saved ${bookmarks.length} bookmarks to ${this.storageType} storage`);
        resolve();
      });
    });
  }

  /**
   * Export bookmarks to JSON file
   */
  async export(bookmarks) {
    const dataStr = JSON.stringify(bookmarks, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `claude-bookmarks-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    console.log('[BookmarkStorage] Exported bookmarks');
    return bookmarks.length;
  }

  /**
   * Import bookmarks from JSON file
   */
  async import(existingBookmarks) {
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
              throw new Error('Invalid bookmark file format');
            }

            // Merge bookmarks (avoid duplicates)
            const existingIds = new Set(existingBookmarks.map(b => b.id));
            const newBookmarks = imported.filter(b => !existingIds.has(b.id));

            console.log(`[BookmarkStorage] Imported ${newBookmarks.length} new bookmarks`);
            resolve(newBookmarks);
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
      console.log(`[BookmarkStorage] Storage type set to: ${type}`);
    }
  }

  /**
   * Get current storage type
   */
  getStorageType() {
    return this.storageType;
  }
}
