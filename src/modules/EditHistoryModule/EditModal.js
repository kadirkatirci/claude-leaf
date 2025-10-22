/**
 * EditModal - Edit history modal dialog
 */
import DOMUtils from '../../utils/DOMUtils.js';

class EditModal {
  constructor() {
    this.activeModal = null;
  }

  /**
   * Modal'ı göster
   */
  show(messageElement, versionInfo = '') {
    // Mesaj içeriğini al
    const userMessage = messageElement.querySelector('[data-testid="user-message"]');
    const messageText = userMessage ? userMessage.textContent : messageElement.textContent;
    
    // Modal oluştur
    const modal = DOMUtils.createElement('div', {
      style: {
        position: 'fixed',
        top: '0',
        left: '0',
        right: '0',
        bottom: '0',
        background: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: '10000',
        animation: 'fadeIn 0.2s ease',
      }
    });

    const modalContent = DOMUtils.createElement('div', {
      style: {
        background: 'white',
        borderRadius: '16px',
        padding: '24px',
        maxWidth: '600px',
        maxHeight: '80vh',
        overflow: 'auto',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
        animation: 'slideUp 0.3s ease',
      }
    });

    // Header
    const header = this.createHeader(versionInfo);
    const closeBtn = header.querySelector('button');
    closeBtn.addEventListener('click', () => this.close());

    // Content
    const content = this.createContent(messageText, versionInfo);

    modalContent.appendChild(header);
    modalContent.appendChild(content);
    modal.appendChild(modalContent);

    // Click outside to close
    modal.addEventListener('click', (e) => {
      if (e.target === modal) this.close();
    });

    // ESC to close
    const escHandler = (e) => {
      if (e.key === 'Escape') this.close();
    };
    document.addEventListener('keydown', escHandler);

    // Store for cleanup
    this.activeModal = { element: modal, escHandler };

    document.body.appendChild(modal);
  }

  /**
   * Modal header oluştur
   */
  createHeader(versionInfo) {
    const header = DOMUtils.createElement('div', {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
        paddingBottom: '16px',
        borderBottom: '2px solid #f0f0f0',
      }
    });

    const title = DOMUtils.createElement('h2', {
      innerHTML: `✏️ Edit History ${versionInfo ? `<span style="color: #667eea; font-size: 16px;">${versionInfo}</span>` : ''}`,
      style: {
        fontSize: '20px',
        fontWeight: '600',
        color: '#333',
        margin: '0',
      }
    });

    const closeBtn = DOMUtils.createElement('button', {
      innerHTML: '✕',
      style: {
        background: 'none',
        border: 'none',
        fontSize: '24px',
        color: '#999',
        cursor: 'pointer',
        padding: '0',
        width: '32px',
        height: '32px',
        borderRadius: '50%',
        transition: 'all 0.2s ease',
      }
    });

    closeBtn.addEventListener('mouseenter', () => {
      closeBtn.style.background = '#f0f0f0';
      closeBtn.style.color = '#333';
    });

    closeBtn.addEventListener('mouseleave', () => {
      closeBtn.style.background = 'none';
      closeBtn.style.color = '#999';
    });

    header.appendChild(title);
    header.appendChild(closeBtn);

    return header;
  }

  /**
   * Modal content oluştur
   */
  createContent(messageText, versionInfo) {
    return DOMUtils.createElement('div', {
      innerHTML: `
        <p style="margin-bottom: 16px; padding: 12px; background: #f8f9fa; border-radius: 8px; font-size: 14px;">
          ℹ️ <strong>Not:</strong> Claude edit history'yi tam saklamıyor. Bu badge edit yapıldığını gösterir.
        </p>
        <div style="margin-top: 20px; padding: 16px; background: #f8f9fa; border-radius: 8px; border: 2px solid #667eea;">
          <div style="margin-bottom: 12px; font-size: 14px;">
            <strong style="color: #667eea;">📝 Güncel Mesaj:</strong>
          </div>
          <div style="font-size: 14px; color: #333; white-space: pre-wrap; word-break: break-word;">
            ${messageText.substring(0, 500)}${messageText.length > 500 ? '...' : ''}
          </div>
        </div>
        <div style="margin-top: 20px; padding: 12px; background: #fff3cd; border-radius: 8px; font-size: 13px; color: #856404;">
          💡 <strong>İpucu:</strong> Versiyonlar arasında gezinmek için mesaj üzerindeki <strong>◀ / ▶</strong> butonlarını kullanın.
        </div>
      `,
    });
  }

  /**
   * Modal'ı kapat
   */
  close() {
    if (!this.activeModal) return;

    const { element, escHandler } = this.activeModal;
    element.style.animation = 'fadeOut 0.2s ease';

    setTimeout(() => {
      element.remove();
      document.removeEventListener('keydown', escHandler);
      this.activeModal = null;
    }, 200);
  }
}

export default EditModal;
