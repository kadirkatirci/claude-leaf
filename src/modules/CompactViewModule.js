/**
 * CompactViewModule - Claude yanıtlarını collapse/expand et
 * BaseModule'den türetilir
 */
import BaseModule from './BaseModule.js';
import { Events } from '../utils/EventBus.js';
import MessageObserverMixin from '../core/MessageObserverMixin.js';
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

    // Enhance with MessageObserverMixin
    MessageObserverMixin.enhance(this);

    // Create collapse/expand all buttons in navigation container
    this.createCollapseButtons();

    // Mevcut mesajları işle
    this.processMessages();

    // Auto collapse açıksa tüm mesajları daralt
    const autoCollapseEnabled = await this.getSetting('autoCollapseEnabled');
    this.log(`[Auto Collapse] Durum: ${autoCollapseEnabled ? '✅ ACIK' : '❌ KAPALI'}`);

    if (autoCollapseEnabled) {
      setTimeout(() => {
        const count = this.collapseAllMessages();
        this.log(`🔄 Auto collapse - ${count} mesaj daraltıldı`);
      }, 500);
    }

    // Setup message observer
    this.setupMessageObserver(() => {
      this.processMessages();
    }, {
      throttleDelay: 500,
      trackMessageCount: false, // Process on any change
      checkConversationPage: false
    });

    // Klavye kısayolu
    if (await this.getSetting('keyboardShortcuts')) {
      this.setupKeyboardShortcuts();
    }

    this.log('✅ Compact View aktif');
  }

  /**
   * Collapse/Expand All butonlarını oluştur
   */
  createCollapseButtons() {
    // Navigation container'ı bul (NavigationModule tarafından oluşturulur)
    const waitForNavigation = setInterval(() => {
      const navContainer = document.getElementById('claude-nav-container');
      if (navContainer) {
        clearInterval(waitForNavigation);
        this.addButtonsToNavigation(navContainer);
      }
    }, 100);

    // 5 saniye sonra timeout
    setTimeout(() => clearInterval(waitForNavigation), 5000);
  }

  /**
   * Navigation container'ına butonları ekle
   */
  addButtonsToNavigation(navContainer) {
    // Toggle butonu - duruma göre collapse veya expand yapar
    const toggleBtn = this.createNavButton('📦', 'Tümünü Daralt (Alt+←)', () => {
      this.toggleAllMessages();
    });
    toggleBtn.id = 'claude-compact-toggle-all';

    // Navigation container'ına ekle (navigation butonlarının altına)
    navContainer.appendChild(toggleBtn);

    this.elements = this.elements || {};
    this.elements.toggleBtn = toggleBtn;
    this.isAllCollapsed = false; // Track state

    this.log('📦 Collapse/Expand All butonu oluşturuldu');
  }

  /**
   * Tüm mesajları toggle et
   */
  toggleAllMessages() {
    if (this.isAllCollapsed) {
      // Expand all
      const count = this.expandAllMessages();
      this.isAllCollapsed = false;
      this.updateToggleButton();
      this.log(`📂 ${count} mesaj genişletildi`);
    } else {
      // Collapse all
      const count = this.collapseAllMessages();
      this.isAllCollapsed = true;
      this.updateToggleButton();
      this.log(`📦 ${count} mesaj daraltıldı`);
    }
  }

  /**
   * Toggle butonunu güncelle
   */
  updateToggleButton() {
    if (this.elements && this.elements.toggleBtn) {
      if (this.isAllCollapsed) {
        this.elements.toggleBtn.innerHTML = '📂';
        this.elements.toggleBtn.title = 'Tümünü Genişlet (Alt+→)';
      } else {
        this.elements.toggleBtn.innerHTML = '📦';
        this.elements.toggleBtn.title = 'Tümünü Daralt (Alt+←)';
      }
    }
  }

  /**
   * Navigation stili buton oluştur
   */
  createNavButton(icon, tooltip, onClick) {
    const theme = this.getTheme();
    const button = document.createElement('button');

    button.innerHTML = icon;
    button.title = tooltip;

    if (theme.useNativeClasses) {
      button.className = theme.buttonClasses || '';
    } else {
      Object.assign(button.style, {
        width: '48px',
        height: '48px',
        borderRadius: '50%',
        background: theme.primary || '#CC785C',
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '20px',
        color: 'white',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        transition: 'all 0.3s ease'
      });

      button.addEventListener('mouseenter', () => {
        button.style.transform = 'scale(1.05)';
      });

      button.addEventListener('mouseleave', () => {
        button.style.transform = 'scale(1)';
      });
    }

    button.addEventListener('click', onClick);
    return button;
  }

  /**
   * Mesajları işle
   */
  processMessages() {
    // Check if we're on a conversation page
    if (!this.dom.isOnConversationPage()) {
      // Don't log repeatedly to avoid console spam
      if (!this.lastNonConversationLog || Date.now() - this.lastNonConversationLog > 5000) {
        this.log('Not on conversation page, hiding collapse buttons');
        this.lastNonConversationLog = Date.now();
      }

      // Hide buttons instead of removing to avoid DOM mutations that trigger observers
      document.querySelectorAll('.claude-expand-button-container').forEach(btn => {
        btn.style.visibility = 'hidden';
        btn.style.opacity = '0';
        btn.style.pointerEvents = 'none';
      });
      return;
    }

    // Reset non-conversation log timer
    this.lastNonConversationLog = null;

    // Show any hidden buttons
    document.querySelectorAll('.claude-expand-button-container').forEach(btn => {
      btn.style.visibility = 'visible';
      btn.style.opacity = '1';
      btn.style.pointerEvents = 'auto';
    });

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
  async processMessage(messageElement) {
    // Collapse edilmeli mi?
    if (!this.collapse.shouldCollapse(messageElement)) {
      return;
    }

    // NOT: Auto-collapse removed - users should manually collapse using buttons
    // Line 219 removed: if (await this.getSetting('autoCollapse'))

    // Expand butonu ekle
    const isCollapsed = this.collapse.isCollapsed(messageElement);
    const button = this.expandButton.create(messageElement, isCollapsed);
    this.expandButton.insertNextToEditButton(messageElement, button);
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
    // Check if we're on a conversation page
    if (!this.dom.isOnConversationPage()) {
      this.log('Not on conversation page, skipping collapse all');
      return 0;
    }

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
    // Check if we're on a conversation page
    if (!this.dom.isOnConversationPage()) {
      this.log('Not on conversation page, skipping expand all');
      return 0;
    }

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
   * Reinitialize UI on SPA navigation
   */
  async reinitializeUI() {
    this.log('🔄 Reinitializing CompactView for new page...');

    // Clear processed messages cache
    this.processedMessages = new WeakSet();
    this.collapse.clear();

    // Remove old buttons
    document.querySelectorAll('.claude-expand-button-container').forEach(btn => {
      btn.remove();
    });

    // Process new messages
    this.processMessages();

    // Auto collapse if enabled
    const autoCollapseEnabled = await this.getSetting('autoCollapseEnabled');
    if (autoCollapseEnabled) {
      setTimeout(() => {
        const count = this.collapseAllMessages();
        this.log(`🔄 Auto collapse - ${count} mesaj daraltıldı`);
      }, 500);
    }

    this.log('✅ CompactView reinitialized');
  }

  /**
   * Modülü durdur
   */
  destroy() {
    this.log('🛑 Compact View durduruluyor...');

    // Destroy message observer
    this.destroyMessageObserver();

    this.collapse.clear();

    // Collapse/Expand All butonunu kaldır
    if (this.elements && this.elements.toggleBtn) {
      this.elements.toggleBtn.remove();
    }

    // Tüm expand butonlarını kaldır
    document.querySelectorAll('.claude-expand-button-container').forEach(btn => {
      btn.remove();
    });

    super.destroy();
  }
}

// Event constants
Events.MESSAGE_COLLAPSED = 'compactView:message_collapsed';

export default CompactViewModule;
