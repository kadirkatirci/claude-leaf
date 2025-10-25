/**
 * BookmarkPanel - Manages the floating bookmark panel
 */
export class BookmarkPanel {
  constructor(domUtils, getTheme, getSetting) {
    this.dom = domUtils;
    this.getTheme = getTheme;
    this.getSetting = getSetting;
    this.elements = {};
  }

  /**
   * Create the panel UI
   */
  create(onClose) {
    const position = this.getSetting('position') || 'right';
    const theme = this.getTheme();

    // Panel container
    const panel = this.dom.createElement('div', {
      id: 'claude-bookmarks-panel',
      className: 'claude-bookmarks-panel',
      style: {
        position: 'fixed',
        [position]: '20px',
        top: '50%',
        transform: 'translateY(-50%)',
        width: '320px',
        maxHeight: '70vh',
        background: 'white',
        borderRadius: '12px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
        zIndex: '9998',
        display: 'none',
        flexDirection: 'column',
        overflow: 'hidden',
      }
    });

    // Header
    const header = this.dom.createElement('div', {
      className: 'claude-bookmarks-header',
      style: {
        padding: '16px 20px',
        background: theme.gradient,
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontWeight: 'bold',
        fontSize: '16px',
      }
    });

    const title = this.dom.createElement('span', {
      textContent: '🔖 Bookmarks',
    });

    const closeBtn = this.dom.createElement('button', {
      innerHTML: '×',
      style: {
        background: 'transparent',
        border: 'none',
        color: 'white',
        fontSize: '24px',
        cursor: 'pointer',
        padding: '0',
        width: '24px',
        height: '24px',
        lineHeight: '24px',
      }
    });
    closeBtn.addEventListener('click', onClose);

    header.appendChild(title);
    header.appendChild(closeBtn);

    // Content area
    const content = this.dom.createElement('div', {
      id: 'claude-bookmarks-content',
      className: 'claude-bookmarks-content',
      style: {
        padding: '16px',
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

    // Button content: icon + counter badge
    toggleBtn.innerHTML = '🔖 <span id="claude-bookmarks-counter" style="margin-left: 4px; background: rgba(255, 255, 255, 0.3); padding: 2px 6px; border-radius: 10px; font-size: 11px; font-weight: bold;">0</span>';

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

    // Insert before collapse button
    this.insertToggleButton(toggleBtn);

    return toggleBtn;
  }

  /**
   * Insert toggle button before collapse button in header
   */
  insertToggleButton(toggleBtn) {
    // Wait for collapse button to exist
    const checkAndInsert = () => {
      const collapseBtn = document.querySelector('#claude-collapse-all-btn');
      if (collapseBtn && collapseBtn.parentElement) {
        // Insert before collapse button
        collapseBtn.parentElement.insertBefore(toggleBtn, collapseBtn);
        console.log('[BookmarkPanel] ✅ Toggle button inserted before collapse button');
      } else {
        // Retry after 500ms if collapse button not found yet
        setTimeout(checkAndInsert, 500);
      }
    };

    checkAndInsert();
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
   */
  updateContent(bookmarks, onNavigate, onDelete) {
    const content = this.elements.content;
    if (!content) return;

    content.innerHTML = '';

    // Update counter badge
    this.updateCounter(bookmarks.length);

    if (bookmarks.length === 0) {
      const empty = this.dom.createElement('div', {
        textContent: 'Henüz bookmark yok. Bir mesaja tıklayarak bookmark ekleyin.',
        style: {
          textAlign: 'center',
          color: '#666',
          padding: '20px',
          fontSize: '14px',
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
   */
  updateCounter(count) {
    const toggleBtn = this.elements.toggleBtn;
    const badge = document.querySelector('#claude-bookmarks-counter');

    if (badge) {
      badge.textContent = count.toString();
    }

    // Show/hide entire button based on count (like collapse button)
    if (toggleBtn) {
      toggleBtn.style.display = count > 0 ? 'inline-flex' : 'none';
    }
  }

  /**
   * Create a bookmark item for the panel
   */
  createBookmarkItem(bookmark, onNavigate, onDelete) {
    const theme = this.getTheme();

    const item = this.dom.createElement('div', {
      className: 'claude-bookmark-item',
      style: {
        padding: '12px',
        marginBottom: '8px',
        background: '#f8f9fa',
        borderRadius: '8px',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        borderLeft: `4px solid ${theme.primary}`,
      }
    });

    // Preview text
    const preview = this.dom.createElement('div', {
      textContent: bookmark.previewText,
      style: {
        fontSize: '13px',
        lineHeight: '1.5',
        marginBottom: '8px',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        display: '-webkit-box',
        WebkitLineClamp: '3',
        WebkitBoxOrient: 'vertical',
      }
    });

    // Metadata
    const meta = this.dom.createElement('div', {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '11px',
        color: '#999',
      }
    });

    const timestamp = this.dom.createElement('span', {
      textContent: new Date(bookmark.timestamp).toLocaleString(),
    });

    // Delete button
    const deleteBtn = this.dom.createElement('button', {
      innerHTML: '🗑️',
      style: {
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        fontSize: '14px',
        padding: '4px',
        opacity: '0.6',
        transition: 'opacity 0.2s ease',
      }
    });
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      onDelete(bookmark.id);
    });
    deleteBtn.addEventListener('mouseenter', () => {
      deleteBtn.style.opacity = '1';
    });
    deleteBtn.addEventListener('mouseleave', () => {
      deleteBtn.style.opacity = '0.6';
    });

    meta.appendChild(timestamp);
    meta.appendChild(deleteBtn);

    item.appendChild(preview);
    item.appendChild(meta);

    // Click to navigate
    item.addEventListener('click', () => onNavigate(bookmark));

    // Hover effect
    item.addEventListener('mouseenter', () => {
      item.style.background = '#e9ecef';
      item.style.transform = 'translateX(-4px)';
    });
    item.addEventListener('mouseleave', () => {
      item.style.background = '#f8f9fa';
      item.style.transform = 'translateX(0)';
    });

    return item;
  }

  /**
   * Update position (panel only, toggle button is inline)
   */
  updatePosition(position) {
    if (!this.elements.panel) return;

    // Panel position
    this.elements.panel.style.left = position === 'left' ? '20px' : 'auto';
    this.elements.panel.style.right = position === 'right' ? '20px' : 'auto';
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
