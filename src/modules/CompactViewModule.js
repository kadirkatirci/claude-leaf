/**
 * CompactViewModule - Claude yanıtlarını collapse/expand et
 * BaseModule'den türetilir
 */
import BaseModule from './BaseModule.js';
import { Events } from '../utils/EventBus.js';
import IconLibrary from '../components/primitives/IconLibrary.js';
import VisibilityManager from '../utils/VisibilityManager.js';
import { MODULE_CONSTANTS } from '../config/ModuleConstants.js';
import { panelManager } from '../components/PanelManager.js'; // Shared panel

const COMPACT_CONFIG = MODULE_CONSTANTS.compactView;

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
      msg => this.collapse.toggleMessage(msg)
    );

    this.processedMessages = new WeakSet();
    this.observer = null;

    // Track intervals and timeouts for cleanup
    this.intervals = [];
    this.timeouts = [];
  }

  async init() {
    await super.init();
    if (!this.enabled) {
      return;
    }

    try {
      this.log('Compact View başlatılıyor...');

      // Setup visibility listener for proper show/hide behavior
      this.setupVisibilityListener();

      // Create collapse/expand all buttons in navigation container
      try {
        this.createCollapseButtons();
      } catch (error) {
        this.error('Failed to create collapse buttons:', error);
      }

      // Mevcut mesajları işle
      try {
        this.processMessages();
      } catch (error) {
        this.error('Failed to process messages:', error);
      }

      // Subscribe to MessageHub for content changes
      this.subscribe(Events.HUB_CONTENT_CHANGED, () => {
        try {
          this.processMessages();
        } catch (error) {
          this.error('Error in content change handler:', error);
        }
      });

      // Klavye kısayolu
      try {
        if (COMPACT_CONFIG.keyboardShortcuts) {
          this.setupKeyboardShortcuts();
        }
      } catch (error) {
        this.error('Failed to setup keyboard shortcuts:', error);
      }

      this.log('✅ Compact View aktif');
    } catch (error) {
      this.error('Compact View initialization failed:', error);
      throw error; // Re-throw for App.js to track
    }
  }

  /**
   * Setup visibility listener
   */
  setupVisibilityListener() {
    // Use VisibilityManager for consistent visibility handling
    this.unsubscribers.push(
      VisibilityManager.onVisibilityChange(isConversationPage => {
        this.log(
          `📦 Visibility changed: ${isConversationPage ? 'SHOW' : 'HIDE'} (conversation: ${isConversationPage})`
        );

        // Update button visibility using the same approach as other modules
        if (this.elements && this.elements.toggleBtn) {
          VisibilityManager.setElementVisibility(this.elements.toggleBtn, isConversationPage);
        }

        // Also update all expand button containers
        const expandButtons = document.querySelectorAll('.claude-expand-button-container');
        expandButtons.forEach(btn => {
          VisibilityManager.setElementVisibility(btn, isConversationPage);
        });
      })
    );
  }

  /**
   * Collapse/Expand All butonlarını oluştur
   */
  /**
   * Collapse/Expand All butonlarını oluştur
   */
  createCollapseButtons() {
    // Use PanelManager to add toggle button
    // No waiting/polling needed as PanelManager is always available

    // Toggle butonu - duruma göre collapse veya expand yapar
    const toggleBtn = this.createNavButton(
      IconLibrary.collapse('currentColor', 20),
      'Tümünü Daralt (Alt+←)',
      () => {
        this.toggleAllMessages();
      }
    );
    toggleBtn.id = 'claude-compact-toggle-all';

    // Add to shared panel (Order 40 = below nav buttons)
    panelManager.addButton(toggleBtn, 40);

    this.elements = this.elements || {};
    this.elements.toggleBtn = toggleBtn;
    this.isAllCollapsed = false; // Track state

    this.log('📦 Collapse/Expand All butonu oluşturuldu (PanelManager via)');
  }

  /**
   * Navigation container'ına butonları ekle
   */
  addButtonsToNavigation(navContainer) {
    // Toggle butonu - duruma göre collapse veya expand yapar
    const toggleBtn = this.createNavButton(
      IconLibrary.collapse('currentColor', 20),
      'Tümünü Daralt (Alt+←)',
      () => {
        this.toggleAllMessages();
      }
    );
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
        this.elements.toggleBtn.innerHTML = IconLibrary.expand('currentColor', 20);
        this.elements.toggleBtn.title = 'Tümünü Genişlet (Alt+→)';
      } else {
        this.elements.toggleBtn.innerHTML = IconLibrary.collapse('currentColor', 20);
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

    button.innerHTML = icon; // Use innerHTML to support SVG strings
    button.title = tooltip;

    // Use Claude's native button classes (size-9 = 36px from buttonClasses)
    button.className = theme.buttonClasses || '';

    // Only set positioning (sizing handled by classes)
    // Removed color: 'white' to allow currentColor in SVGs to adapt to theme
    Object.assign(button.style, {
      position: 'relative',
    });

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
      if (this.processedMessages.has(message)) {
        return;
      }

      // User mesajlarını atla, sadece Claude yanıtları
      if (message.querySelector('[data-testid="user-message"]')) {
        return;
      }

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
      button.innerHTML = isCollapsed
        ? IconLibrary.expand('currentColor', 12)
        : IconLibrary.collapse('currentColor', 16);
      button.title = isCollapsed ? 'Expand message' : 'Collapse message';
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
      if (message.querySelector('[data-testid="user-message"]')) {
        return;
      }

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
      if (message.querySelector('[data-testid="user-message"]')) {
        return;
      }

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
    const handleKeydown = e => {
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
    if (
      compactViewSettings.autoCollapseEnabled !== undefined &&
      compactViewSettings.autoCollapseEnabled
    ) {
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

    // Auto-collapse is handled by MessageCollapse component
    setTimeout(() => {
      const count = this.collapseAllMessages();
      this.log(`🔄 Auto collapse - ${count} mesaj daraltıldı`);
    }, 500);

    this.log('✅ CompactView reinitialized');
  }

  /**
   * Modülü durdur
   */
  destroy() {
    this.log('🛑 Compact View durduruluyor...');

    try {
      // Clean up all intervals
      try {
        this.intervals.forEach(intervalId => {
          clearInterval(intervalId);
        });
        this.intervals = [];
      } catch (error) {
        this.error('Error clearing intervals:', error);
      }

      // Clean up all timeouts
      try {
        this.timeouts.forEach(timeoutId => {
          clearTimeout(timeoutId);
        });
        this.timeouts = [];
      } catch (error) {
        this.error('Error clearing timeouts:', error);
      }

      // Note: MessageHub subscriptions are automatically cleaned up by BaseModule.destroy()

      // Collapse state cleanup
      try {
        this.collapse.clear();
      } catch (error) {
        this.error('Error clearing collapse state:', error);
      }

      // Collapse/Expand All butonunu kaldır
      try {
        if (this.elements && this.elements.toggleBtn) {
          panelManager.removeButton(this.elements.toggleBtn.id);
          this.elements.toggleBtn = null;
        }
      } catch (error) {
        this.error('Error removing toggle button:', error);
      }

      // Tüm expand butonlarını kaldır
      try {
        document.querySelectorAll('.claude-expand-button-container').forEach(btn => {
          btn.remove();
        });
      } catch (error) {
        this.error('Error removing expand buttons:', error);
      }

      super.destroy();
    } catch (error) {
      this.error('Error in destroy method:', error);
    }
  }
}

// Event constants
Events.MESSAGE_COLLAPSED = 'compactView:message_collapsed';

export default CompactViewModule;
