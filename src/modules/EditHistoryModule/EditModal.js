/**
 * EditModal - Edit history modal dialog
 * Refactored to use Claude native classes
 */
import DOMUtils from '../../utils/DOMUtils.js';
import { textClass } from '../../utils/ClassNames.js';

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

    // Modal backdrop
    const modal = DOMUtils.createElement('div');
    modal.className = 'fixed inset-0 bg-black/70 flex items-center justify-center z-[10000]';
    modal.style.animation = 'fadeIn 0.2s ease';

    // Modal content
    const modalContent = DOMUtils.createElement('div');
    modalContent.className = 'bg-bg-000 rounded-xl p-6 overflow-auto shadow-2xl';
    Object.assign(modalContent.style, {
      maxWidth: '600px',
      maxHeight: '80vh',
      animation: 'slideUp 0.3s ease'
    });

    // Header
    const header = this.createHeader(versionInfo);
    const closeBtn = header.querySelector('button');
    closeBtn.addEventListener('click', () => this.close());

    // Content
    const content = this.createContent(messageText);

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
    const header = DOMUtils.createElement('div');
    header.className = 'flex justify-between items-center mb-5 pb-4 border-b-2 border-border-300';

    const title = DOMUtils.createElement('h2');
    title.className = textClass({ size: 'xl', weight: 'semibold' });
    title.innerHTML = `✏️ Edit History ${versionInfo ? `<span class="text-accent-main-100 text-base">${versionInfo}</span>` : ''}`;

    const closeBtn = DOMUtils.createElement('button');
    closeBtn.className = 'bg-transparent border-0 text-2xl text-text-400 hover:bg-bg-200 hover:text-text-000 cursor-pointer p-0 size-8 rounded-full transition-all flex items-center justify-center';
    closeBtn.innerHTML = '✕';

    header.appendChild(title);
    header.appendChild(closeBtn);

    return header;
  }

  /**
   * Modal content oluştur
   */
  createContent(messageText) {
    const container = DOMUtils.createElement('div');

    // Info note
    const infoBox = DOMUtils.createElement('div');
    infoBox.className = 'mb-4 p-3 bg-bg-100 rounded-lg text-sm';
    infoBox.innerHTML = `ℹ️ <strong>Not:</strong> Claude edit history'yi tam saklamıyor. Bu badge edit yapıldığını gösterir.`;

    // Current message box
    const messageBox = DOMUtils.createElement('div');
    messageBox.className = 'mt-5 p-4 bg-bg-100 rounded-lg border-2 border-accent-main-100';

    const messageLabel = DOMUtils.createElement('div');
    messageLabel.className = 'mb-3 text-sm font-semibold text-accent-main-100';
    messageLabel.innerHTML = '📝 Güncel Mesaj:';

    const messageContent = DOMUtils.createElement('div');
    messageContent.className = 'text-sm text-text-000 whitespace-pre-wrap break-words';
    messageContent.textContent = messageText.substring(0, 500) + (messageText.length > 500 ? '...' : '');

    messageBox.appendChild(messageLabel);
    messageBox.appendChild(messageContent);

    // Tip box
    const tipBox = DOMUtils.createElement('div');
    tipBox.className = 'mt-5 p-3 bg-bg-100 rounded-lg text-xs text-text-300';
    tipBox.innerHTML = `💡 <strong>İpucu:</strong> Versiyonlar arasında gezinmek için mesaj üzerindeki <strong>◀ / ▶</strong> butonlarını kullanın.`;

    container.appendChild(infoBox);
    container.appendChild(messageBox);
    container.appendChild(tipBox);

    return container;
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
