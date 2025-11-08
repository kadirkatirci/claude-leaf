import SimpleArrayStorage from '../../core/SimpleArrayStorage.js';

/**
 * MarkerStorage - Handles all emoji marker storage operations
 * Extends SimpleArrayStorage for common array-based storage operations
 */
export class MarkerStorage extends SimpleArrayStorage {
  constructor() {
    super('claude-emoji-markers', 'markers');
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

  // export, import, setStorageType, getStorageType methods
  // are inherited from SimpleArrayStorage
}
