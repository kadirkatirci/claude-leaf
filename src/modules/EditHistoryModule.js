/**
 * EditHistoryModule - Edit yapılmış promptları gösterir
 * BaseModule'den türetilir
 */
import BaseModule from './BaseModule.js';
import { Events } from '../utils/EventBus.js';
import DOMUtils from '../utils/DOMUtils.js';
import VisibilityManager from '../utils/VisibilityManager.js';

// Alt bileşenler
import EditScanner from './EditHistoryModule/EditScanner.js';
import EditBadge from './EditHistoryModule/EditBadge.js';
import EditPanel from './EditHistoryModule/EditPanel.js';
import EditModal from './EditHistoryModule/EditModal.js';
import EditUI from './EditHistoryModule/EditUI.js';

class EditHistoryModule extends BaseModule {
  constructor() {
    super('editHistory');

    this.editedMessages = [];
    this.visibilityUnsubscribe = null;
    this.lastConversationState = null;
    
    // Alt bileşenler
    this.scanner = new EditScanner((edits) => this.handleEditsFound(edits));
    this.badge = new EditBadge(() => this.getTheme(), (el, ver) => this.modal.show(el, ver));
    this.panel = new EditPanel(() => this.getTheme(), (idx) => this.scrollToEdit(idx));
    this.modal = new EditModal();
    this.ui = new EditUI(
      () => this.getTheme(),
      () => this.panel.toggle(),
      (shouldCollapse) => this.handleCollapseAll(shouldCollapse)
    );
  }

  async init() {
    await super.init();
    if (!this.enabled) return;

    this.log('Edit History başlatılıyor...');

    // Create fixed position buttons (like NavigationModule)
    this.createFixedButtons();

    this.panel.create();

    // Subscribe to visibility changes
    this.visibilityUnsubscribe = VisibilityManager.onVisibilityChange((isConversationPage) => {
      this.handleVisibilityChange(isConversationPage);
    });

    // Taramayı başlat
    this.scanner.start();

    // Listen to MESSAGES_UPDATED event from NavigationModule to trigger immediate scan
    this.subscribe(Events.MESSAGES_UPDATED, () => {
      this.log('🔄 Messages updated, scanning for edits...');
      this.scanner.scan();
    });

    this.log('✅ Edit History aktif');
  }

  /**
   * Handle visibility change from VisibilityManager
   */
  handleVisibilityChange(isConversationPage) {
    // Only update if state actually changed
    if (this.lastConversationState === isConversationPage) return;

    this.lastConversationState = isConversationPage;

    // Fixed button is stored as editBtn, not button
    if (this.elements.editBtn) {
      VisibilityManager.setElementVisibility(this.elements.editBtn, isConversationPage);
    }
    if (this.elements.collapseBtn) {
      VisibilityManager.setElementVisibility(this.elements.collapseBtn, isConversationPage);
    }

    if (!isConversationPage) {
      this.log('Page changed to non-conversation, hiding edit history UI');
      // Clear UI elements with defensive checks
      if (this.badge && typeof this.badge.removeAll === 'function') {
        this.badge.removeAll();
      }
      if (this.ui && typeof this.ui.updateHighlights === 'function') {
        this.ui.updateHighlights([], false);
      }
      this.editedMessages = [];
      if (this.elements.counter) {
        this.elements.counter.textContent = '0';
      }
      this.panel.updateContent([]);
    } else {
      this.log('Page changed to conversation, showing edit history UI');
      // Re-scan on conversation page
      this.scanner.scan();
    }
  }

  /**
   * Create fixed position buttons (same pattern as NavigationModule)
   */
  createFixedButtons() {
    const theme = this.getTheme();

    // Edit History button - use neutral background for native theme
    const buttonBg = theme.useNativeClasses
      ? 'var(--claude-productivity-neutral)'
      : (theme.primary || theme.accentColor || '#CC785C');

    const editBtn = this.dom.createElement('button', {
      id: 'claude-edit-fixed-btn',
      innerHTML: '✏️',
      style: {
        position: 'fixed',
        right: '30px',
        top: '50%',
        transform: 'translateY(-100px)', // Above center
        width: '48px',
        height: '48px',
        borderRadius: '50%',
        background: buttonBg,
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        transition: 'all 0.2s ease',
        color: 'white',
        fontSize: '20px',
        zIndex: '9998',
        opacity: this.getSetting('opacity') || 0.7,
      }
    });

    // Counter badge - use accent color (turuncu) for native theme
    const counterBg = theme.useNativeClasses
      ? (theme.accentColor || 'var(--claude-productivity-accent)')
      : '#ff4757';

    const counter = this.dom.createElement('div', {
      id: 'claude-edit-counter',
      textContent: '0',
      style: {
        position: 'absolute',
        top: '-8px',
        right: '-8px',
        background: counterBg,
        color: 'white',
        borderRadius: '12px',
        padding: '2px 6px',
        fontSize: '10px',
        fontWeight: 'bold',
        minWidth: '20px',
        textAlign: 'center',
      }
    });

    editBtn.appendChild(counter);

    // Click handler
    editBtn.addEventListener('click', () => {
      this.panel.toggle();
    });

    // Hover effects
    editBtn.addEventListener('mouseenter', () => {
      editBtn.style.transform = 'translateY(-100px) scale(1.1)';
      editBtn.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.25)';
      editBtn.style.opacity = '1';
    });

    editBtn.addEventListener('mouseleave', () => {
      editBtn.style.transform = 'translateY(-100px) scale(1)';
      editBtn.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
      editBtn.style.opacity = this.getSetting('opacity') || 0.7;
    });

    document.body.appendChild(editBtn);
    this.elements.editBtn = editBtn;
    this.elements.counter = counter;

    // Set initial visibility based on current page
    const isConversationPage = this.dom.isOnConversationPage();
    if (!isConversationPage) {
      VisibilityManager.setElementVisibility(editBtn, false);
    }

    // Collapse All button (only if CompactView is enabled)
    const compactViewEnabled = this.settings && this.settings.compactView && this.settings.compactView.enabled;
    if (compactViewEnabled) {
      this.createCollapseButton(theme);
    }
  }

  /**
   * Create Collapse/Expand All button in navigation container
   */
  createCollapseButton(theme) {
    this.isAllCollapsed = false;

    // Find navigation container
    const navContainer = document.querySelector('#claude-nav-buttons');
    if (!navContainer) {
      this.warn('Navigation container not found, collapse button will not be created');
      return;
    }

    // Use same background as navigation buttons (neutral for native theme)
    const collapseBg = theme.useNativeClasses
      ? 'var(--claude-productivity-neutral)'
      : (theme.primary || theme.accentColor || '#CC785C');

    const collapseBtn = this.dom.createElement('button', {
      id: 'claude-collapse-btn',
      className: 'claude-nav-btn', // Same class as navigation buttons
      innerHTML: '📦',
      'data-tooltip': 'Collapse/Expand All (Edited Messages)',
      style: {
        width: '48px',
        height: '48px',
        borderRadius: '50%',
        background: collapseBg,
        border: 'none',
        cursor: 'pointer',
        display: this.editedMessages.length > 0 ? 'flex' : 'none', // Hide if no edits
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        transition: 'transform 0.1s ease',
        color: 'white',
        fontSize: '20px',
        position: 'relative',
      }
    });

    // Click handler
    collapseBtn.addEventListener('click', () => {
      this.isAllCollapsed = !this.isAllCollapsed;
      collapseBtn.innerHTML = this.isAllCollapsed ? '📂' : '📦';
      collapseBtn.setAttribute('data-tooltip', this.isAllCollapsed ? 'Expand All' : 'Collapse All (Edited Messages)');
      this.handleCollapseAll(this.isAllCollapsed);
    });

    // Hover effects (same as navigation buttons)
    collapseBtn.addEventListener('mousedown', () => {
      collapseBtn.style.transform = 'scale(0.95)';
    });

    collapseBtn.addEventListener('mouseup', () => {
      collapseBtn.style.transform = 'scale(1.1)';
    });

    // Append to navigation container (below down button)
    navContainer.appendChild(collapseBtn);
    this.elements.collapseBtn = collapseBtn;

    this.log('✅ Collapse button added to navigation container');
  }

  /**
   * Edit'ler bulunduğunda
   */
  handleEditsFound(editedPrompts) {
    // Don't process if not on conversation page
    if (!this.lastConversationState) return;

    const oldCount = this.editedMessages.length;

    // Değişiklikleri logla
    const currentIds = new Set(editedPrompts.map(e => e.containerId));
    const previousIds = new Set(this.editedMessages.map(e => e.containerId));

    const newEdits = editedPrompts.filter(e => !previousIds.has(e.containerId));
    const removed = this.editedMessages.filter(e => !currentIds.has(e.containerId));

    if (newEdits.length > 0) {
      this.log(`➕ ${newEdits.length} yeni edit`);
    }

    if (removed.length > 0) {
      this.log(`➖ ${removed.length} edit kaldırıldı`);
    }

    // UI güncelle
    this.badge.updateAll(editedPrompts, this.getSetting('showBadges'));
    this.ui.updateHighlights(editedPrompts, this.getSetting('highlightEdited'));

    // State güncelle
    this.editedMessages = editedPrompts.map((editInfo, index) => ({
      element: editInfo.element,
      index,
      versionInfo: editInfo.versionInfo,
      currentVersion: editInfo.currentVersion,
      totalVersions: editInfo.totalVersions,
      containerId: editInfo.containerId,
    }));

    // Update counter
    if (this.elements.counter) {
      this.elements.counter.textContent = this.editedMessages.length.toString();
    }

    // Show/hide collapse button based on edit count
    if (this.elements.collapseBtn) {
      this.elements.collapseBtn.style.display = this.editedMessages.length > 0 ? 'flex' : 'none';
    }

    // Panel güncelle
    this.panel.updateContent(this.editedMessages);

    // Event
    if (this.editedMessages.length !== oldCount) {
      this.log(`🔄 Toplam edit: ${oldCount} → ${this.editedMessages.length}`);
      this.emit(Events.EDIT_MESSAGES_FOUND, this.editedMessages);
    }
  }

  /**
   * Belirli bir edit'e scroll yap
   */
  scrollToEdit(index) {
    if (index < 0 || index >= this.editedMessages.length) return;

    const editMsg = this.editedMessages[index];
    this.log(`🎯 Edit ${index + 1}'e scroll`);

    DOMUtils.scrollToElement(editMsg.element, 'center');
    DOMUtils.flashClass(editMsg.element, 'claude-nav-highlight', 2000);
  }

  /**
   * Tümünü Daralt/Genişlet işlemi
   */
  handleCollapseAll(shouldCollapse) {
    // CompactViewModule'ü bul
    const app = window.claudeProductivity;
    if (!app) return;

    const compactViewModule = app.getModule('compactView');
    if (!compactViewModule || !compactViewModule.enabled) {
      this.warn('CompactView modülü aktif değil');
      return;
    }

    if (shouldCollapse) {
      compactViewModule.collapseAllMessages();
      this.log('📦 Tüm mesajlar daraltıldı');
    } else {
      compactViewModule.expandAllMessages();
      this.log('📂 Tüm mesajlar genişletildi');
    }
  }

  /**
   * Settings değiştiğinde
   */
  onSettingsChanged() {
    this.log('⚙️ Settings değişti');

    // Tema değiştiyse UI yenile
    if (this.settings && this.settings.general) {
      this.recreateUI();
    }

    // Yeniden tara
    this.scanner.scan();
  }

  /**
   * UI'ı yeniden oluştur (tema değişikliğinde)
   */
  recreateUI() {
    const theme = this.getTheme();

    // Remove old collapse button
    if (this.elements.collapseBtn) {
      this.elements.collapseBtn.remove();
      this.elements.collapseBtn = null;
    }

    // Recreate collapse button if CompactView is enabled
    const compactViewEnabled = this.settings && this.settings.compactView && this.settings.compactView.enabled;
    if (compactViewEnabled) {
      this.createCollapseButton(theme);
    }

    // Panel yeniden oluştur
    this.panel.remove();
    this.panel.create();

    // Badge'leri yeniden oluştur
    this.badge.removeAll();
    this.badge.updateAll(DOMUtils.getEditedPrompts(), this.getSetting('showBadges'));

    // Panel içeriği güncelle
    this.panel.updateContent(this.editedMessages);

    this.log('🎨 UI tema ile yenilendi');
  }


  /**
   * Modülü durdur
   */
  destroy() {
    this.log('🛑 Edit History durduruluyor...');

    // Unsubscribe from visibility changes
    if (this.visibilityUnsubscribe) {
      this.visibilityUnsubscribe();
      this.visibilityUnsubscribe = null;
    }

    // Remove collapse button
    if (this.elements.collapseBtn) {
      this.elements.collapseBtn.remove();
      this.elements.collapseBtn = null;
    }

    // Alt bileşenleri temizle
    this.scanner.stop();
    this.badge.removeAll();
    this.panel.remove();
    this.modal.close();

    // Highlight'ları kaldır
    document.querySelectorAll('.claude-edit-highlighted').forEach(el => {
      el.classList.remove('claude-edit-highlighted');
    });

    super.destroy();
  }
}

// Event constants
Events.EDIT_MESSAGES_FOUND = 'edit:messages_found';
Events.EDIT_MODAL_OPENED = 'edit:modal_opened';
Events.EDIT_MODAL_CLOSED = 'edit:modal_closed';

export default EditHistoryModule;
