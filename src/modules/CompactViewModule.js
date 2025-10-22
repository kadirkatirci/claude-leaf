/**
 * CompactViewModule - Claude yanıtlarını collapse/expand et
 * BaseModule'den türetilir
 */
import BaseModule from './BaseModule.js';
import { Events } from '../utils/EventBus.js';
import DOMUtils from '../utils/DOMUtils.js';

// Alt bileşenler
import MessageCollapse from './CompactViewModule/MessageCollapse.js';
import ExpandButton from './CompactViewModule/ExpandButton.js';

class CompactViewModule extends BaseModule {
  constructor() {
    super('compactView');
    
    // Alt bileşenler
    this.collapse = new MessageCollapse(
      () => this.getSettings(),
      (msg, collapsed) => this.onMessageStateChanged(msg, collapsed)
    );
    
    this.expandButton = new ExpandButton(
      () => this.getTheme(),
      (msg) => this.collapse.toggleMessage(msg)
    );
    
    this.processedMessages = new WeakSet();
    this.observer = null;
  }

  async init() {
    await super.init();
    if (!this.enabled) return;

    this.log('Compact View başlatılıyor...');

    // Mevcut mesajları işle
    this.processMessages();

    // Auto collapse açıksa tüm mesajları daralt
    const autoCollapseEnabled = this.getSetting('autoCollapseEnabled');
    this.log(`[Auto Collapse] Durum: ${autoCollapseEnabled ? '✅ ACIK' : '❌ KAPALI'}`);
    
    if (autoCollapseEnabled) {
      setTimeout(() => {
        const count = this.collapseAllMessages();
        this.log(`🔄 Auto collapse - ${count} mesaj daraltıldı`);
      }, 500);
    }

    // Yeni mesajları izle
    this.observeMessages();

    // Klavye kısayolu
    if (this.getSetting('keyboardShortcuts')) {
      this.setupKeyboardShortcuts();
    }

    this.log('✅ Compact View aktif');
  }

  /**
   * Mesajları işle
   */
  processMessages() {
    // Claude yanıtlarını bul (assistant messages)
    const messages = document.querySelectorAll('[data-is-streaming="false"]');
    
    messages.forEach(message => {
      // Zaten işlendiyse atla
      if (this.processedMessages.has(message)) return;
      
      // User mesajlarını atla, sadece Claude yanıtları
      if (message.querySelector('[data-testid="user-message"]')) return;
      
      this.processMessage(message);
      this.processedMessages.add(message);
    });
  }

  /**
   * Tek bir mesajı işle
   */
  processMessage(messageElement) {
    // Collapse edilmeli mi?
    if (!this.collapse.shouldCollapse(messageElement)) {
      return;
    }

    // Auto-collapse açıksa otomatik collapse et (init sırasında değil, yeni mesajlar için)
    // Init sırasında tüm mesajlar collapseAllMessages() ile daraltılır
    if (this.getSetting('autoCollapse')) {
      this.collapse.collapseMessage(messageElement);
    }

    // Expand butonu ekle
    const isCollapsed = this.collapse.isCollapsed(messageElement);
    const button = this.expandButton.create(messageElement, isCollapsed);
    this.expandButton.insertNextToEditButton(messageElement, button);
  }

  /**
   * Yeni mesajları izle
   */
  observeMessages() {
    this.observer = DOMUtils.observeDOM(() => {
      this.processMessages();
    });
  }

  /**
   * Mesaj state değiştiğinde
   */
  onMessageStateChanged(messageElement, isCollapsed) {
    this.log(`Mesaj ${isCollapsed ? 'collapsed' : 'expanded'}`);
    
    // Butonu güncelle
    this.updateButtonState(messageElement, isCollapsed);
    
    this.emit(Events.MESSAGE_COLLAPSED, { messageElement, isCollapsed });
  }

  /**
   * Buton state'ini güncelle
   */
  updateButtonState(messageElement, isCollapsed) {
    // Mesaj container'ını bul (wrapper içinde olabilir)
    let targetContainer = messageElement;
    if (messageElement.parentElement?.classList.contains('claude-message-collapsed')) {
      targetContainer = messageElement.parentElement;
    }
    
    // Mevcut butonu bul - birkaç yerde olabilir
    let container = targetContainer.querySelector('.claude-expand-button-container');
    
    // Footer'da da arayabiliriz
    if (!container) {
      const nextSibling = targetContainer.nextElementSibling;
      if (nextSibling?.classList.contains('claude-expand-footer')) {
        container = nextSibling.querySelector('.claude-expand-button-container');
      }
    }
    
    if (!container) {
      // Buton yoksa yeni oluştur
      const button = this.expandButton.create(messageElement, isCollapsed);
      this.expandButton.insertNextToEditButton(messageElement, button);
      return;
    }
    
    // Mevcut butonu güncelle
    const button = container.querySelector('.claude-expand-btn');
    if (button) {
      button.innerHTML = isCollapsed ? '+ Daha fazla göster' : '− Daralt';
    }
  }

  /**
   * Tüm mesajları daralt
   */
  collapseAllMessages() {
    const messages = document.querySelectorAll('[data-is-streaming="false"]');
    let collapsedCount = 0;

    messages.forEach(message => {
      // User mesajlarını atla
      if (message.querySelector('[data-testid="user-message"]')) return;

      // Collapse edilmeli mi?
      if (this.collapse.shouldCollapse(message)) {
        const wasCollapsed = this.collapse.isCollapsed(message);
        
        // Zaten collapsed değilse, collapse et
        if (!wasCollapsed) {
          this.collapse.collapseMessage(message);
          collapsedCount++;
        }
      }
    });

    this.log(`📦 ${collapsedCount} mesaj daraltıldı`);
    return collapsedCount;
  }

  /**
   * Tüm mesajları genişlet
   */
  expandAllMessages() {
    const messages = document.querySelectorAll('[data-is-streaming="false"]');
    let expandedCount = 0;

    messages.forEach(message => {
      // User mesajlarını atla
      if (message.querySelector('[data-testid="user-message"]')) return;

      // Expand edilmeli mi?
      if (this.collapse.shouldCollapse(message)) {
        const wasCollapsed = this.collapse.isCollapsed(message);
        
        // Zaten collapsed ise, expand et
        if (wasCollapsed) {
          this.collapse.expandMessage(message);
          expandedCount++;
        }
      }
    });

    this.log(`📂 ${expandedCount} mesaj genişletildi`);
    return expandedCount;
  }

  /**
   * Klavye kısayolları
   * Alt + ArrowLeft = Tümünü Daralt
   * Alt + ArrowRight = Tümünü Genişlet
   */
  setupKeyboardShortcuts() {
    const handleKeydown = (e) => {
      // Alt + ArrowLeft (Sol) - Tümünü Daralt
      if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        this.collapseAllMessages();
        this.log('⌨️ Alt+← (Daralt)');
      }
      
      // Alt + ArrowRight (Sağ) - Tümünü Genişlet
      if (e.altKey && e.key === 'ArrowRight') {
        e.preventDefault();
        this.expandAllMessages();
        this.log('⌨️ Alt+→ (Genişlet)');
      }
    };

    document.addEventListener('keydown', handleKeydown);
    this.keydownHandler = handleKeydown;
    this.unsubscribers.push(() => {
      document.removeEventListener('keydown', handleKeydown);
    });

    this.log('⌨️ Keyboard shortcuts aktif: Alt+← (Daralt), Alt+→ (Genişlet)');
  }

  /**
   * Settings değiştiğinde
   */
  onSettingsChanged(settings) {
    this.log('⚙️ Settings değişti');
    
    // AutoCollapseEnabled değişti mi?
    const compactViewSettings = settings.compactView || {};
    if (compactViewSettings.autoCollapseEnabled !== undefined && compactViewSettings.autoCollapseEnabled) {
      // Tüm mesajları daralt
      this.collapseAllMessages();
    }
    
    // Mesajları yeniden işle
    this.processedMessages = new WeakSet();
    this.collapse.clear();
    this.processMessages();
  }

  /**
   * Modülü durdur
   */
  destroy() {
    this.log('🛑 Compact View durduruluyor...');

    if (this.observer) {
      this.observer.disconnect();
    }

    this.collapse.clear();
    
    // Tüm butonları kaldır
    document.querySelectorAll('.claude-expand-button-container').forEach(btn => {
      btn.remove();
    });

    super.destroy();
  }
}

// Event constants
Events.MESSAGE_COLLAPSED = 'compactView:message_collapsed';

export default CompactViewModule;
