/**
 * BookmarkPanel - Floating panel for bookmarks
 * Now extends BasePanel for consistent UI and reduced code
 */
import BasePanel from '../../core/BasePanel.js';
import Button from '../../components/primitives/Button.js';
import Badge from '../../components/primitives/Badge.js';
import tokens from '../../components/theme/tokens.js';

export class BookmarkPanel extends BasePanel {
  constructor(domUtils, getTheme, getSetting) {
    super({
      id: 'claude-bookmarks-panel',
      title: '🔖 Bookmarks',
      width: '280px',
      height: '500px',
      position: { right: '20px', top: '60px' }
    });

    this.dom = domUtils;
    this.getTheme = getTheme;
    this.getSetting = getSetting;
    this.lastCount = -1;
    this.lastBookmarkIds = [];
    this.onNavigateCallback = null;
    this.onDeleteCallback = null;

    // For backward compatibility
    this.elements = {};
  }

  /**
   * Override create to pass theme and setup elements reference
   */
  create(onClose) {
    const panel = super.create(this.getTheme());

    // Create toggle button separately (maintains existing functionality)
    const toggleBtn = this.createToggleButton(this.getTheme(), onClose);

    // Setup elements reference for backward compatibility
    this.elements = {
      panel: this.panel,
      content: this.content,
      toggleBtn
    };

    return this.elements;
  }

  /**
   * Create toggle button (kept separate as it's positioned differently)
   */
  createToggleButton(theme, onToggle) {
    const toggleBtn = Button.create({
      id: 'claude-bookmarks-toggle',
      variant: 'primary',
      size: 'sm',
      icon: this.getBookmarkSVG(false),
      text: '',
      style: {
        display: 'none', // Initially hidden
        marginLeft: '8px',
        position: 'relative'
      },
      onClick: onToggle,
      useNativeClasses: theme.useNativeClasses
    });

    // Add counter badge as a child element
    const counter = Badge.create({
      id: 'claude-bookmarks-counter',
      content: '0',
      variant: 'error',
      size: 'sm',
      position: { top: -6, right: -6 },
      style: {
        fontSize: tokens.typography.fontSize.xs,
        fontWeight: tokens.typography.fontWeight.bold
      }
    });

    toggleBtn.style.position = 'relative';
    toggleBtn.appendChild(counter);

    return toggleBtn;
  }

  /**
   * Get bookmark SVG icon
   */
  getBookmarkSVG(filled = false, color = '#ffffff') {
    if (filled) {
      return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" style="display: inline-block; vertical-align: middle;">
        <path fill-rule="evenodd" clip-rule="evenodd" d="M4 4.75C4 3.23122 5.23122 2 6.75 2H17.75C19.2688 2 20.5 3.23122 20.5 4.75V21.75C20.5 22.0135 20.3618 22.2576 20.1359 22.3931C19.91 22.5287 19.6295 22.5357 19.3971 22.4118L12.25 18.6L5.10294 22.4118C4.87049 22.5357 4.59003 22.5287 4.36413 22.3931C4.13822 22.2576 4 22.0135 4 21.75V4.75Z" fill="${color}"/>
      </svg>`;
    } else {
      return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" style="display: inline-block; vertical-align: middle;">
        <path d="M12 17.5L19.5 21.5V4.5C19.5 3.39543 18.6046 2.5 17.5 2.5H6.5C5.39543 2.5 4.5 3.39543 4.5 4.5V21.5L12 17.5Z" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`;
    }
  }

  /**
   * Update panel content with bookmarks
   * Uses BasePanel's smart diffing
   */
  updateContent(bookmarks, onNavigate, onDelete) {
    // Store callbacks for item creation
    this.onNavigateCallback = onNavigate;
    this.onDeleteCallback = onDelete;

    // Check if bookmarks actually changed
    const currentIds = bookmarks.map(b => b.id).sort().join(',');
    const lastIds = this.lastBookmarkIds.join(',');

    // Update counter regardless (it has its own change detection)
    this.updateCounter(bookmarks.length);

    // Skip content update if bookmarks haven't changed
    if (currentIds === lastIds) {
      return;
    }

    this.lastBookmarkIds = bookmarks.map(b => b.id).sort();

    // Sort by date (newest first)
    const sortedBookmarks = [...bookmarks].sort((a, b) => b.timestamp - a.timestamp);

    // Use BasePanel's updateContent with our custom renderer
    super.updateContent(sortedBookmarks, (bookmark, index) => {
      return this.createBookmarkItem(bookmark);
    });
  }

  /**
   * Create a bookmark item
   */
  createBookmarkItem(bookmark) {
    const theme = this.getTheme();

    // Create item container
    const item = document.createElement('div');

    if (theme.useNativeClasses) {
      // Claude's native card classes
      item.className = 'p-3 mb-2 border-l-4 border-accent-main-100 bg-bg-100 hover:bg-bg-200 rounded-md cursor-pointer transition-colors';
    } else {
      // Fallback to styled components
      item.className = 'cp-card';
      item.style.marginBottom = tokens.space('xs');
      item.style.borderLeft = `3px solid ${theme.primary || tokens.colors.primary}`;
      item.style.cursor = 'pointer';
    }

    // Header container
    const header = document.createElement('div');

    if (theme.useNativeClasses) {
      header.className = 'flex justify-between items-center mb-2';
    } else {
      header.style.display = 'flex';
      header.style.justifyContent = 'space-between';
      header.style.alignItems = 'center';
      header.style.marginBottom = tokens.space('xs');
    }

    // Timestamp
    const timestamp = document.createElement('span');
    timestamp.textContent = new Date(bookmark.timestamp).toLocaleDateString();

    if (theme.useNativeClasses) {
      timestamp.className = 'text-accent-main-100 text-xs font-semibold';
    } else {
      timestamp.style.fontSize = tokens.typography.fontSize.xs;
      timestamp.style.color = theme.primary || tokens.colors.primary;
      timestamp.style.fontWeight = tokens.typography.fontWeight.semibold;
    }

    // Delete button
    const deleteBtn = document.createElement('button');

    if (theme.useNativeClasses) {
      deleteBtn.className = 'size-4 text-text-400 hover:text-red-500 text-sm leading-none';
      deleteBtn.textContent = '×';
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.onDeleteCallback) {
          this.onDeleteCallback(bookmark.id);
        }
      });
    } else {
      // Use Button component for non-native themes
      const button = Button.createClose({
        onClick: (e) => {
          e.stopPropagation();
          if (this.onDeleteCallback) {
            this.onDeleteCallback(bookmark.id);
          }
        },
        style: {
          width: '16px',
          height: '16px',
          fontSize: '14px',
          padding: '0'
        }
      });
      header.appendChild(timestamp);
      header.appendChild(button);
    }

    if (theme.useNativeClasses) {
      header.appendChild(timestamp);
      header.appendChild(deleteBtn);
    }

    // Preview text
    const preview = document.createElement('div');
    preview.textContent = bookmark.previewText.substring(0, 50) +
      (bookmark.previewText.length > 50 ? '...' : '');

    if (theme.useNativeClasses) {
      preview.className = 'text-text-400 text-xs truncate';
    } else {
      preview.className = 'cp-card-description cp-truncate';
    }

    // Assemble item
    item.appendChild(header);
    item.appendChild(preview);

    // Click to navigate
    item.addEventListener('click', () => {
      if (this.onNavigateCallback) {
        this.onNavigateCallback(bookmark);
      }
    });

    return item;
  }

  /**
   * Update counter badge on toggle button
   */
  updateCounter(count) {
    // Skip if count hasn't changed
    if (this.lastCount === count) {
      return;
    }

    this.lastCount = count;

    const toggleBtn = this.elements.toggleBtn;
    const badge = document.querySelector('#claude-bookmarks-counter');

    if (badge) {
      Badge.update(badge, count);
    }

    // Show/hide entire button based on count
    if (toggleBtn) {
      const shouldDisplay = count > 0;
      const currentDisplay = toggleBtn.style.display;
      const targetDisplay = shouldDisplay ? 'inline-flex' : 'none';

      // Only update if display value needs to change
      if (currentDisplay !== targetDisplay) {
        toggleBtn.style.display = targetDisplay;
      }
    }
  }

  /**
   * Override empty state message
   */
  getEmptyStateMessage() {
    return 'Henüz bookmark yok';
  }

  /**
   * Generate signature for change detection
   */
  generateSignature(items) {
    if (!items || items.length === 0) return 'empty';
    return items.map(b => `${b.id}-${b.timestamp}`).join('|');
  }

  /**
   * Toggle panel visibility (override for backward compatibility)
   */
  toggle() {
    super.toggle();
    return this.isVisible;
  }

  /**
   * Update position - No longer needed but kept for compatibility
   */
  updatePosition() {
    // Position is now fixed, this method does nothing
  }

  /**
   * Destroy panel (override to include toggle button)
   */
  destroy() {
    if (this.elements.toggleBtn) {
      Button.destroy(this.elements.toggleBtn);
    }
    super.destroy();
    this.elements = {};
  }
}

export default BookmarkPanel;