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

    // Yeni mesajları izle
    this.observeMessages();

    // Klavye kısayolu
    if (this.settings.keyboardShortcuts) {
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

    // Auto-collapse açıksa otomatik collapse et
    if (this.settings.autoCollapse) {
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
    this.emit(Events.MESSAGE_COLLAPSED, { messageElement, isCollapsed });
  }

  /**
   * Klavye kısayolları
   */
  setupKeyboardShortcuts() {
    const handleKeydown = (e) => {
      // Alt + E - Expand/Collapse focused message
      if (e.altKey && e.key === 'e') {
        e.preventDefault();
        
        // En yakın mesajı bul
        const messages = document.querySelectorAll('[data-is-streaming="false"]');
        const scrollY = window.scrollY + window.innerHeight / 2;
        
        let closestMessage = null;
        let minDistance = Infinity;
        
        messages.forEach(msg => {
          const rect = msg.getBoundingClientRect();
          const distance = Math.abs(rect.top - scrollY);
          if (distance < minDistance) {
            minDistance = distance;
            closestMessage = msg;
          }
        });
        
        if (closestMessage) {
          this.collapse.toggleMessage(closestMessage);
        }
      }
    };

    document.addEventListener('keydown', handleKeydown);
    this.unsubscribers.push(() => {
      document.removeEventListener('keydown', handleKeydown);
    });
  }

  /**
   * Settings değiştiğinde
   */
  onSettingsChanged(settings) {
    this.log('⚙️ Settings değişti');
    
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
