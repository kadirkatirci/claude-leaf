/**
 * BookmarkPanel - Floating panel for bookmarks
 * Now extends BasePanel for consistent UI and reduced code
 * Refactored to use ONLY Claude native classes
 */
import BasePanel from '../../core/BasePanel.js';
import Button from '../../components/primitives/Button.js';
import Badge from '../../components/primitives/Badge.js';
import IconLibrary from '../../components/primitives/IconLibrary.js';
import { cardClass } from '../../utils/ClassNames.js';

export class BookmarkPanel extends BasePanel {
  constructor(domUtils, getTheme, getSetting) {
    super({
      id: 'claude-bookmarks-panel',
      title: 'Bookmarks', // Icon added dynamically
      width: '280px',
      height: '500px',
      position: { right: '80px', top: '60px' },
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
    super.create(this.getTheme());

    // Create toggle button separately (maintains existing functionality)
    const toggleBtn = this.createToggleButton(this.getTheme(), onClose);

    // Setup elements reference for backward compatibility
    this.elements = {
      panel: this.panel,
      content: this.content,
      toggleBtn,
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
      icon: IconLibrary.bookmark(false),
      text: '',
      style: {
        display: 'none', // Initially hidden
        marginLeft: '8px',
        position: 'relative',
      },
      onClick: onToggle,
    });

    // Add counter badge as a child element
    const counter = Badge.create({
      id: 'claude-bookmarks-counter',
      content: '0',
      variant: 'error',
      size: 'sm',
      position: { top: -6, right: -6 },
      style: {
        fontSize: '10px',
        fontWeight: '700',
      },
    });

    toggleBtn.style.position = 'relative';
    toggleBtn.appendChild(counter);

    return toggleBtn;
  }

  /**
   * Update panel content with bookmarks
   * Uses BasePanel's smart diffing
   */
  updateContent(bookmarks, onNavigate, onDelete) {
    // Store callbacks for item creation
    this.onNavigateCallback = onNavigate;
    this.onDeleteCallback = onDelete;

    // Update title with icon and count
    if (this.header) {
      const title = this.header.querySelector('h3');
      if (title) {
        title.innerHTML = `${IconLibrary.bookmark(false, 'currentColor', 16)} Bookmarks${bookmarks.length > 0 ? ` (${bookmarks.length})` : ''}`;
      }
    }

    // Check if bookmarks actually changed
    const currentIds = bookmarks
      .map(b => b.id)
      .sort()
      .join(',');
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
    super.updateContent(sortedBookmarks, bookmark => {
      return this.createBookmarkItem(bookmark);
    });
  }

  /**
   * Create a bookmark item
   */
  createBookmarkItem(bookmark) {
    // Create item container
    const item = document.createElement('div');
    item.className = cardClass(true); // 'p-3 mb-2 border-l-4 border-accent-main-100 bg-bg-100 hover:bg-bg-200 rounded-md cursor-pointer transition-colors'

    // Header container
    const header = document.createElement('div');
    header.className = 'flex justify-between items-center mb-2';

    // Timestamp
    const timestamp = document.createElement('span');
    timestamp.textContent = new Date(bookmark.timestamp).toLocaleDateString();
    timestamp.className = 'text-accent-main-100 text-xs font-semibold';

    // Delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'size-4 text-text-400 hover:text-red-500 text-sm leading-none';
    deleteBtn.textContent = '×';
    deleteBtn.addEventListener('click', e => {
      e.stopPropagation();
      if (this.onDeleteCallback) {
        this.onDeleteCallback(bookmark.id);
      }
    });

    header.appendChild(timestamp);
    header.appendChild(deleteBtn);

    // Preview text
    const preview = document.createElement('div');
    preview.textContent =
      bookmark.previewText.substring(0, 50) + (bookmark.previewText.length > 50 ? '...' : '');
    preview.className = 'text-text-400 text-xs truncate';

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
    return 'No bookmarks yet';
  }

  /**
   * Generate signature for change detection
   */
  generateSignature(items) {
    if (!items || items.length === 0) {
      return 'empty';
    }
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
