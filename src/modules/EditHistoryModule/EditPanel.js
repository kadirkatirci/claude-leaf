/**
 * EditPanel - Floating panel for edit history
 * Extends BasePanel for common panel functionality
 */
import BasePanel from '../../core/BasePanel.js';
import DOMUtils from '../../utils/DOMUtils.js';

class EditPanel extends BasePanel {
  constructor(getTheme, onItemClick) {
    super({
      id: 'claude-edit-panel',
      title: '✏️ Edit Points',
      width: '280px',
      height: '500px',
      position: { right: '20px', top: '60px' }
    });

    this.getTheme = getTheme;
    this.onItemClick = onItemClick;
    this.lastEditIds = []; // Track edit container IDs to detect changes
  }

  /**
   * Override: Create panel UI
   */
  create() {
    const theme = this.getTheme();

    // Call parent create with theme
    super.create(theme);

    // Adjust panel styling for edit history specific needs
    if (theme.useNativeClasses) {
      Object.assign(this.panel.style, {
        maxHeight: '500px',
        overflow: 'hidden',
      });
    } else {
      Object.assign(this.panel.style, {
        maxHeight: '500px',
        overflow: 'hidden',
      });
    }

    // Adjust content padding for edit history (more compact)
    if (this.content) {
      if (theme.useNativeClasses) {
        this.content.className = 'p-2 overflow-y-auto flex-1 bg-bg-000';
      } else {
        Object.assign(this.content.style, {
          padding: '8px',
        });
      }
    }

    return this.panel;
  }

  /**
   * Update panel content
   * Only updates DOM if edits actually changed
   */
  updateContent(editedMessages) {
    if (!this.panel || !this.content) return;

    // Check if edits changed
    const currentIds = editedMessages.map(e => e.containerId).join(',');
    const lastIds = this.lastEditIds.join(',');

    if (currentIds === lastIds) {
      return; // Nothing changed, skip update
    }

    this.lastEditIds = editedMessages.map(e => e.containerId);

    // Clear content
    this.content.textContent = '';

    // Show empty state if no edits
    if (editedMessages.length === 0) {
      this.showEmptyState();
      return;
    }

    const theme = this.getTheme();

    editedMessages.forEach((editMsg, index) => {
      const item = this.createPanelItem(editMsg, index, theme);
      this.content.appendChild(item);
    });
  }

  /**
   * Panel item oluştur
   */
  createPanelItem(editMsg, index, theme) {
    const item = DOMUtils.createElement('div');

    if (theme.useNativeClasses) {
      item.className = 'p-3 mb-1 border-l-4 border-accent-main-100 bg-bg-100 hover:bg-bg-200 rounded-md cursor-pointer transition-colors';
    } else {
      Object.assign(item.style, {
        padding: '10px 12px',
        marginBottom: '4px',
        background: '#f8f9fa',
        borderRadius: '8px',
        cursor: 'pointer',
        transition: 'all 0.2s',
        borderLeft: `3px solid ${theme.primary || '#CC785C'}`,
      });

      // Hover effects for custom theme
      item.addEventListener('mouseenter', () => {
        item.style.background = '#e3f2fd';
        item.style.transform = 'translateX(2px)';
      });

      item.addEventListener('mouseleave', () => {
        item.style.background = '#f8f9fa';
        item.style.transform = 'translateX(0)';
      });
    }

    // Header
    const header = DOMUtils.createElement('div');

    if (theme.useNativeClasses) {
      header.className = 'flex justify-between items-center mb-1';
    } else {
      Object.assign(header.style, {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '4px',
      });
    }

    const label = DOMUtils.createElement('span', {
      textContent: `Edit ${index + 1}`,
    });

    if (theme.useNativeClasses) {
      label.className = 'text-text-000 font-medium text-sm';
    } else {
      Object.assign(label.style, {
        fontWeight: '600',
        fontSize: '13px',
        color: '#333',
      });
    }

    const version = DOMUtils.createElement('span', {
      textContent: editMsg.versionInfo,
    });

    if (theme.useNativeClasses) {
      version.className = 'px-2 py-0.5 bg-accent-main-100 text-white text-xs rounded font-mono';
    } else {
      Object.assign(version.style, {
        fontSize: '11px',
        color: 'white',
        background: theme.primary || '#CC785C',
        padding: '2px 6px',
        borderRadius: '4px',
        fontWeight: '600',
      });
    }

    header.appendChild(label);
    header.appendChild(version);

    // Preview
    const userMessage = editMsg.element.querySelector('[data-testid="user-message"]');
    const messageText = userMessage ? userMessage.textContent : '';
    const preview = DOMUtils.createElement('div', {
      textContent: messageText.substring(0, 50) + (messageText.length > 50 ? '...' : ''),
    });

    if (theme.useNativeClasses) {
      preview.className = 'text-text-400 text-xs truncate';
    } else {
      Object.assign(preview.style, {
        fontSize: '12px',
        color: '#666',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      });
    }

    item.appendChild(header);
    item.appendChild(preview);

    // Click
    item.addEventListener('click', () => this.onItemClick(index));

    return item;
  }

  /**
   * Override: Panel toggle - use BasePanel's implementation
   */
  toggle() {
    super.toggle();
  }

  /**
   * Override: Panel remove - use destroy instead
   */
  remove() {
    this.destroy();
  }

  /**
   * Override: Get empty state message
   */
  getEmptyStateMessage() {
    return 'Henüz edit yok';
  }

  /**
   * Override: Get isOpen state (for compatibility)
   */
  get isOpen() {
    return this.isVisible;
  }

  set isOpen(value) {
    this.isVisible = value;
  }
}

export default EditPanel;