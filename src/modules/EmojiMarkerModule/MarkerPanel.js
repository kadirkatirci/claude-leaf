/**
 * MarkerPanel - Floating panel for emoji markers
 * Now extends BasePanel for consistent UI and reduced code
 */
import BasePanel from '../../core/BasePanel.js';
import Button from '../../components/primitives/Button.js';
import Badge from '../../components/primitives/Badge.js';
import tokens from '../../components/theme/tokens.js';

export class MarkerPanel extends BasePanel {
  constructor(getTheme, onItemClick, onItemDelete) {
    super({
      id: 'claude-marker-panel',
      title: '📍 Emoji Markers',
      width: '320px',
      height: '500px',
      position: { right: '20px', top: '60px' }
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
        title.textContent = `📍 Emoji Markers (${markers.length})`;
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
    const theme = this.getTheme();

    // Create item container
    const item = document.createElement('div');

    if (theme.useNativeClasses) {
      // Claude's native card classes
      item.className = 'flex gap-3 items-start p-3 mb-2 bg-bg-100 hover:bg-bg-200 rounded-md cursor-pointer transition-colors';
    } else {
      // Fallback to styled components
      const isDark = theme.isDark || window.matchMedia('(prefers-color-scheme: dark)').matches;

      item.className = 'cp-card';
      item.style.display = 'flex';
      item.style.gap = tokens.space('md');
      item.style.alignItems = 'flex-start';
      item.style.marginBottom = tokens.space('sm');
      item.style.padding = tokens.space('md');
      item.style.cursor = 'pointer';

      // Apply dark mode styles if needed
      if (isDark) {
        item.style.background = tokens.colors.neutral[800];
        item.style.borderColor = tokens.colors.neutral[700];
      }
    }

    // Emoji display
    const emojiDiv = document.createElement('div');
    emojiDiv.textContent = marker.emoji;

    if (theme.useNativeClasses) {
      emojiDiv.className = 'text-2xl flex-shrink-0';
    } else {
      // Use Badge component for non-native themes
      const badge = Badge.createEmoji(marker.emoji, {
        style: {
          fontSize: '24px',
          background: 'transparent',
          flexShrink: '0'
        }
      });
      item.appendChild(badge);
    }

    if (theme.useNativeClasses) {
      item.appendChild(emojiDiv);
    }

    // Content container
    const contentDiv = document.createElement('div');

    if (theme.useNativeClasses) {
      contentDiv.className = 'flex-1 min-w-0';
    } else {
      contentDiv.style.flex = '1';
      contentDiv.style.minWidth = '0'; // Allow text truncation
    }

    // Message preview
    const preview = document.createElement('div');
    preview.textContent = marker.messagePreview || 'Message preview...';

    if (theme.useNativeClasses) {
      preview.className = 'text-text-000 text-sm truncate mb-1';
    } else {
      preview.className = 'cp-card-description cp-truncate';
      preview.style.marginBottom = tokens.space('xs');
    }

    // Timestamp
    const timestamp = document.createElement('div');
    timestamp.textContent = this.getRelativeTime(marker.timestamp);

    if (theme.useNativeClasses) {
      timestamp.className = 'text-text-400 text-xs';
    } else {
      timestamp.style.fontSize = tokens.typography.fontSize.xs;
      timestamp.style.color = tokens.colors.text.tertiary;
    }

    contentDiv.appendChild(preview);
    contentDiv.appendChild(timestamp);

    // Delete button
    const deleteBtn = document.createElement('button');

    if (theme.useNativeClasses) {
      deleteBtn.className = 'text-text-400 hover:text-red-500 flex-shrink-0 p-1';
      deleteBtn.textContent = '🗑️';
      deleteBtn.title = 'Remove marker';
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm('Remove this marker?')) {
          this.onItemDelete(marker.id);
        }
      });
    } else {
      // Use Button component for non-native themes
      const button = Button.createIcon('🗑️', {
        title: 'Remove marker',
        onClick: (e) => {
          e.stopPropagation();
          if (confirm('Remove this marker?')) {
            this.onItemDelete(marker.id);
          }
        },
        style: {
          fontSize: '16px',
          padding: '4px',
          flexShrink: '0'
        }
      });
      item.appendChild(contentDiv);
      item.appendChild(button);
    }

    if (theme.useNativeClasses) {
      item.appendChild(contentDiv);
      item.appendChild(deleteBtn);
    }

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
    if (!items || items.length === 0) return 'empty';
    return items.map(m => `${m.id}:${m.emoji}`).sort().join(',');
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

    if (seconds < 60) return 'Just now';
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;

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