/**
 * EditHistoryModule - Mesaj düzenleme geçmişini takip eder
 * BaseModule'den türetilir
 */
import BaseModule from './BaseModule.js';
import { Events } from '../utils/EventBus.js';
import FixedButtonMixin from '../core/FixedButtonMixin.js';
import MessageObserverMixin from '../core/MessageObserverMixin.js';
import DOMUtils from '../utils/DOMUtils.js';
import IconLibrary from '../components/primitives/IconLibrary.js';
import EditBadge from './EditHistoryModule/EditBadge.js';
import EditUI from './EditHistoryModule/EditUI.js';
import EditPanel from './EditHistoryModule/EditPanel.js';
import EditModal from './EditHistoryModule/EditModal.js';
import BranchMapModal from './EditHistoryModule/BranchMapModal.js';
import { editHistoryStore } from '../stores/index.js';
import { MODULE_CONSTANTS } from '../config/ModuleConstants.js';
// New imports
import { versionManager } from '../core/VersionManager.js';
import { historyCaptureService } from './EditHistoryModule/HistoryCaptureService.js';
import { panelManager } from '../components/PanelManager.js';

const EDIT_CONFIG = MODULE_CONSTANTS.editHistory;

class EditHistoryModule extends BaseModule {
  constructor() {
    super('editHistory');

    this.editedMessages = [];

    // Components
    // No more EditScanner here
    this.badge = new EditBadge(() => this.getTheme(), (el, data) => {
      // data is now the editInfo object
      this.modal.show(el, data?.versionInfo, data?.containerId);
    });
    this.panel = new EditPanel(() => this.getTheme(), (idx) => this.scrollToEdit(idx));
    this.modal = new EditModal();
    this.branchMapModal = new BranchMapModal();
    this.ui = new EditUI(
      () => this.getTheme(),
      () => this.panel.toggle(),
      (shouldCollapse) => this.handleCollapseAll(shouldCollapse)
    );

    // Listen for Branch Map open event
    document.addEventListener('claude:open_branch_map', (e) => {
      this.branchMapModal.show(e.detail.conversationUrl);
    });

    this.versionChangeUnsubscribe = null;
  }

  async init() {
    await super.init();
    if (!this.enabled) return;

    try {
      this.log('Edit History başlatılıyor...');

      // Enhance with FixedButtonMixin
      FixedButtonMixin.enhance(this);

      // Create fixed button
      await this.createFixedButton({
        id: 'claude-edit-fixed-btn',
        icon: IconLibrary.edit('currentColor', 20),
        tooltip: 'Edit History',
        position: { right: '30px', transform: 'translateY(-100px)' },
        onClick: () => this.panel.toggle(),
        showCounter: true
      });

      this.setupVisibilityListener();
      this.panel.create();

      // Register for version changes via Manager
      this.versionChangeUnsubscribe = versionManager.onVersionChange((data) => {
        this.handleVersionChange(data);
      });

      // Initial manual check (ask VersionManager to scan or just scan ourselves?)
      // VersionManager is already running

      // Wait a bit for initial scan to complete if just started, or trigger manual scan
      setTimeout(() => {
        versionManager.scan();
      }, 500);

      // Create collapse button (only if CompactView is enabled)
      const compactViewEnabled = this.settings && this.settings.compactView && this.settings.compactView.enabled;
      if (compactViewEnabled) {
        this.createCollapseButton(this.getTheme());
      }

      // Update panel if data exists
      if (this.editedMessages.length > 0) {
        this.panel.updateContent(this.editedMessages);
      }

      this.log('✅ Edit History aktif (VersionManager integrated)');
    } catch (error) {
      this.error('Edit History initialization failed:', error);
      throw error;
    }
  }

  /**
   * Handle version change from manager
   */
  async handleVersionChange(data) {
    const edits = data.edits || [];

    // 1. Update UI
    this.handleEditsFound(edits);

    // 2. Capture History (using new service)
    await historyCaptureService.captureHistory(edits);
  }

  /**
   * Clear UI elements (mixin requirement)
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
    // Request scan from manager
    versionManager.scan();
  }

  /**
   * Wait for messages and update UI with retry mechanism
   */
  async waitAndUpdateUI() {
    const maxRetries = 5;
    const baseDelay = 200;
    let retryCount = 0;

    const checkForEdits = async () => {
      // Trigger a scan
      this.scanner.scan();

      // Check if we found any edits
      if (this.editedMessages.length > 0 || retryCount >= maxRetries) {
        if (this.editedMessages.length > 0) {
          this.log(`✅ Found ${this.editedMessages.length} edited messages after ${retryCount} retries`);
        } else {
          this.log(`⚠️ No edited messages found after ${retryCount} retries`);
        }
        return;
      }

      // Retry with exponential backoff
      retryCount++;
      const delay = Math.min(baseDelay * Math.pow(1.5, retryCount), 1000);
      this.log(`🔄 Edit scan retry ${retryCount}/${maxRetries}: Waiting ${delay}ms...`);

      await new Promise(resolve => setTimeout(resolve, delay));
      return checkForEdits();
    };

    // Start checking
    await checkForEdits();
  }


  /**
   * Create Collapse/Expand All button in navigation container
   */
  createCollapseButton(theme) {
    this.isAllCollapsed = false;

    // Use PanelManager
    // Use native class background (neutral background)
    const collapseBg = 'var(--claude-productivity-neutral)';

    const collapseBtn = this.dom.createElement('button', {
      id: 'claude-collapse-btn',
      className: 'claude-nav-btn', // Same class as navigation buttons (size-9 from theme)
      innerHTML: IconLibrary.collapse('currentColor', 20),
      'data-tooltip': 'Collapse/Expand All (Edited Messages)',
      style: {
        background: collapseBg,
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
      collapseBtn.innerHTML = this.isAllCollapsed ? IconLibrary.expand('currentColor', 20) : IconLibrary.collapse('currentColor', 20);
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

    // Add to shared panel (Order 50 = bottom)
    panelManager.addButton(collapseBtn, 50);
    this.elements.collapseBtn = collapseBtn;

    this.log('✅ Collapse button added to panel');
  }

  /**
   * Edit'ler bulunduğunda
   */
  async handleEditsFound(editedPrompts) {
    // Don't process if explicitly NOT on conversation page
    // During initialization (lastConversationState === null), allow processing
    const isConversationPage = this.lastConversationState !== null
      ? this.lastConversationState
      : true; // Allow during initialization

    if (!isConversationPage) {
      this.log('Not on conversation page, skipping edit processing');
      return;
    }

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
    this.badge.updateAll(editedPrompts, EDIT_CONFIG.showBadges);
    this.ui.updateHighlights(editedPrompts, EDIT_CONFIG.highlightEdited);

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
    versionManager.scan();
  }

  /**
   * UI'ı yeniden oluştur (tema değişikliğinde)
   */
  async recreateUI() {
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
    this.badge.updateAll(DOMUtils.getEditedPrompts(), EDIT_CONFIG.showBadges);

    // Panel içeriği güncelle
    this.panel.updateContent(this.editedMessages);

    this.log('🎨 UI tema ile yenilendi');
  }


  /**
   * Modülü durdur
   */
  destroy() {
    this.log('🛑 Edit History durduruluyor...');

    try {
      // Destroy fixed button (includes visibility listener cleanup)
      try {
        this.destroyFixedButton();
      } catch (error) {
        this.error('Error destroying fixed button:', error);
      }

      // Remove collapse button
      try {
        if (this.elements.collapseBtn) {
          panelManager.removeButton(this.elements.collapseBtn.id);
          this.elements.collapseBtn = null;
        }
      } catch (error) {
        this.error('Error removing collapse button:', error);
      }

      // Alt bileşenleri temizle
      if (this.versionChangeUnsubscribe) {
        this.versionChangeUnsubscribe();
        this.versionChangeUnsubscribe = null;
      }

      try {
        if (this.badge) this.badge.removeAll();
      } catch (error) {
        this.error('Error removing badges:', error);
      }

      try {
        if (this.panel) this.panel.remove();
      } catch (error) {
        this.error('Error removing panel:', error);
      }

      try {
        if (this.modal) this.modal.close();
      } catch (error) {
        this.error('Error closing modal:', error);
      }

      // Highlight'ları kaldır
      try {
        document.querySelectorAll('.claude-edit-highlighted').forEach(el => {
          el.classList.remove('claude-edit-highlighted');
        });
      } catch (error) {
        this.error('Error removing highlights:', error);
      }

      super.destroy();
    } catch (error) {
      this.error('Error in destroy method:', error);
    }
  }
}

// Event constants
Events.EDIT_MESSAGES_FOUND = 'edit:messages_found';
Events.EDIT_MODAL_OPENED = 'edit:modal_opened';
Events.EDIT_MODAL_CLOSED = 'edit:modal_closed';

export default EditHistoryModule;
