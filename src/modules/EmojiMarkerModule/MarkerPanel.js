/**
 * MarkerPanel - Floating panel to show all markers in current conversation
 */
import DOMUtils from '../../utils/DOMUtils.js';

export class MarkerPanel {
  constructor(getTheme, onItemClick, onItemDelete) {
    this.getTheme = getTheme;
    this.onItemClick = onItemClick; // Callback when marker clicked (scroll to message)
    this.onItemDelete = onItemDelete; // Callback when delete button clicked
    this.panel = null;
    this.isOpen = false;
    this.lastMarkerIds = []; // Track marker IDs to detect changes
  }

  /**
   * Create panel
   */
  create() {
    const theme = this.getTheme();

    this.panel = DOMUtils.createElement('div', {
      id: 'claude-marker-panel',
      style: {
        position: 'fixed',
        top: '60px',
        right: '20px',
        width: '320px',
        maxHeight: '500px',
        background: theme.isDark ? '#1d1d1d' : 'white',
        borderRadius: '12px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
        border: `1px solid ${theme.isDark ? '#333' : 'rgba(0, 0, 0, 0.1)'}`,
        zIndex: '9999',
        display: 'none',
        flexDirection: 'column',
        overflow: 'hidden',
      }
    });

    // Header - neutral background for native theme
    const headerBg = theme.useNativeClasses
      ? 'var(--claude-productivity-neutral)'
      : (theme.primary || theme.accentColor || '#CC785C');

    const header = DOMUtils.createElement('div', {
      style: {
        padding: '12px 16px',
        background: headerBg,
        color: 'white',
        fontWeight: '600',
        fontSize: '14px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }
    });

    const title = DOMUtils.createElement('span', {
      textContent: '📍 Emoji Markers',
      id: 'marker-panel-title',
    });

    const closeBtn = DOMUtils.createElement('button', {
      innerHTML: '✕',
      style: {
        background: 'none',
        border: 'none',
        color: 'white',
        cursor: 'pointer',
        fontSize: '16px',
        padding: '0',
        width: '24px',
        height: '24px',
        borderRadius: '50%',
        transition: 'background 0.2s',
      }
    });

    closeBtn.addEventListener('mouseenter', () => {
      closeBtn.style.background = 'rgba(255, 255, 255, 0.2)';
    });

    closeBtn.addEventListener('mouseleave', () => {
      closeBtn.style.background = 'none';
    });

    closeBtn.addEventListener('click', () => this.toggle());

    header.appendChild(title);
    header.appendChild(closeBtn);

    // Content
    const content = DOMUtils.createElement('div', {
      id: 'claude-marker-panel-content',
      style: {
        padding: '8px',
        overflowY: 'auto',
        flex: '1',
        color: theme.isDark ? 'white' : 'black',
      }
    });

    this.panel.appendChild(header);
    this.panel.appendChild(content);
    document.body.appendChild(this.panel);

    console.log('[MarkerPanel] Panel created');
  }

  /**
   * Update panel content with markers
   */
  updateContent(markers) {
    if (!this.panel) return;

    const content = this.panel.querySelector('#claude-marker-panel-content');
    if (!content) return;

    // Check if content actually changed (optimization)
    // Include emoji in comparison to detect emoji changes
    const currentSignature = markers.map(m => `${m.id}:${m.emoji}`).sort().join(',');
    if (this.lastMarkerIds === currentSignature) {
      return; // No change, skip update
    }
    this.lastMarkerIds = currentSignature;

    // Update title with count
    const title = this.panel.querySelector('#marker-panel-title');
    if (title) {
      title.textContent = `📍 Emoji Markers (${markers.length})`;
    }

    // Clear content
    content.innerHTML = '';

    if (markers.length === 0) {
      // Empty state
      const emptyMsg = DOMUtils.createElement('div', {
        textContent: 'No markers in this conversation',
        style: {
          padding: '24px 16px',
          textAlign: 'center',
          color: '#999',
          fontSize: '14px',
        }
      });
      content.appendChild(emptyMsg);
      return;
    }

    // Sort markers by timestamp (newest first)
    const sortedMarkers = [...markers].sort((a, b) => b.timestamp - a.timestamp);

    // Create list items
    sortedMarkers.forEach((marker, index) => {
      const item = this.createMarkerItem(marker, index);
      content.appendChild(item);
    });
  }

  /**
   * Create a marker list item
   */
  createMarkerItem(marker, index) {
    const theme = this.getTheme();

    const item = DOMUtils.createElement('div', {
      className: 'marker-item',
      style: {
        padding: '12px',
        marginBottom: '8px',
        background: theme.isDark ? '#2d2d2d' : '#f8f9fa',
        borderRadius: '8px',
        cursor: 'pointer',
        transition: 'all 0.2s',
        border: `1px solid ${theme.isDark ? '#3d3d3d' : '#e9ecef'}`,
        display: 'flex',
        gap: '12px',
        alignItems: 'flex-start',
      }
    });

    // Emoji
    const emojiDiv = DOMUtils.createElement('div', {
      innerHTML: marker.emoji,
      style: {
        fontSize: '24px',
        flexShrink: '0',
      }
    });

    // Content
    const contentDiv = DOMUtils.createElement('div', {
      style: {
        flex: '1',
        minWidth: '0', // Allow text truncation
      }
    });

    // Message preview
    const preview = DOMUtils.createElement('div', {
      textContent: marker.messagePreview || 'Message preview...',
      style: {
        fontSize: '13px',
        color: theme.isDark ? '#ddd' : '#333',
        marginBottom: '4px',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }
    });

    // Timestamp
    const timestamp = DOMUtils.createElement('div', {
      textContent: this.getRelativeTime(marker.timestamp),
      style: {
        fontSize: '11px',
        color: '#999',
      }
    });

    contentDiv.appendChild(preview);
    contentDiv.appendChild(timestamp);

    // Delete button
    const deleteBtn = DOMUtils.createElement('button', {
      innerHTML: '🗑️',
      title: 'Remove marker',
      style: {
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        fontSize: '16px',
        opacity: '0.6',
        transition: 'opacity 0.2s',
        padding: '4px',
        flexShrink: '0',
      }
    });

    deleteBtn.addEventListener('mouseenter', () => {
      deleteBtn.style.opacity = '1';
    });

    deleteBtn.addEventListener('mouseleave', () => {
      deleteBtn.style.opacity = '0.6';
    });

    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm('Remove this marker?')) {
        this.onItemDelete(marker.id);
      }
    });

    // Click to scroll
    item.addEventListener('click', () => {
      this.onItemClick(marker);
    });

    // Hover effect
    item.addEventListener('mouseenter', () => {
      item.style.background = theme.isDark ? '#3d3d3d' : '#e9ecef';
      item.style.transform = 'translateX(-4px)';
    });

    item.addEventListener('mouseleave', () => {
      item.style.background = theme.isDark ? '#2d2d2d' : '#f8f9fa';
      item.style.transform = 'translateX(0)';
    });

    item.appendChild(emojiDiv);
    item.appendChild(contentDiv);
    item.appendChild(deleteBtn);

    return item;
  }

  /**
   * Toggle panel visibility
   */
  toggle() {
    if (!this.panel) return;

    this.isOpen = !this.isOpen;
    this.panel.style.display = this.isOpen ? 'flex' : 'none';

    console.log('[MarkerPanel] Panel toggled:', this.isOpen);
    return this.isOpen;
  }

  /**
   * Remove panel
   */
  remove() {
    if (this.panel) {
      this.panel.remove();
      this.panel = null;
      this.isOpen = false;
    }
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
}
