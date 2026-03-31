/**
 * EditHistoryModule - Tracks message edit history
 * Extends BaseModule
 */
import BaseModule from './BaseModule.js';
import { Events } from '../utils/EventBus.js';
import FixedButtonMixin from '../core/FixedButtonMixin.js';
import DOMUtils from '../utils/DOMUtils.js';
import Button from '../components/primitives/Button.js';
import IconLibrary from '../components/primitives/IconLibrary.js';
import EditBadge from './EditHistoryModule/EditBadge.js';
import EditUI from './EditHistoryModule/EditUI.js';
import EditPanel from './EditHistoryModule/EditPanel.js';
import EditModal from './EditHistoryModule/EditModal.js';
import BranchMapModal from './EditHistoryModule/BranchMapModal.js';
import { MODULE_CONSTANTS } from '../config/ModuleConstants.js';
import { historyCaptureService } from './EditHistoryModule/HistoryCaptureService.js';
import { editDraftCaptureService } from './EditHistoryModule/EditDraftCaptureService.js';
import { panelManager } from '../components/PanelManager.js';
import { messageHub } from '../core/MessageHub.js';
import { trackEvent, trackPerfScan } from '../analytics/Analytics.js';

const EDIT_CONFIG = MODULE_CONSTANTS.editHistory;

class EditHistoryModule extends BaseModule {
  constructor() {
    super('editHistory');

    this.editedMessages = [];

    // Components
    this.badge = new EditBadge(
      () => this.getTheme(),
      (el, data) => {
        // data is now the editInfo object
        trackEvent('edit_modal_open', {
          module: 'editHistory',
          method: 'badge',
        });
        this.modal.show(el, data?.versionInfo, data?.containerId);
      }
    );

    // Lazy initialization for panels and modals
    this._panel = null;
    this._modal = null;
    this._branchMapModal = null;
    this._ui = null;

    // Listen for Branch Map open event (store handler for cleanup)
    this._branchMapHandler = e => {
      trackEvent('edit_branch_map_open', {
        module: 'editHistory',
        method: 'event',
      });
      this.branchMapModal.show(e.detail.conversationUrl);
    };
    document.addEventListener('claude:open_branch_map', this._branchMapHandler);
  }

  // Lazy getters
  get panel() {
    if (!this._panel) {
      this._panel = new EditPanel(
        () => this.getTheme(),
        idx => this.scrollToEdit(idx)
      );
    }
    return this._panel;
  }

  get modal() {
    if (!this._modal) {
      this._modal = new EditModal();
    }
    return this._modal;
  }

  get branchMapModal() {
    if (!this._branchMapModal) {
      this._branchMapModal = new BranchMapModal();
    }
    return this._branchMapModal;
  }

  get ui() {
    if (!this._ui) {
      this._ui = new EditUI(
        () => this.getTheme(),
        () => this.togglePanel('ui'),
        shouldCollapse => this.handleCollapseAll(shouldCollapse)
      );
    }
    return this._ui;
  }

  async init() {
    const initStart = performance.now();
    await super.init();
    if (!this.enabled) {
      return;
    }

    try {
      this.log('Edit History initializing...');

      // Enhance with FixedButtonMixin
      FixedButtonMixin.enhance(this);

      // Create fixed button
      await this.createFixedButton({
        id: 'claude-edit-fixed-btn',
        icon: IconLibrary.edit('currentColor', 20),
        tooltip: 'Edit History',
        position: { right: '30px', transform: 'translateY(-100px)' },
        onClick: () => this.togglePanel('button'),
        showCounter: true,
      });

      this.setupVisibilityListener();
      this.panel.create();
      editDraftCaptureService.start();

      // Subscribe to MessageHub for version changes
      this.subscribe(Events.HUB_VERSION_CHANGED, data => {
        this.handleVersionChange(data);
      });
      this.subscribe(Events.HUB_EDIT_SESSION_CHANGED, data => {
        this.handleEditSessionChange(data);
      });

      this.syncCollapseButton();
      this.updateUI();

      // Update panel if data exists
      if (this.editedMessages.length > 0) {
        this.panel.updateContent(this.editedMessages);
      }

      this.log('✅ Edit History active (VersionManager integrated)');
      trackEvent('perf_init', {
        module: 'editHistory',
        init_ms: Math.round(performance.now() - initStart),
      });
    } catch (error) {
      this.error('Edit History initialization failed:', error);
      throw error;
    }
  }

  /**
   * Handle version change from MessageHub
   */
  async handleVersionChange(data) {
    const edits = data.editedPrompts || [];

    // 1. Update UI
    const scanStart = performance.now();
    this.handleEditsFound(edits);

    // 2. Resolve pending draft sessions when a version increment is detected
    await editDraftCaptureService.handleVersionChange(edits);

    // 3. Capture History (using new service)
    await historyCaptureService.captureHistory(edits);

    trackPerfScan(
      {
        module: 'editHistory',
        method: 'version_change',
        scan_ms: Math.round(performance.now() - scanStart),
        item_count: edits.length,
        edit_count: edits.length,
      },
      { key: 'editHistory:version_change', minIntervalMs: 5000 }
    );
  }

  handleEditSessionChange(data) {
    if (!data?.session) {
      return;
    }

    if (data.active) {
      editDraftCaptureService.startSession(data.session);
      return;
    }

    editDraftCaptureService.endSession(data.session, data.reason || 'ended');
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

    // Clear counter (critical for page transitions)
    this.updateButtonCounter(0);

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
    const editedPrompts = DOMUtils.getEditedPrompts ? DOMUtils.getEditedPrompts() : [];
    this.handleEditsFound(editedPrompts);
    if (editedPrompts.length > 0) {
      historyCaptureService.captureHistory(editedPrompts);
    }
    // Request scan from MessageHub
    messageHub.refresh();
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
      messageHub.refresh();

      // Check if we found any edits
      if (this.editedMessages.length > 0 || retryCount >= maxRetries) {
        if (this.editedMessages.length > 0) {
          this.log(
            `✅ Found ${this.editedMessages.length} edited messages after ${retryCount} retries`
          );
        } else {
          this.log(`⚠️ No edited messages found after ${retryCount} retries`);
        }
        return;
      }

      // Retry with exponential backoff
      retryCount++;
      const delay = Math.min(baseDelay * Math.pow(1.5, retryCount), 1000);
      this.log(`🔄 Edit scan retry ${retryCount}/${maxRetries}: Waiting ${delay}ms...`);

      await new Promise(resolve => {
        setTimeout(resolve, delay);
      });
      return checkForEdits();
    };

    // Start checking
    await checkForEdits();
  }

  togglePanel(method = 'button') {
    const wasVisible = this.panel.isVisible;
    this.panel.toggle();
    const isVisible = this.panel.isVisible;
    trackEvent('edit_panel_toggle', {
      module: 'editHistory',
      method,
      state: isVisible ? 'open' : 'close',
    });
    if (!wasVisible && isVisible) {
      this.panel.updateContent(this.editedMessages);
    }
  }

  /**
   * Create Collapse/Expand All button in navigation container
   */
  createCollapseButton(_theme) {
    this.isAllCollapsed = false;

    const collapseBg = 'var(--claude-productivity-neutral)';

    const collapseBtn = Button.create({
      id: 'claude-collapse-btn',
      variant: 'fixed',
      icon: IconLibrary.collapse('currentColor', 20),
      title: 'Collapse/Expand All (Edited Messages)',
      style: {
        background: collapseBg,
        transition: 'transform 0.1s ease',
        color: 'white',
        position: 'relative',
      },
    });
    collapseBtn.dataset.tooltip = 'Collapse/Expand All (Edited Messages)';

    // Click handler
    collapseBtn.addEventListener('click', () => {
      this.isAllCollapsed = !this.isAllCollapsed;
      Button.setButtonContent(collapseBtn, {
        icon: this.isAllCollapsed
          ? IconLibrary.expand('currentColor', 20)
          : IconLibrary.collapse('currentColor', 20),
      });
      const nextTooltip = this.isAllCollapsed ? 'Expand All' : 'Collapse All (Edited Messages)';
      collapseBtn.title = nextTooltip;
      collapseBtn.dataset.tooltip = nextTooltip;
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
    panelManager.addButton(collapseBtn, 50, {
      owner: 'editHistory',
      visible: this.shouldShowCollapseButton(),
    });
    this.elements.collapseBtn = collapseBtn;

    this.log('✅ Collapse button added to panel');
  }

  shouldShowFloatingUI(settings = this.settings) {
    return settings?.editHistory?.showFloatingUI !== false;
  }

  isCompactViewModuleAvailable() {
    const app = window.claudeProductivity;
    const compactViewModule = app?.getModule?.('compactView');
    return !!(compactViewModule && compactViewModule.enabled);
  }

  shouldShowCollapseButton(settings = this.settings) {
    return (
      this.isCompactViewModuleAvailable() &&
      this.shouldShowFloatingUI(settings) &&
      this.editedMessages.length > 0
    );
  }

  syncCollapseButton(settings = this.settings) {
    if (!this.isCompactViewModuleAvailable()) {
      if (this.elements.collapseBtn) {
        panelManager.removeButton(this.elements.collapseBtn.id);
        this.elements.collapseBtn = null;
      }
      return;
    }

    if (!this.elements.collapseBtn) {
      this.createCollapseButton(this.getTheme());
      return;
    }

    panelManager.setButtonVisibility(
      this.elements.collapseBtn.id,
      this.shouldShowCollapseButton(settings)
    );
  }

  /**
   * When edits are found
   */
  handleEditsFound(editedPrompts) {
    // Don't process if explicitly NOT on conversation page
    // During initialization (lastConversationState === null), allow processing
    const isConversationPage =
      this.lastConversationState !== null ? this.lastConversationState : true; // Allow during initialization

    if (!isConversationPage) {
      this.log('Not on conversation page, skipping edit processing');
      return;
    }

    const oldCount = this.editedMessages.length;

    // Log changes
    const currentIds = new Set(editedPrompts.map(e => e.containerId));
    const previousIds = new Set(this.editedMessages.map(e => e.containerId));

    const newEdits = editedPrompts.filter(e => !previousIds.has(e.containerId));
    const removed = this.editedMessages.filter(e => !currentIds.has(e.containerId));

    if (newEdits.length > 0) {
      this.log(`➕ ${newEdits.length} new edits`);
      trackEvent('edit_detected', {
        module: 'editHistory',
        method: 'auto',
        count: newEdits.length,
      });
    }

    if (removed.length > 0) {
      this.log(`➖ ${removed.length} edits removed`);
    }

    // Update UI
    this.badge.updateAll(editedPrompts, EDIT_CONFIG.showBadges);
    this.ui.updateHighlights(editedPrompts, EDIT_CONFIG.highlightEdited);

    // Update state
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
    this.syncCollapseButton();

    // Update panel
    this.panel.updateContent(this.editedMessages);

    // Event
    if (this.editedMessages.length !== oldCount) {
      this.log(`🔄 Total edits: ${oldCount} → ${this.editedMessages.length}`);
      this.emit(Events.EDIT_MESSAGES_FOUND, this.editedMessages);
    }
  }

  /**
   * Scroll to a specific edit
   */
  scrollToEdit(index) {
    if (index < 0 || index >= this.editedMessages.length) {
      return;
    }

    const editMsg = this.editedMessages[index];
    this.log(`🎯 Scrolling to edit ${index + 1}`);

    DOMUtils.scrollToElement(editMsg.element, 'center');
    DOMUtils.flashClass(editMsg.element, 'claude-nav-highlight', 2000);
    trackEvent('edit_scroll', {
      module: 'editHistory',
      method: 'panel',
      message_index: index,
    });
  }

  /**
   * Collapse/Expand All operation
   */
  handleCollapseAll(shouldCollapse) {
    // Find CompactViewModule
    const app = window.claudeProductivity;
    if (!app) {
      return;
    }

    const compactViewModule = app.getModule('compactView');
    if (!compactViewModule || !compactViewModule.enabled) {
      this.warn('CompactView module is not active');
      return;
    }

    if (shouldCollapse) {
      compactViewModule.collapseAllMessages();
      this.log('📦 All messages collapsed');
    } else {
      compactViewModule.expandAllMessages();
      this.log('📂 All messages expanded');
    }
  }

  /**
   * When settings change
   */
  onSettingsChanged(settings) {
    this.log('⚙️ Settings changed');

    if (this.refreshFixedButtonVisibility) {
      this.refreshFixedButtonVisibility();
    }

    this.syncCollapseButton(settings);

    // Refresh UI if theme changed
    if (this.settingsChanged(['general.colorTheme', 'general.customColor'], settings)) {
      this.recreateUI();
      return;
    }

    // Re-scan
    messageHub.refresh();
  }

  /**
   * Recreate UI (on theme change)
   */
  recreateUI() {
    // Remove old collapse button
    if (this.elements.collapseBtn) {
      panelManager.removeButton(this.elements.collapseBtn.id);
      this.elements.collapseBtn = null;
    }

    this.syncCollapseButton();

    // Recreate panel
    this.panel.remove();
    this.panel.create();

    // Recreate badges
    this.badge.removeAll();
    this.badge.updateAll(DOMUtils.getEditedPrompts(), EDIT_CONFIG.showBadges);

    // Update panel content
    this.panel.updateContent(this.editedMessages);

    this.log('🎨 UI refreshed with theme');
  }

  /**
   * Stop module
   */
  destroy() {
    this.log('🛑 Edit History stopping...');

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

      // Note: MessageHub subscriptions are automatically cleaned up by BaseModule.destroy()

      try {
        if (this.badge) {
          this.badge.removeAll();
        }
      } catch (error) {
        this.error('Error removing badges:', error);
      }

      try {
        if (this.panel) {
          this.panel.remove();
        }
      } catch (error) {
        this.error('Error removing panel:', error);
      }

      try {
        if (this.modal) {
          this.modal.close();
        }
      } catch (error) {
        this.error('Error closing modal:', error);
      }

      // Remove highlights
      try {
        document.querySelectorAll('.claude-edit-highlighted').forEach(el => {
          el.classList.remove('claude-edit-highlighted');
        });
      } catch (error) {
        this.error('Error removing highlights:', error);
      }

      // Remove document event listener
      if (this._branchMapHandler) {
        document.removeEventListener('claude:open_branch_map', this._branchMapHandler);
        this._branchMapHandler = null;
      }

      editDraftCaptureService.destroy();

      // Reset lazy-initialized components for proper reinit
      this._panel = null;
      this._modal = null;
      this._branchMapModal = null;
      this._ui = null;

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
