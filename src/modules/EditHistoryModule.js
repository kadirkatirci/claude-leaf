/**
 * EditHistoryModule - Edit yapılmış promptları gösterir
 * BaseModule'den türetilir
 */
import BaseModule from './BaseModule.js';
import { Events } from '../utils/EventBus.js';
import DOMUtils from '../utils/DOMUtils.js';
import FixedButtonMixin from '../core/FixedButtonMixin.js';

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

    // Enhance with FixedButtonMixin
    FixedButtonMixin.enhance(this);

    // Create fixed button
    this.createFixedButton({
      id: 'claude-edit-fixed-btn',
      icon: '✏️',
      tooltip: 'Edit History',
      position: { right: '30px', transform: 'translateY(-100px)' },
      onClick: () => this.panel.toggle(),
      showCounter: true
    });

    // Setup visibility listener (from mixin)
    this.setupVisibilityListener();

    this.panel.create();

    // Taramayı başlat
    this.scanner.start();

    // Listen to MESSAGES_UPDATED event from NavigationModule to trigger immediate scan
    this.subscribe(Events.MESSAGES_UPDATED, () => {
      this.log('🔄 Messages updated, scanning for edits...');
      this.scanner.scan();
    });

    // Create collapse button (only if CompactView is enabled)
    const compactViewEnabled = this.settings && this.settings.compactView && this.settings.compactView.enabled;
    if (compactViewEnabled) {
      this.createCollapseButton(this.getTheme());
    }

    this.log('✅ Edit History aktif');
  }

  /**
   * Clear UI elements on page change (required for FixedButtonMixin)
   */
  clearUIElements() {
    this.log('Clearing edit history UI elements');

    // Clear badges
    if (this.badge && typeof this.badge.removeAll === 'function') {
      this.badge.removeAll();
    }

    // Clear highlights
    if (this.ui && typeof this.ui.updateHighlights === 'function') {
      this.ui.updateHighlights([], false);
    }

    // Clear state
    this.editedMessages = [];

    // Clear panel and collapse button visibility
    this.panel.updateContent([]);
    if (this.elements.collapseBtn) {
      this.elements.collapseBtn.style.display = 'none';
    }
  }

  /**
   * Update UI when on conversation page (called by mixin)
   */
  updateUI() {
    this.log('Updating edit history UI');
    // Re-scan on conversation page
    this.scanner.scan();
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

    // Update counter using mixin method
    this.updateButtonCounter(this.editedMessages.length);

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

    // Destroy fixed button (includes visibility listener cleanup)
    this.destroyFixedButton();

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
