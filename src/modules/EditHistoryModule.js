/**
 * EditHistoryModule - Edit yapılmış promptları gösterir
 * BaseModule'den türetilir
 */
import BaseModule from './BaseModule.js';
import { Events } from '../utils/EventBus.js';
import DOMUtils from '../utils/DOMUtils.js';

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

    // UI oluştur
    setTimeout(() => this.ui.createHeaderButton(), 500);
    this.panel.create();

    // Taramayı başlat
    this.scanner.start();

    this.log('✅ Edit History aktif');
  }

  /**
   * Edit'ler bulunduğunda
   */
  handleEditsFound(editedPrompts) {
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

    // Header ve panel güncelle
    this.ui.updateHeaderButton(this.editedMessages.length);
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
  onSettingsChanged(settings) {
    this.log('⚙️ Settings değişti');
    
    // Tema değiştiyse UI yenile
    if (this.settings && this.settings.general) {
      this.recreateUI();
    }
    
    // Yeniden tara
    this.scanner.scan();
    
    // CompactView aktif mi?
    const compactViewEnabled = this.settings && this.settings.compactView && this.settings.compactView.enabled;
    if (compactViewEnabled && this.editedMessages.length > 0) {
      this.ui.showCollapseAllButton(true);
    } else {
      this.ui.showCollapseAllButton(false);
      this.ui.resetCollapseAllButton();
    }
  }

  /**
   * UI'ı yeniden oluştur (tema değişikliğinde)
   */
  recreateUI() {
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

    // Alt bileşenleri temizle
    this.scanner.stop();
    this.badge.removeAll();
    this.panel.remove();
    this.modal.close();
    this.ui.removeHeaderButton();

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
