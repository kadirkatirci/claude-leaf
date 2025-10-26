/**
 * BookmarkPanel - Manages the floating bookmark panel
 */
export class BookmarkPanel {
  constructor(domUtils, getTheme, getSetting) {
    this.dom = domUtils;
    this.getTheme = getTheme;
    this.getSetting = getSetting;
    this.elements = {};
    this.lastCount = -1; // Track last counter value to avoid unnecessary updates
    this.lastBookmarkIds = []; // Track bookmark IDs to detect actual changes
  }

  /**
   * Create the panel UI
   */
  create(onClose) {
    const theme = this.getTheme();

    // Panel container (matches EditPanel design)
    const panel = this.dom.createElement('div', {
      id: 'claude-bookmarks-panel',
      className: 'claude-bookmarks-panel',
      style: {
        position: 'fixed',
        top: '60px',
        right: '20px',
        width: '280px',
        maxHeight: '500px',
        background: 'white',
        borderRadius: '12px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
        border: '1px solid rgba(0, 0, 0, 0.1)',
        zIndex: '9999',
        display: 'none',
        flexDirection: 'column',
        overflow: 'hidden',
      }
    });

    // Header
    const header = this.dom.createElement('div', {
      className: 'claude-bookmarks-header',
      style: {
        padding: '12px 16px',
        background: theme.gradient,
        color: 'white',
        fontWeight: '600',
        fontSize: '14px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }
    });

    const title = this.dom.createElement('span', {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
      }
    });
    title.innerHTML = `${this.getBookmarkSVG(false, '#ffffff')} <span>Bookmarks</span>`;

    const closeBtn = this.dom.createElement('button', {
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

    closeBtn.addEventListener('click', onClose);

    header.appendChild(title);
    header.appendChild(closeBtn);

    // Content area
    const content = this.dom.createElement('div', {
      id: 'claude-bookmarks-content',
      className: 'claude-bookmarks-content',
      style: {
        padding: '8px',
        overflowY: 'auto',
        flex: '1',
      }
    });

    panel.appendChild(header);
    panel.appendChild(content);
    document.body.appendChild(panel);

    // Toggle button (inline, positioned before collapse button)
    const toggleBtn = this.createToggleButton(theme, onClose);

    this.elements = { panel, content, toggleBtn };
    return this.elements;
  }

  /**
   * Create toggle button (inline, positioned before collapse button)
   * Matches the style of collapse button exactly
   */
  createToggleButton(theme, onToggle) {
    const toggleBtn = this.dom.createElement('button', {
      id: 'claude-bookmarks-toggle',
      type: 'button',
      style: {
        display: 'none', // Initially hidden, will be shown when bookmarks exist
        marginLeft: '8px',
        padding: '4px 12px',
        borderRadius: '8px',
        background: theme.gradient,
        color: 'white',
        border: 'none',
        cursor: 'pointer',
        fontSize: '12px',
        fontWeight: '600',
        transition: 'all 0.2s ease',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
      }
    });

    // Get SVG icon based on theme (stroked version for button)
    const svgIcon = this.getBookmarkSVG(false); // false = stroked version

    // Button content: SVG icon + counter badge
    toggleBtn.innerHTML = `${svgIcon} <span id="claude-bookmarks-counter" style="margin-left: 4px; font-size: 11px; font-weight: bold;">0</span>`;

    // Click handler
    toggleBtn.addEventListener('click', onToggle);

    // Hover effects (same as collapse button)
    toggleBtn.addEventListener('mouseenter', () => {
      toggleBtn.style.transform = 'scale(1.05)';
      toggleBtn.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.25)';
    });
    toggleBtn.addEventListener('mouseleave', () => {
      toggleBtn.style.transform = 'scale(1)';
      toggleBtn.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.15)';
    });

    // Note: Toggle button is no longer inserted into header.
    // It's kept as a floating panel-only button for now.
    // Could be converted to fixed position sidebar button in the future.

    return toggleBtn;
  }

  /**
   * Get bookmark SVG icon
   * @param {boolean} filled - Whether to use filled or stroked version
   * @param {string} color - Color for the icon (default: white for button)
   * @returns {string} SVG markup
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
   * Toggle panel visibility
   */
  toggle() {
    if (!this.elements.panel) return;

    const isVisible = this.elements.panel.style.display === 'flex';
    this.elements.panel.style.display = isVisible ? 'none' : 'flex';
    return !isVisible;
  }

  /**
   * Update panel content
   * Only updates DOM if bookmarks actually changed
   */
  updateContent(bookmarks, onNavigate, onDelete) {
    const content = this.elements.content;
    if (!content) return;

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

    content.innerHTML = '';

    if (bookmarks.length === 0) {
      const empty = this.dom.createElement('div', {
        textContent: 'Henüz bookmark yok',
        style: {
          padding: '20px',
          textAlign: 'center',
          color: '#999',
          fontSize: '13px',
        }
      });
      content.appendChild(empty);
      return;
    }

    // Sort by date (newest first)
    const sortedBookmarks = [...bookmarks].sort((a, b) => b.timestamp - a.timestamp);

    sortedBookmarks.forEach((bookmark) => {
      const item = this.createBookmarkItem(bookmark, onNavigate, onDelete);
      content.appendChild(item);
    });
  }

  /**
   * Update counter badge on toggle button
   * Only updates DOM if count actually changed
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
      badge.textContent = count.toString();
    }

    // Show/hide entire button based on count (like collapse button)
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
   * Create a bookmark item for the panel (matches EditPanel item style)
   */
  createBookmarkItem(bookmark, onNavigate, onDelete) {
    const theme = this.getTheme();

    const item = this.dom.createElement('div', {
      className: 'claude-bookmark-item',
      style: {
        padding: '10px 12px',
        marginBottom: '4px',
        background: '#f8f9fa',
        borderRadius: '8px',
        cursor: 'pointer',
        transition: 'all 0.2s',
        borderLeft: `3px solid ${theme.primary}`,
      }
    });

    // Header with index and delete button
    const header = this.dom.createElement('div', {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '4px',
      }
    });

    const timestamp = this.dom.createElement('span', {
      textContent: new Date(bookmark.timestamp).toLocaleDateString(),
      style: {
        fontSize: '11px',
        color: theme.primary,
        fontWeight: '600',
      }
    });

    // Delete button
    const deleteBtn = this.dom.createElement('button', {
      innerHTML: '✕',
      style: {
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        fontSize: '14px',
        padding: '0',
        width: '16px',
        height: '16px',
        opacity: '0.5',
        transition: 'opacity 0.2s',
        color: '#666',
      }
    });
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      onDelete(bookmark.id);
    });
    deleteBtn.addEventListener('mouseenter', () => {
      deleteBtn.style.opacity = '1';
      deleteBtn.style.color = '#d32f2f';
    });
    deleteBtn.addEventListener('mouseleave', () => {
      deleteBtn.style.opacity = '0.5';
      deleteBtn.style.color = '#666';
    });

    header.appendChild(timestamp);
    header.appendChild(deleteBtn);

    // Preview text
    const preview = this.dom.createElement('div', {
      textContent: bookmark.previewText.substring(0, 50) + (bookmark.previewText.length > 50 ? '...' : ''),
      style: {
        fontSize: '12px',
        color: '#666',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }
    });

    item.appendChild(header);
    item.appendChild(preview);

    // Hover effect (matches EditPanel)
    item.addEventListener('mouseenter', () => {
      item.style.background = '#e3f2fd';
      item.style.transform = 'translateX(2px)';
    });
    item.addEventListener('mouseleave', () => {
      item.style.background = '#f8f9fa';
      item.style.transform = 'translateX(0)';
    });

    // Click to navigate
    item.addEventListener('click', () => onNavigate(bookmark));

    return item;
  }

  /**
   * Update position - No longer needed, panel is always on the right
   * Kept for backward compatibility
   */
  updatePosition() {
    // Position is now fixed to right side
    // This method is kept for compatibility but does nothing
  }

  /**
   * Destroy panel
   */
  destroy() {
    if (this.elements.panel) this.elements.panel.remove();
    if (this.elements.toggleBtn) this.elements.toggleBtn.remove();
    this.elements = {};
  }
}
