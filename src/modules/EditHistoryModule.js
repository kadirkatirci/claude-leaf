/**
 * EditHistoryModule - Edit yapılmış promptları gösterir
 * BaseModule'den türetilir
 */
import BaseModule from './BaseModule.js';
import { Events } from '../utils/EventBus.js';

class EditHistoryModule extends BaseModule {
  constructor() {
    super('editHistory');
    
    this.editedMessages = [];
    this.activeModal = null;
    this.observerTimeout = null;
  }

  async init() {
    await super.init();
    if (!this.enabled) return;

    this.log('Edit History başlatılıyor...');

    // DOM'un hazır olmasını bekle
    await this.waitForDOM();

    // Edited mesajları bul
    this.findEditedMessages();

    // DOM değişikliklerini izle
    this.observeDOM();

    // Modal için event listeners
    this.setupModalListeners();

    this.log(`✅ ${this.editedMessages.length} edit edilmiş mesaj bulundu`);
  }

  /**
   * DOM'un hazır olmasını bekle
   */
  async waitForDOM() {
    // İlk mesajların yüklenmesini bekle
    let attempts = 0;
    const maxAttempts = 20; // 2 saniye max

    while (attempts < maxAttempts) {
      const messages = this.dom.findMessages();
      if (messages.length > 0) {
        this.log(`DOM hazır: ${messages.length} mesaj bulundu`);
        // Biraz daha bekle, version counter'ın render olması için
        await new Promise(resolve => setTimeout(resolve, 500));
        return;
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }

    this.warn('DOM timeout: Mesajlar bulunamadı');
  }

  destroy() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    // Tüm badge'leri kaldır
    document.querySelectorAll('.claude-edit-badge').forEach(badge => badge.remove());

    // Modal'ı kapat
    this.closeModal();

    super.destroy();
  }

  findEditedMessages() {
    // DOMUtils'den edited promptları al
    const editedPrompts = this.dom.getEditedPrompts();
    this.log(`getEditedPrompts() döndü: ${editedPrompts.length} mesaj`);
    
    // Eski badge'leri temizleme - sadece artık edit olmayan mesajlardakiler
    const currentEditedElements = new Set(editedPrompts.map(e => e.element));
    const oldBadges = document.querySelectorAll('.claude-edit-badge');
    this.log(`Mevcut badge sayısı: ${oldBadges.length}`);
    
    oldBadges.forEach(badge => {
      const parent = badge.parentElement;
      if (parent && !currentEditedElements.has(parent)) {
        this.log('Eski badge kaldırılıyor');
        badge.remove();
      }
    });

    this.editedMessages = [];

    editedPrompts.forEach((editInfo, index) => {
      this.log(`Edit mesaj ${index + 1}: version=${editInfo.versionInfo}`);
      
      this.editedMessages.push({
        element: editInfo.element,
        index,
        versionInfo: editInfo.versionInfo,
        currentVersion: editInfo.currentVersion,
        totalVersions: editInfo.totalVersions,
        history: this.dom.getEditHistory(editInfo.element)
      });

      // Badge ekle (sadece yoksa)
      if (this.getSetting('showBadges')) {
        this.addEditBadge(editInfo.element, editInfo.versionInfo);
      }

      // Highlight ekle
      if (this.getSetting('highlightEdited')) {
        this.highlightEditedMessage(editInfo.element);
      } else {
        editInfo.element.classList.remove('claude-edit-highlighted');
      }
    });

    this.emit(Events.EDIT_MESSAGES_FOUND, this.editedMessages);
  }

  addEditBadge(messageElement, versionInfo = '') {
    // Zaten badge var mı kontrol et
    if (messageElement.querySelector('.claude-edit-badge')) {
      return;
    }

    const badge = this.dom.createElement('div', {
      className: 'claude-edit-badge',
      innerHTML: `✏️ Edited ${versionInfo ? `(${versionInfo})` : ''}`,
      style: {
        position: 'absolute',
        top: '8px',
        right: '8px',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        padding: '4px 10px',
        borderRadius: '12px',
        fontSize: '11px',
        fontWeight: '600',
        cursor: 'pointer',
        zIndex: '100',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
        transition: 'all 0.2s ease',
      }
    });

    // Hover effect
    badge.addEventListener('mouseenter', () => {
      badge.style.transform = 'scale(1.05)';
      badge.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.25)';
    });

    badge.addEventListener('mouseleave', () => {
      badge.style.transform = 'scale(1)';
      badge.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.15)';
    });

    // Click handler - Modal aç
    badge.addEventListener('click', (e) => {
      e.stopPropagation();
      this.showEditHistoryModal(messageElement, versionInfo);
    });

    // Mesajın position'ını relative yap
    const position = window.getComputedStyle(messageElement).position;
    if (position === 'static') {
      messageElement.style.position = 'relative';
    }

    messageElement.appendChild(badge);
  }

  highlightEditedMessage(messageElement) {
    messageElement.classList.add('claude-edit-highlighted');
  }

  showEditHistoryModal(messageElement, versionInfo = '') {
    this.log('Edit history modal açılıyor...', versionInfo);

    // Mesaj içeriğini al
    const userMessage = messageElement.querySelector('[data-testid="user-message"]');
    const messageText = userMessage ? userMessage.textContent : messageElement.textContent;
    
    // Modal oluştur
    const modal = this.dom.createElement('div', {
      className: 'claude-edit-modal',
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

    const modalContent = this.dom.createElement('div', {
      className: 'claude-edit-modal-content',
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
    const header = this.dom.createElement('div', {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
        paddingBottom: '16px',
        borderBottom: '2px solid #f0f0f0',
      }
    });

    const title = this.dom.createElement('h2', {
      innerHTML: versionInfo ? `✏️ Edit History <span style="color: #667eea; font-size: 16px;">(${versionInfo})</span>` : '✏️ Edit History',
      style: {
        fontSize: '20px',
        fontWeight: '600',
        color: '#333',
        margin: '0',
      }
    });

    const closeBtn = this.dom.createElement('button', {
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
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
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

    closeBtn.addEventListener('click', () => {
      this.closeModal();
    });

    header.appendChild(title);
    header.appendChild(closeBtn);

    // Content
    const content = this.dom.createElement('div', {
      style: {
        color: '#555',
        lineHeight: '1.6',
      }
    });

    // Info message
    const infoBox = this.dom.createElement('div', {
      innerHTML: `
        <p style="margin-bottom: 16px; padding: 12px; background: #f8f9fa; border-radius: 8px; font-size: 14px;">
          ℹ️ <strong>Not:</strong> Claude web arayüzü edit history'yi tam olarak saklamıyor. 
          Bu özellik, edit yapıldığını ve versiyon sayısını gösterir.
        </p>
      `,
    });

    // Current message
    const currentMsg = this.dom.createElement('div', {
      style: {
        marginTop: '20px',
        padding: '16px',
        background: '#f8f9fa',
        borderRadius: '8px',
        border: '2px solid #667eea',
      }
    });

    const currentLabel = this.dom.createElement('div', {
      innerHTML: '<strong style="color: #667eea;">📝 Güncel Mesaj:</strong>',
      style: {
        marginBottom: '12px',
        fontSize: '14px',
      }
    });

    const currentText = this.dom.createElement('div', {
      textContent: messageText.substring(0, 500) + (messageText.length > 500 ? '...' : ''),
      style: {
        fontSize: '14px',
        color: '#333',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }
    });

    currentMsg.appendChild(currentLabel);
    currentMsg.appendChild(currentText);

    // Tips
    const tips = this.dom.createElement('div', {
      innerHTML: `
        <div style="margin-top: 20px; padding: 12px; background: #fff3cd; border-radius: 8px; font-size: 13px; color: #856404;">
          💡 <strong>İpucu:</strong> Versiyonlar arasında gezinmek için:
          <ul style="margin: 8px 0 0 20px; padding: 0;">
            <li>Mesajın üzerinde görünen <strong>◀ / ▶</strong> butonlarını kullanın</li>
            <li>Claude'un navigation sistemi ile önceki versiyonları görüntüleyin</li>
            <li>Toplam ${versionInfo} versiyon mevcut</li>
          </ul>
        </div>
      `,
    });

    content.appendChild(infoBox);
    content.appendChild(currentMsg);
    content.appendChild(tips);

    modalContent.appendChild(header);
    modalContent.appendChild(content);
    modal.appendChild(modalContent);

    // Click outside to close
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        this.closeModal();
      }
    });

    // ESC to close
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        this.closeModal();
      }
    };
    document.addEventListener('keydown', escHandler);

    // Store for cleanup
    this.activeModal = {
      element: modal,
      escHandler
    };

    document.body.appendChild(modal);
    this.emit(Events.EDIT_MODAL_OPENED, { messageElement, versionInfo });
  }

  closeModal() {
    if (!this.activeModal) return;

    const { element, escHandler } = this.activeModal;

    // Animation çıkış
    element.style.animation = 'fadeOut 0.2s ease';

    setTimeout(() => {
      element.remove();
      document.removeEventListener('keydown', escHandler);
      this.activeModal = null;
      this.emit(Events.EDIT_MODAL_CLOSED);
    }, 200);
  }

  observeDOM() {
    this.observer = this.dom.observeDOM(() => {
      clearTimeout(this.observerTimeout);
      this.observerTimeout = setTimeout(() => {
        const oldCount = this.editedMessages.length;
        this.findEditedMessages();
        if (this.editedMessages.length !== oldCount) {
          this.log(`Edit mesaj sayısı güncellendi: ${oldCount} → ${this.editedMessages.length}`);
        }
      }, 1500); // 1.5 saniye debounce - version counter render için yeterli
    });
  }

  setupModalListeners() {
    // ESC tuşu ile modal'ı kapat
    this.subscribe(Events.EDIT_MODAL_OPENED, () => {
      this.log('Edit modal açıldı');
    });

    this.subscribe(Events.EDIT_MODAL_CLOSED, () => {
      this.log('Edit modal kapandı');
    });
  }

  onSettingsChanged(settings) {
    this.log('Settings güncellendi:', settings);

    // Badge göster/gizle
    const badges = document.querySelectorAll('.claude-edit-badge');
    badges.forEach(badge => {
      badge.style.display = settings.showBadges ? 'flex' : 'none';
    });

    // Highlight göster/gizle
    const highlighted = document.querySelectorAll('.claude-edit-highlighted');
    highlighted.forEach(el => {
      if (settings.highlightEdited) {
        el.classList.add('claude-edit-highlighted');
      } else {
        el.classList.remove('claude-edit-highlighted');
      }
    });

    // Yeniden tara
    this.findEditedMessages();
  }
}

// Event constants ekle
Events.EDIT_MESSAGES_FOUND = 'edit:messages_found';
Events.EDIT_MODAL_OPENED = 'edit:modal_opened';
Events.EDIT_MODAL_CLOSED = 'edit:modal_closed';

export default EditHistoryModule;
