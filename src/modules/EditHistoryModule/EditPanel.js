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
  }

  /**
   * Panel'i oluştur
   */
  create() {
    const theme = this.getTheme();

    this.panel = DOMUtils.createElement('div', {
      id: 'claude-edit-panel',
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
    const header = DOMUtils.createElement('div', {
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

    const title = DOMUtils.createElement('span', {
      textContent: '✏️ Edit Points',
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
      id: 'claude-edit-panel-content',
      style: {
        padding: '8px',
        overflowY: 'auto',
        flex: '1',
      }
    });

    this.panel.appendChild(header);
    this.panel.appendChild(content);
    document.body.appendChild(this.panel);

    return this.panel;
  }

  /**
   * Panel içeriğini güncelle
   */
  updateContent(editedMessages) {
    if (!this.panel) return;

    const content = this.panel.querySelector('#claude-edit-panel-content');
    if (!content) return;

    content.innerHTML = '';

    if (editedMessages.length === 0) {
      content.innerHTML = '<div style="padding: 20px; text-align: center; color: #999; font-size: 13px;">Henüz edit yok</div>';
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
    const item = DOMUtils.createElement('div', {
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

    // Header
    const header = DOMUtils.createElement('div', {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '4px',
      }
    });

    const label = DOMUtils.createElement('span', {
      textContent: `Edit ${index + 1}`,
      style: {
        fontWeight: '600',
        fontSize: '13px',
        color: '#333',
      }
    });

    const version = DOMUtils.createElement('span', {
      textContent: editMsg.versionInfo,
      style: {
        fontSize: '11px',
        color: theme.primary,
        fontWeight: '600',
      }
    });

    header.appendChild(label);
    header.appendChild(version);

    // Preview
    const userMessage = editMsg.element.querySelector('[data-testid="user-message"]');
    const messageText = userMessage ? userMessage.textContent : '';
    const preview = DOMUtils.createElement('div', {
      textContent: messageText.substring(0, 50) + (messageText.length > 50 ? '...' : ''),
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

    // Hover
    item.addEventListener('mouseenter', () => {
      item.style.background = '#e3f2fd';
      item.style.transform = 'translateX(2px)';
    });

    item.addEventListener('mouseleave', () => {
      item.style.background = '#f8f9fa';
      item.style.transform = 'translateX(0)';
    });

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
