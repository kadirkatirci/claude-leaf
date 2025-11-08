/**
 * EditPanel - Floating panel yönetimi
 */
import DOMUtils from '../../utils/DOMUtils.js';

class EditPanel {
  constructor(getTheme, onItemClick) {
    this.getTheme = getTheme;
    this.onItemClick = onItemClick;
    this.panel = null;
    this.isOpen = false;
    this.lastEditIds = []; // Track edit container IDs to detect changes
  }

  /**
   * Panel'i oluştur
   */
  create() {
    const theme = this.getTheme();

    this.panel = DOMUtils.createElement('div', {
      id: 'claude-edit-panel',
    });

    // Native classes için panel styling
    if (theme.useNativeClasses) {
      this.panel.className = 'fixed flex flex-col rounded-xl border border-border-300 bg-bg-000 shadow-xl';
      Object.assign(this.panel.style, {
        top: '60px',
        right: '20px',
        width: '280px',
        maxHeight: '500px',
        zIndex: '9999',
        display: 'none',
        overflow: 'hidden',
      });
    } else {
      // Custom theme styling
      Object.assign(this.panel.style, {
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
      });
    }

    // Header
    const header = DOMUtils.createElement('div');

    if (theme.useNativeClasses) {
      header.className = 'flex items-center justify-between px-4 py-3 border-b border-border-300 bg-bg-100';
    } else {
      // Custom theme için header
      const headerBg = theme.primary || theme.accentColor || '#CC785C';
      Object.assign(header.style, {
        padding: '12px 16px',
        background: headerBg,
        color: 'white',
        fontWeight: '600',
        fontSize: '14px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      });
    }

    const title = DOMUtils.createElement('span', {
      textContent: '✏️ Edit Points',
    });

    if (theme.useNativeClasses) {
      title.className = 'text-text-000 font-semibold text-sm';
    }

    const closeBtn = DOMUtils.createElement('button', {
      innerHTML: '✕',
    });

    if (theme.useNativeClasses) {
      closeBtn.className = 'w-6 h-6 flex items-center justify-center rounded-full hover:bg-bg-200 text-text-400 hover:text-text-000 transition-colors';
      closeBtn.style.cssText = 'border: none; background: none; cursor: pointer; font-size: 16px;';
    } else {
      Object.assign(closeBtn.style, {
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
      });

      closeBtn.addEventListener('mouseenter', () => {
        closeBtn.style.background = 'rgba(255, 255, 255, 0.2)';
      });

      closeBtn.addEventListener('mouseleave', () => {
        closeBtn.style.background = 'none';
      });
    }

    closeBtn.addEventListener('click', () => this.toggle());

    header.appendChild(title);
    header.appendChild(closeBtn);

    // Content
    const content = DOMUtils.createElement('div', {
      id: 'claude-edit-panel-content',
    });

    if (theme.useNativeClasses) {
      content.className = 'p-2 overflow-y-auto flex-1 bg-bg-000';
    } else {
      Object.assign(content.style, {
        padding: '8px',
        overflowY: 'auto',
        flex: '1',
      });
    }

    this.panel.appendChild(header);
    this.panel.appendChild(content);
    document.body.appendChild(this.panel);

    return this.panel;
  }

  /**
   * Panel içeriğini güncelle
   * Only updates DOM if edits actually changed
   */
  updateContent(editedMessages) {
    if (!this.panel) return;

    const content = this.panel.querySelector('#claude-edit-panel-content');
    if (!content) return;

    // Check if edits changed
    const currentIds = editedMessages.map(e => e.containerId).join(',');
    const lastIds = this.lastEditIds.join(',');

    if (currentIds === lastIds) {
      return; // Nothing changed, skip update
    }

    this.lastEditIds = editedMessages.map(e => e.containerId);

    content.innerHTML = '';

    if (editedMessages.length === 0) {
      const theme = this.getTheme();
      const emptyMsg = DOMUtils.createElement('div', {
        textContent: 'Henüz edit yok',
      });

      if (theme.useNativeClasses) {
        emptyMsg.className = 'py-5 text-center text-text-400 text-sm';
      } else {
        Object.assign(emptyMsg.style, {
          padding: '20px',
          textAlign: 'center',
          color: '#999',
          fontSize: '13px',
        });
      }

      content.appendChild(emptyMsg);
      return;
    }

    const theme = this.getTheme();

    editedMessages.forEach((editMsg, index) => {
      const item = this.createPanelItem(editMsg, index, theme);
      content.appendChild(item);
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
   * Panel'i aç/kapat
   */
  toggle() {
    this.isOpen = !this.isOpen;
    if (this.panel) {
      this.panel.style.display = this.isOpen ? 'flex' : 'none';
    }
  }

  /**
   * Panel'i kaldır
   */
  remove() {
    if (this.panel) {
      this.panel.remove();
      this.panel = null;
    }
  }
}

export default EditPanel;