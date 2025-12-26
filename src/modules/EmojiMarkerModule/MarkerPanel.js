/**
 * MarkerPanel - Floating panel for emoji markers
 * Now extends BasePanel for consistent UI and reduced code
 * Refactored to use ONLY Claude native classes
 */
import BasePanel from '../../core/BasePanel.js';
import IconLibrary from '../../components/primitives/IconLibrary.js';
import { cn } from '../../utils/ClassNames.js';

export class MarkerPanel extends BasePanel {
  constructor(getTheme, onItemClick, onItemDelete) {
    super({
      id: 'claude-marker-panel',
      title: 'Emoji Markers', // Icon added via updateContent
      width: '280px',
      height: '500px',
      position: { right: '80px', top: '60px' },
    });

    this.getTheme = getTheme;
    this.onItemClick = onItemClick; // Callback when marker clicked (scroll to message)
    this.onItemDelete = onItemDelete; // Callback when delete button clicked
    this.lastMarkerIds = ''; // Track marker IDs to detect changes
  }

  /**
   * Override create to pass theme
   */
  create() {
    return super.create(this.getTheme());
  }

  /**
   * Update panel content with markers
   * Uses BasePanel's smart diffing
   */
  updateContent(markers) {
    // Update title with count
    if (this.header) {
      const title = this.header.querySelector('h3');
      if (title) {
        title.innerHTML = `${IconLibrary.pin('currentColor', 16)} Emoji Markers (${markers.length})`;
      }
    }

    // Sort markers by timestamp (newest first)
    const sortedMarkers = [...markers].sort((a, b) => b.timestamp - a.timestamp);

    // Use BasePanel's updateContent with our custom renderer
    super.updateContent(sortedMarkers, (marker, index) => {
      return this.createMarkerItem(marker, index);
    });
  }

  /**
   * Create a marker list item
   */
  createMarkerItem(marker, index) {
    // Create item container
    const item = document.createElement('div');
    item.className =
      'flex gap-3 items-start p-3 mb-2 bg-bg-100 hover:bg-bg-200 rounded-md cursor-pointer transition-colors';

    // Emoji display
    const emojiDiv = document.createElement('div');
    emojiDiv.textContent = marker.emoji;
    emojiDiv.className = 'text-2xl flex-shrink-0';

    // Content container
    const contentDiv = document.createElement('div');
    contentDiv.className = 'flex-1 min-w-0';

    // Message preview
    const preview = document.createElement('div');
    preview.textContent = marker.messagePreview || 'Message preview...';
    preview.className = 'text-text-000 text-sm truncate mb-1';

    // Timestamp
    const timestamp = document.createElement('div');
    timestamp.textContent = this.getRelativeTime(marker.timestamp);
    timestamp.className = 'text-text-400 text-xs';

    contentDiv.appendChild(preview);
    contentDiv.appendChild(timestamp);

    // Delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'text-text-400 hover:text-red-500 flex-shrink-0 p-1';
    deleteBtn.textContent = '🗑️';
    deleteBtn.title = 'Remove marker';
    deleteBtn.addEventListener('click', e => {
      e.stopPropagation();
      if (confirm('Remove this marker?')) {
        this.onItemDelete(marker.id);
      }
    });

    item.appendChild(emojiDiv);
    item.appendChild(contentDiv);
    item.appendChild(deleteBtn);

    // Click to scroll
    item.addEventListener('click', () => {
      this.onItemClick(marker);
    });

    return item;
  }

  /**
   * Override empty state message
   */
  getEmptyStateMessage() {
    return 'No markers in this conversation';
  }

  /**
   * Generate signature for change detection
   */
  generateSignature(items) {
    if (!items || items.length === 0) {
      return 'empty';
    }
    return items
      .map(m => `${m.id}:${m.emoji}`)
      .sort()
      .join(',');
  }

  /**
   * Get relative time string
   */
  getRelativeTime(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) {
      return 'Just now';
    }
    if (minutes < 60) {
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    }
    if (hours < 24) {
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    }
    if (days < 7) {
      return `${days} day${days > 1 ? 's' : ''} ago`;
    }

    return new Date(timestamp).toLocaleDateString();
  }

  /**
   * Backward compatibility: map toggle to show/hide
   */
  toggle() {
    if (this.isOpen !== undefined) {
      // Sync with old isOpen property if it exists
      this.isOpen = !this.isOpen;
    }
    super.toggle();
    console.log('[MarkerPanel] Panel toggled:', this.isVisible);
    return this.isVisible;
  }

  /**
   * Backward compatibility: map remove to destroy
   */
  remove() {
    this.destroy();
  }
}
