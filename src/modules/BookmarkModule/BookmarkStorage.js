import SimpleArrayStorage from '../../core/SimpleArrayStorage.js';

/**
 * BookmarkStorage - Handles all bookmark storage operations
 * Extends SimpleArrayStorage for common array-based storage operations
 */
export class BookmarkStorage extends SimpleArrayStorage {
  constructor() {
    super('claude-bookmarks', 'bookmarks');
  }

  // All load, save, export, import, setStorageType, getStorageType
  // methods are inherited from SimpleArrayStorage

  // Add bookmark-specific methods here if needed in the future
}
