/**
 * CompactViewModule - Collapse/expand Claude responses
 * Extends BaseModule
 */
import BaseModule from './BaseModule.js';
import { Events } from '../utils/EventBus.js';
import IconLibrary from '../components/primitives/IconLibrary.js';
import VisibilityManager from '../utils/VisibilityManager.js';
import { MODULE_CONSTANTS } from '../config/ModuleConstants.js';
import { panelManager } from '../components/PanelManager.js'; // Shared panel
import { buttonClass } from '../utils/ClassNames.js';

const COMPACT_CONFIG = MODULE_CONSTANTS.compactView;

// Sub-components
import MessageCollapse from './CompactViewModule/MessageCollapse.js';
import ExpandButton from './CompactViewModule/ExpandButton.js';

class CompactViewModule extends BaseModule {
  constructor() {
    super('compactView');

    // Sub-components
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
      this.log('Compact View initializing...');

      // Setup visibility listener for proper show/hide behavior
      this.setupVisibilityListener();

      // Create collapse/expand all buttons in navigation container
      try {
        this.createCollapseButtons();
      } catch (error) {
        this.error('Failed to create collapse buttons:', error);
      }

      // Process existing messages
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

      // Keyboard shortcuts
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
   * Create Collapse/Expand All buttons
   */
  createCollapseButtons() {
    // Use PanelManager to add toggle button
    // No waiting/polling needed as PanelManager is always available

    // Toggle button - collapses or expands based on state
    const toggleBtn = this.createNavButton(
      IconLibrary.collapse('currentColor', 20),
      'Collapse All (Alt+←)',
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

    this.log('📦 Collapse/Expand All button created (via PanelManager)');
  }

  /**
   * Add buttons to navigation container
   */
  addButtonsToNavigation(navContainer) {
    // Toggle button - collapses or expands based on state
    const toggleBtn = this.createNavButton(
      IconLibrary.collapse('currentColor', 20),
      'Collapse All (Alt+←)',
      () => {
        this.toggleAllMessages();
      }
    );
    toggleBtn.id = 'claude-compact-toggle-all';

    // Add to navigation container (below navigation buttons)
    navContainer.appendChild(toggleBtn);

    this.elements = this.elements || {};
    this.elements.toggleBtn = toggleBtn;
    this.isAllCollapsed = false; // Track state

    this.log('📦 Collapse/Expand All button created');
  }

  /**
   * Toggle all messages
   */
  toggleAllMessages() {
    if (this.isAllCollapsed) {
      // Expand all
      const count = this.expandAllMessages();
      this.isAllCollapsed = false;
      this.updateToggleButton();
      this.log(`📂 ${count} messages expanded`);
    } else {
      // Collapse all
      const count = this.collapseAllMessages();
      this.isAllCollapsed = true;
      this.updateToggleButton();
      this.log(`📦 ${count} messages collapsed`);
    }
  }

  /**
   * Update toggle button
   */
  updateToggleButton() {
    if (this.elements && this.elements.toggleBtn) {
      if (this.isAllCollapsed) {
        this.elements.toggleBtn.innerHTML = IconLibrary.expand('currentColor', 20);
        this.elements.toggleBtn.title = 'Expand All (Alt+→)';
      } else {
        this.elements.toggleBtn.innerHTML = IconLibrary.collapse('currentColor', 20);
        this.elements.toggleBtn.title = 'Collapse All (Alt+←)';
      }
    }
  }

  /**
   * Create navigation-style button
   */
  createNavButton(icon, tooltip, onClick) {
    const theme = this.getTheme();
    const button = document.createElement('button');

    button.innerHTML = icon; // Use innerHTML to support SVG strings
    button.title = tooltip;

    // Use Claude's native button classes (size-9 = 36px from buttonClasses)
    button.className = theme.buttonClasses || buttonClass('fixed');

    // Only set positioning (sizing handled by classes)
    // Removed color: 'white' to allow currentColor in SVGs to adapt to theme
    Object.assign(button.style, {
      position: 'relative',
    });

    button.addEventListener('click', onClick);
    return button;
  }

  /**
   * Process messages
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

    // Find Claude responses (assistant messages)
    const messages = document.querySelectorAll('[data-is-streaming="false"]');

    messages.forEach(message => {
      // Skip if already processed
      if (this.processedMessages.has(message)) {
        return;
      }

      // Skip user messages, only Claude responses
      if (message.querySelector('[data-testid="user-message"]')) {
        return;
      }

      this.processMessage(message);
      this.processedMessages.add(message);
    });
  }

  /**
   * Process a single message
   */
  processMessage(messageElement) {
    // Should collapse?
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
   * When message state changes
   */
  onMessageStateChanged(messageElement, isCollapsed) {
    this.log(`Message ${isCollapsed ? 'collapsed' : 'expanded'}`);

    // Update button
    this.updateButtonState(messageElement, isCollapsed);

    this.emit(Events.MESSAGE_COLLAPSED, { messageElement, isCollapsed });
  }

  /**
   * Update button state
   */
  updateButtonState(messageElement, isCollapsed) {
    // Find message container (may be inside wrapper)
    let targetContainer = messageElement;
    if (messageElement.parentElement?.classList.contains('claude-message-collapsed')) {
      targetContainer = messageElement.parentElement;
    }

    // Find existing button - may be in several places
    let container = targetContainer.querySelector('.claude-expand-button-container');

    // Also search in footer
    if (!container) {
      const nextSibling = targetContainer.nextElementSibling;
      if (nextSibling?.classList.contains('claude-expand-footer')) {
        container = nextSibling.querySelector('.claude-expand-button-container');
      }
    }

    if (!container) {
      // If button doesn't exist, create new one
      const button = this.expandButton.create(messageElement, isCollapsed);
      this.expandButton.insertNextToEditButton(messageElement, button);
      return;
    }

    // Update existing button
    const button = container.querySelector('.claude-expand-btn');
    if (button) {
      button.innerHTML = isCollapsed
        ? IconLibrary.expand('currentColor', 12)
        : IconLibrary.collapse('currentColor', 16);
      button.title = isCollapsed ? 'Expand message' : 'Collapse message';
    }
  }

  /**
   * Collapse all messages
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
      // Skip user messages
      if (message.querySelector('[data-testid="user-message"]')) {
        return;
      }

      // Should collapse?
      if (this.collapse.shouldCollapse(message)) {
        const wasCollapsed = this.collapse.isCollapsed(message);

        // If not already collapsed, collapse it
        if (!wasCollapsed) {
          this.collapse.collapseMessage(message);
          collapsedCount++;
        }
      }
    });

    this.log(`📦 ${collapsedCount} messages collapsed`);
    return collapsedCount;
  }

  /**
   * Expand all messages
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
      // Skip user messages
      if (message.querySelector('[data-testid="user-message"]')) {
        return;
      }

      // Should expand?
      if (this.collapse.shouldCollapse(message)) {
        const wasCollapsed = this.collapse.isCollapsed(message);

        // If already collapsed, expand it
        if (wasCollapsed) {
          this.collapse.expandMessage(message);
          expandedCount++;
        }
      }
    });

    this.log(`📂 ${expandedCount} messages expanded`);
    return expandedCount;
  }

  /**
   * Keyboard shortcuts
   * Alt + ArrowLeft = Collapse All
   * Alt + ArrowRight = Expand All
   */
  setupKeyboardShortcuts() {
    const handleKeydown = e => {
      // Alt + ArrowLeft - Collapse All
      if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        this.collapseAllMessages();
        this.log('⌨️ Alt+← (Collapse)');
      }

      // Alt + ArrowRight - Expand All
      if (e.altKey && e.key === 'ArrowRight') {
        e.preventDefault();
        this.expandAllMessages();
        this.log('⌨️ Alt+→ (Expand)');
      }
    };

    document.addEventListener('keydown', handleKeydown);
    this.keydownHandler = handleKeydown;
    this.unsubscribers.push(() => {
      document.removeEventListener('keydown', handleKeydown);
    });

    this.log('⌨️ Keyboard shortcuts active: Alt+← (Collapse), Alt+→ (Expand)');
  }

  /**
   * When settings change
   */
  onSettingsChanged(settings) {
    this.log('⚙️ Settings changed');

    // Did autoCollapseEnabled change?
    const compactViewSettings = settings.compactView || {};
    if (
      compactViewSettings.autoCollapseEnabled !== undefined &&
      compactViewSettings.autoCollapseEnabled
    ) {
      // Collapse all messages
      this.collapseAllMessages();
    }

    // Reprocess messages
    this.processedMessages = new WeakSet();
    this.collapse.clear();
    this.processMessages();
  }

  /**
   * Reinitialize UI on SPA navigation
   */
  reinitializeUI() {
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
      this.log(`🔄 Auto collapse - ${count} messages collapsed`);
    }, 500);

    this.log('✅ CompactView reinitialized');
  }

  /**
   * Stop module
   */
  destroy() {
    this.log('🛑 Compact View stopping...');

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

      // Remove Collapse/Expand All button
      try {
        if (this.elements && this.elements.toggleBtn) {
          panelManager.removeButton(this.elements.toggleBtn.id);
          this.elements.toggleBtn = null;
        }
      } catch (error) {
        this.error('Error removing toggle button:', error);
      }

      // Remove all expand buttons
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
