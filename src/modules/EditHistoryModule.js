/**
 * EditHistoryModule - Edit yapılmış promptları gösterir
 * BaseModule'den türetilir
 * 
 * Robust timing sistemi ile sürekli tarama yapar
 */
import BaseModule from './BaseModule.js';
import { Events } from '../utils/EventBus.js';

class EditHistoryModule extends BaseModule {
  constructor() {
    super('editHistory');
    
    this.editedMessages = [];
    this.activeModal = null;
    this.observerTimeout = null;
    this.scanInterval = null;
    this.scrollHandler = null;
    
    // Yeni UI elementleri
    this.miniMap = null;
    this.floatingPanel = null;
    this.isPanelOpen = false;
  }

  async init() {
    await super.init();
    if (!this.enabled) return;

    this.log('Edit History başlatılıyor...');

    // Header butonu oluştur
    setTimeout(() => this.createHeaderButton(), 500); // Header'in render olması için bekle

    // Floating panel oluştur (mini-map kaldırıldı, sadece panel)
    this.createFloatingPanel();

    // DOM'u sürekli izle ve edit'leri güncelle
    this.startContinuousScanning();

    // Modal için event listeners
    this.setupModalListeners();

    this.log('✅ Edit History aktif - sürekli tarama modu');
  }

  /**
   * Sürekli tarama modunu başlat
   * Timing sorunlarını çözmek için multiple stratejiler kullanır
   */
  startContinuousScanning() {
    // 1. Hemen ilk tarama (100ms sonra, DOM'un render olması için)
    setTimeout(() => this.scanForEdits(), 100);
    
    // 2. Düzenli periyodik taramalar (her 2 saniyede bir)
    this.scanInterval = setInterval(() => {
      this.scanForEdits();
    }, 2000);

    // 3. DOM observer - değişiklik olduğunda (debounced)
    this.observer = this.dom.observeDOM(() => {
      clearTimeout(this.observerTimeout);
      this.observerTimeout = setTimeout(() => {
        this.scanForEdits();
      }, 1000);
    });

    // 4. Scroll event - kullanıcı scroll ettiğinde (debounced)
    this.scrollHandler = this.dom.debounce(() => {
      this.scanForEdits();
    }, 500);
    window.addEventListener('scroll', this.scrollHandler);

    this.log('➡️ Sürekli tarama başlatıldı (interval + observer + scroll)');
  }

  /**
   * Edit'leri tara ve güncelle
   */
  scanForEdits() {
    const editedPrompts = this.dom.getEditedPrompts();
    
    // Eğer sayı değiştiyse veya ilk tarama ise güncelle
    const currentCount = editedPrompts.length;
    const hadEdits = this.editedMessages.length;
    
    if (currentCount !== hadEdits || currentCount > 0) {
      this.updateEditedMessages(editedPrompts);
    }
  }

  /**
   * Edit mesajlarını güncelle
   */
  updateEditedMessages(editedPrompts) {
    const oldCount = this.editedMessages.length;
    
    // Mevcut edit'leri takip et (containerId bazlı)
    const currentEditIds = new Set(editedPrompts.map(e => e.containerId));
    const previousEditIds = new Set(this.editedMessages.map(e => e.containerId));
    
    // Yeni eklenenler
    const newEdits = editedPrompts.filter(e => !previousEditIds.has(e.containerId));
    
    // Kaldırılanlar
    const removedEdits = this.editedMessages.filter(e => !currentEditIds.has(e.containerId));
    
    // Log changes
    if (newEdits.length > 0) {
      this.log(`➕ ${newEdits.length} yeni edit bulundu`);
      newEdits.forEach(edit => {
        this.log(`   ID:${edit.containerId} → ${edit.versionInfo}`);
      });
    }
    
    if (removedEdits.length > 0) {
      this.log(`➖ ${removedEdits.length} edit kaldırıldı`);
    }

    // Badge'leri güncelle
    this.updateBadges(editedPrompts);
    
    // Highlight'ları güncelle
    this.updateHighlights(editedPrompts);
    
    // State'i güncelle
    this.editedMessages = editedPrompts.map((editInfo, index) => ({
      element: editInfo.element,
      index,
      versionInfo: editInfo.versionInfo,
      currentVersion: editInfo.currentVersion,
      totalVersions: editInfo.totalVersions,
      containerId: editInfo.containerId,
      history: this.dom.getEditHistory(editInfo.element)
    }));

    // Emit event
    if (this.editedMessages.length !== oldCount) {
      this.log(`🔄 Toplam edit: ${oldCount} → ${this.editedMessages.length}`);
      this.emit(Events.EDIT_MESSAGES_FOUND, this.editedMessages);
    }
    
    // Paneli ve header butonunu güncelle
    this.updateFloatingPanel();
    this.updateHeaderButton();
  }

  /**
   * Mini-map oluştur (sağ tarafta edit overview)
   */
  createMiniMap() {
    // Navigation buttons'ın pozisyonunu al
    const navButtons = document.getElementById('claude-nav-buttons');
    let mapSide = 'left'; // default (navigation'ın karşısı)
    
    if (navButtons) {
      const navStyle = window.getComputedStyle(navButtons);
      // Eğer navigation sağdaysa, mini-map solda olmalı
      if (navStyle.right !== 'auto' && navStyle.right !== '') {
        mapSide = 'left';
      } else {
        mapSide = 'right';
      }
    }

    this.miniMap = this.dom.createElement('div', {
      id: 'claude-edit-minimap',
      className: 'claude-edit-minimap',
      style: {
        position: 'fixed',
        [mapSide]: '10px',
        top: '50%',
        transform: 'translateY(-50%)',
        width: '8px',
        height: '300px',
        background: 'rgba(0, 0, 0, 0.1)',
        borderRadius: '4px',
        zIndex: '9998',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      }
    });

    // Hover effect
    this.miniMap.addEventListener('mouseenter', () => {
      this.miniMap.style.width = '12px';
      this.miniMap.style.background = 'rgba(102, 126, 234, 0.2)';
    });

    this.miniMap.addEventListener('mouseleave', () => {
      this.miniMap.style.width = '8px';
      this.miniMap.style.background = 'rgba(0, 0, 0, 0.1)';
    });

    // Click - toggle floating panel
    this.miniMap.addEventListener('click', (e) => {
      // Marker'a tıklandıysa panel açma (marker kendi handler'ını çalıştırır)
      if (e.target.classList.contains('edit-marker')) return;
      this.toggleFloatingPanel();
    });

    document.body.appendChild(this.miniMap);
    this.elements.miniMap = this.miniMap;
  }

  /**
   * Floating panel oluştur (edit listesi)
   * Header butonunun hemen altında açılır
   */
  createFloatingPanel() {
    this.floatingPanel = this.dom.createElement('div', {
      id: 'claude-edit-panel',
      className: 'claude-edit-panel',
      style: {
        position: 'fixed',
        top: '60px', // Header'dan biraz aşağıda
        right: '20px', // Sağ üst köşe
        width: '280px',
        maxHeight: '500px',
        background: 'white',
        borderRadius: '12px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
        border: '1px solid rgba(0, 0, 0, 0.1)',
        zIndex: '9999',
        display: 'none', // Başlangıçta kapalı
        flexDirection: 'column',
        overflow: 'hidden',
        animation: 'slideDown 0.2s ease',
      }
    });

    // Header
    const header = this.dom.createElement('div', {
      style: {
        padding: '12px 16px',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        fontWeight: '600',
        fontSize: '14px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }
    });

    const title = this.dom.createElement('span', {
      textContent: '✏️ Edit Points',
    });

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
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'background 0.2s',
      }
    });

    closeBtn.addEventListener('mouseenter', () => {
      closeBtn.style.background = 'rgba(255, 255, 255, 0.2)';
    });

    closeBtn.addEventListener('mouseleave', () => {
      closeBtn.style.background = 'none';
    });

    closeBtn.addEventListener('click', () => {
      this.toggleFloatingPanel();
    });

    header.appendChild(title);
    header.appendChild(closeBtn);

    // Content container
    const content = this.dom.createElement('div', {
      id: 'claude-edit-panel-content',
      style: {
        padding: '8px',
        overflowY: 'auto',
        flex: '1',
      }
    });

    this.floatingPanel.appendChild(header);
    this.floatingPanel.appendChild(content);
    document.body.appendChild(this.floatingPanel);
    
    this.elements.floatingPanel = this.floatingPanel;
  }

  /**
   * Mini-map'ı güncelle
   */
  updateMiniMap() {
    if (!this.miniMap) return;

    // Önceki marker'ları temizle
    this.miniMap.querySelectorAll('.edit-marker').forEach(m => m.remove());

    if (this.editedMessages.length === 0) {
      this.miniMap.style.display = 'none';
      return;
    }

    this.miniMap.style.display = 'block';

    // Sayfa yüksekliği
    const pageHeight = document.documentElement.scrollHeight;
    const viewportHeight = window.innerHeight;
    const miniMapHeight = 300;

    this.editedMessages.forEach((editMsg, index) => {
      const element = editMsg.element;
      const elementTop = element.offsetTop;
      
      // Mini-map üzerindeki pozisyon (yüzdesel)
      const percentage = elementTop / pageHeight;
      const markerTop = percentage * miniMapHeight;

      const marker = this.dom.createElement('div', {
        className: 'edit-marker',
        title: `Edit ${index + 1}: ${editMsg.versionInfo}`,
        style: {
          position: 'absolute',
          top: `${markerTop}px`,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '100%',
          height: '4px',
          background: '#667eea',
          borderRadius: '2px',
          cursor: 'pointer',
          transition: 'all 0.2s',
        }
      });

      // Hover
      marker.addEventListener('mouseenter', () => {
        marker.style.height = '8px';
        marker.style.background = '#764ba2';
      });

      marker.addEventListener('mouseleave', () => {
        marker.style.height = '4px';
        marker.style.background = '#667eea';
      });

      // Click - scroll to edit
      marker.addEventListener('click', (e) => {
        e.stopPropagation();
        this.scrollToEdit(index);
      });

      this.miniMap.appendChild(marker);
    });
  }

  /**
   * Header'a Edit Points butonu ekle
   */
  createHeaderButton() {
    // Header'ı bul
    const header = document.querySelector('header[data-testid="page-header"]');
    if (!header) {
      this.warn('Header bulunamadı, buton eklenemedi');
      return;
    }

    // Zaten eklendiyse tekrar ekleme
    if (header.querySelector('#claude-edit-header-btn')) {
      return;
    }

    // Sağ taraftaki action butonları konteynerını bul
    const rightActions = header.querySelector('[data-testid="chat-actions"]')?.parentElement;
    if (!rightActions) {
      this.warn('Actions container bulunamadı');
      return;
    }

    // Edit Points butonu oluştur
    const button = this.dom.createElement('button', {
      id: 'claude-edit-header-btn',
      className: 'inline-flex items-center justify-center relative shrink-0 can-focus select-none disabled:pointer-events-none disabled:opacity-50 text-text-000 font-base-bold border-0.5 border-border-200 relative overflow-hidden transition duration-100 hover:border-border-300/0 bg-bg-300/0 hover:bg-bg-400 h-8 rounded-md px-3 min-w-[4rem] active:scale-[0.985] whitespace-nowrap !text-xs',
      type: 'button',
      style: {
        display: 'none', // Başlangıçta gizli (edit yoksa)
      }
    });

    // İçerik
    const content = this.dom.createElement('div', {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
      }
    });

    const icon = this.dom.createElement('span', {
      textContent: '✏️',
      style: {
        fontSize: '14px',
      }
    });

    const label = this.dom.createElement('span', {
      id: 'claude-edit-header-label',
      textContent: 'Edit Points',
    });

    content.appendChild(icon);
    content.appendChild(label);
    button.appendChild(content);

    // Click handler - toggle floating panel
    button.addEventListener('click', () => {
      this.toggleFloatingPanel();
    });

    // Share butonundan önce ekle
    rightActions.insertBefore(button, rightActions.firstChild);
    this.elements.headerButton = button;

    this.log('✅ Header butonu eklendi');
  }

  /**
   * Header butonunu güncelle
   */
  updateHeaderButton() {
    const button = this.elements.headerButton;
    if (!button) return;

    const label = button.querySelector('#claude-edit-header-label');
    if (!label) return;

    // Edit sayısına göre göster/gizle
    if (this.editedMessages.length > 0) {
      button.style.display = 'inline-flex';
      label.textContent = `${this.editedMessages.length} Edit${this.editedMessages.length > 1 ? 's' : ''}`;
    } else {
      button.style.display = 'none';
    }
  }

  /**
   * Floating panel'ı güncelle
   */
  updateFloatingPanel() {
    if (!this.floatingPanel) return;

    const content = this.floatingPanel.querySelector('#claude-edit-panel-content');
    if (!content) return;

    // İçeriği temizle
    content.innerHTML = '';

    if (this.editedMessages.length === 0) {
      content.innerHTML = '<div style="padding: 20px; text-align: center; color: #999; font-size: 13px;">Henüz edit yok</div>';
      return;
    }

    // Her edit için item oluştur
    this.editedMessages.forEach((editMsg, index) => {
      const item = this.dom.createElement('div', {
        className: 'edit-panel-item',
        style: {
          padding: '10px 12px',
          marginBottom: '4px',
          background: '#f8f9fa',
          borderRadius: '8px',
          cursor: 'pointer',
          transition: 'all 0.2s',
          borderLeft: '3px solid #667eea',
        }
      });

      const header = this.dom.createElement('div', {
        style: {
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '4px',
        }
      });

      const label = this.dom.createElement('span', {
        textContent: `Edit ${index + 1}`,
        style: {
          fontWeight: '600',
          fontSize: '13px',
          color: '#333',
        }
      });

      const version = this.dom.createElement('span', {
        textContent: editMsg.versionInfo,
        style: {
          fontSize: '11px',
          color: '#667eea',
          fontWeight: '600',
        }
      });

      header.appendChild(label);
      header.appendChild(version);

      // Preview text
      const userMessage = editMsg.element.querySelector('[data-testid="user-message"]');
      const messageText = userMessage ? userMessage.textContent : '';
      const preview = this.dom.createElement('div', {
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

      // Click - scroll to edit
      item.addEventListener('click', () => {
        this.scrollToEdit(index);
      });

      content.appendChild(item);
    });
  }

  /**
   * Belirli bir edit'e scroll yap
   */
  scrollToEdit(index) {
    if (index < 0 || index >= this.editedMessages.length) return;

    const editMsg = this.editedMessages[index];
    this.log(`🎯 Edit ${index + 1}'e scroll yapılıyor`);

    // Scroll
    this.dom.scrollToElement(editMsg.element, 'center');

    // Highlight
    this.dom.flashClass(editMsg.element, 'claude-nav-highlight', 2000);
  }

  /**
   * Floating panel'ı aç/kapat
   */
  toggleFloatingPanel() {
    this.isPanelOpen = !this.isPanelOpen;
    
    if (this.floatingPanel) {
      this.floatingPanel.style.display = this.isPanelOpen ? 'flex' : 'none';
    }
    
    this.log(`Panel ${this.isPanelOpen ? 'açıldı' : 'kapandı'}`);
  }

  /**
   * Badge'leri güncelle
   */
  updateBadges(editedPrompts) {
    if (!this.getSetting('showBadges')) {
      // Badge'ler kapalıysa hepsini kaldır
      document.querySelectorAll('.claude-edit-badge').forEach(b => b.remove());
      return;
    }

    const currentElements = new Set(editedPrompts.map(e => e.element));
    
    // Eski badge'leri temizle (artık edit olmayan mesajlardan)
    document.querySelectorAll('.claude-edit-badge').forEach(badge => {
      const parent = badge.parentElement;
      if (parent && !currentElements.has(parent)) {
        badge.remove();
      }
    });
    
    // Yeni badge'leri ekle
    editedPrompts.forEach(editInfo => {
      this.addEditBadge(editInfo.element, editInfo.versionInfo);
    });
  }

  /**
   * Highlight'ları güncelle
   */
  updateHighlights(editedPrompts) {
    const shouldHighlight = this.getSetting('highlightEdited');
    
    // Önce hepsini kaldır
    document.querySelectorAll('.claude-edit-highlighted').forEach(el => {
      el.classList.remove('claude-edit-highlighted');
    });
    
    // Gerekiyorsa yeniden ekle
    if (shouldHighlight) {
      editedPrompts.forEach(editInfo => {
        editInfo.element.classList.add('claude-edit-highlighted');
      });
    }
  }

  addEditBadge(messageElement, versionInfo = '') {
    // Zaten badge var mı?
    if (messageElement.querySelector('.claude-edit-badge')) {
      return; // Duplicate önleme
    }

    const badge = this.dom.createElement('div', {
      className: 'claude-edit-badge',
      innerHTML: `✏️ ${versionInfo}`,
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

    // Hover effects
    badge.addEventListener('mouseenter', () => {
      badge.style.transform = 'scale(1.05)';
      badge.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.25)';
    });

    badge.addEventListener('mouseleave', () => {
      badge.style.transform = 'scale(1)';
      badge.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.15)';
    });

    // Click handler
    badge.addEventListener('click', (e) => {
      e.stopPropagation();
      this.showEditHistoryModal(messageElement, versionInfo);
    });

    // Parent'ın position'ını ayarla
    const position = window.getComputedStyle(messageElement).position;
    if (position === 'static') {
      messageElement.style.position = 'relative';
    }

    messageElement.appendChild(badge);
  }

  showEditHistoryModal(messageElement, versionInfo = '') {
    this.log('Edit modal açılıyor:', versionInfo);

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
      innerHTML: `✏️ Edit History ${versionInfo ? `<span style="color: #667eea; font-size: 16px;">${versionInfo}</span>` : ''}`,
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

    closeBtn.addEventListener('click', () => this.closeModal());

    header.appendChild(title);
    header.appendChild(closeBtn);

    // Content
    const content = this.dom.createElement('div', {
      innerHTML: `
        <p style="margin-bottom: 16px; padding: 12px; background: #f8f9fa; border-radius: 8px; font-size: 14px;">
          ℹ️ <strong>Not:</strong> Claude edit history'yi tam saklamıyor. Bu badge edit yapıldığını gösterir.
        </p>
        <div style="margin-top: 20px; padding: 16px; background: #f8f9fa; border-radius: 8px; border: 2px solid #667eea;">
          <div style="margin-bottom: 12px; font-size: 14px;">
            <strong style="color: #667eea;">📝 Güncel Mesaj:</strong>
          </div>
          <div style="fontSize: 14px; color: #333; white-space: pre-wrap; word-break: break-word;">
            ${messageText.substring(0, 500)}${messageText.length > 500 ? '...' : ''}
          </div>
        </div>
        <div style="margin-top: 20px; padding: 12px; background: #fff3cd; border-radius: 8px; font-size: 13px; color: #856404;">
          💡 <strong>İpucu:</strong> Versiyonlar arasında gezinmek için mesaj üzerindeki <strong>◀ / ▶</strong> butonlarını kullanın.
        </div>
      `,
    });

    modalContent.appendChild(header);
    modalContent.appendChild(content);
    modal.appendChild(modalContent);

    // Click outside to close
    modal.addEventListener('click', (e) => {
      if (e.target === modal) this.closeModal();
    });

    // ESC to close
    const escHandler = (e) => {
      if (e.key === 'Escape') this.closeModal();
    };
    document.addEventListener('keydown', escHandler);

    // Store for cleanup
    this.activeModal = { element: modal, escHandler };

    document.body.appendChild(modal);
    this.emit(Events.EDIT_MODAL_OPENED, { messageElement, versionInfo });
  }

  closeModal() {
    if (!this.activeModal) return;

    const { element, escHandler } = this.activeModal;
    element.style.animation = 'fadeOut 0.2s ease';

    setTimeout(() => {
      element.remove();
      document.removeEventListener('keydown', escHandler);
      this.activeModal = null;
      this.emit(Events.EDIT_MODAL_CLOSED);
    }, 200);
  }

  setupModalListeners() {
    this.subscribe(Events.EDIT_MODAL_OPENED, () => {
      this.log('✅ Modal açıldı');
    });

    this.subscribe(Events.EDIT_MODAL_CLOSED, () => {
      this.log('✅ Modal kapandı');
    });
  }

  onSettingsChanged(settings) {
    this.log('⚙️ Settings değişti:', settings);
    
    // Hemen yeniden tara
    this.scanForEdits();
  }

  destroy() {
    this.log('🛑 Edit History durduruluyor...');

    // Interval'i durdur
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }

    // Observer'i durdur
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    // Scroll handler'ı kaldır
    if (this.scrollHandler) {
      window.removeEventListener('scroll', this.scrollHandler);
      this.scrollHandler = null;
    }

    // Timeout'ları temizle
    if (this.observerTimeout) {
      clearTimeout(this.observerTimeout);
    }

    // Header butonunu kaldır
    if (this.elements.headerButton) {
      this.elements.headerButton.remove();
    }

    // Floating panel'ı kaldır
    if (this.floatingPanel) {
      this.floatingPanel.remove();
    }

    // Tüm badge'leri kaldır
    document.querySelectorAll('.claude-edit-badge').forEach(badge => badge.remove());

    // Tüm highlight'ları kaldır
    document.querySelectorAll('.claude-edit-highlighted').forEach(el => {
      el.classList.remove('claude-edit-highlighted');
    });

    // Modal'ı kapat
    this.closeModal();

    super.destroy();
  }
}

// Event constants
Events.EDIT_MESSAGES_FOUND = 'edit:messages_found';
Events.EDIT_MODAL_OPENED = 'edit:modal_opened';
Events.EDIT_MODAL_CLOSED = 'edit:modal_closed';

export default EditHistoryModule;
