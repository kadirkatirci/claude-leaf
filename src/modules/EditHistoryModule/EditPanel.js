/**
 * EditPanel - Floating panel for edit history
 * Extends BasePanel for common panel functionality
 */
import BasePanel from '../../core/BasePanel.js';
import DOMUtils from '../../utils/DOMUtils.js';
import IconLibrary from '../../components/primitives/IconLibrary.js';
import { cardClass, textClass } from '../../utils/ClassNames.js';

class EditPanel extends BasePanel {
  constructor(getTheme, onItemClick) {
    super({
      id: 'claude-edit-panel',
      title: 'Edit Points', // Icon will be added dynamically
      width: '280px',
      height: '500px',
      position: { right: '80px', top: '60px' },
    });

    this.getTheme = getTheme;
    this.onItemClick = onItemClick;
    this.lastEditSignature = ''; // Track edit signature to detect changes
  }

  /**
   * Override: Create panel UI
   */
  create() {
    const theme = this.getTheme();

    // Call parent create with theme
    super.create(theme);

    // Adjust panel styling for edit history specific needs
    Object.assign(this.panel.style, {
      maxHeight: '500px',
      overflow: 'hidden',
    });

    // Adjust content padding for edit history (more compact)
    if (this.content) {
      this.content.className = 'p-2 overflow-y-auto flex-1 bg-bg-000';
    }

    if (this.content) {
      this.content.className = 'p-2 overflow-y-auto flex-1 bg-bg-000';
    }

    // Add Footer with Import/Export
    this.createFooter();

    return this.panel;
  }

  createFooter() {
    const footer = DOMUtils.createElement('div');
    footer.className = 'p-2 border-t border-border-200 bg-bg-100';

    const mapBtn = DOMUtils.createElement('button', {
      className:
        'w-full px-3 py-2 text-xs bg-bg-200 hover:bg-bg-300 rounded text-text-200 transition-colors font-medium flex items-center justify-center gap-2',
    });
    mapBtn.innerHTML = `${IconLibrary.map('currentColor', 16)} Show Chat Branch Map`;

    mapBtn.addEventListener('click', () => {
      // Dispatch event to open Branch Map Modal
      // EditHistoryModule will listen for this
      const event = new CustomEvent('claude:open_branch_map', {
        detail: { conversationUrl: window.location.pathname },
      });
      document.dispatchEvent(event);
    });

    footer.appendChild(mapBtn);
    this.panel.appendChild(footer);
  }

  /**
   * Update panel content
   * Only updates DOM if edits actually changed
   */
  updateContent(editedMessages) {
    if (!this.panel || !this.content) {
      return;
    }

    // Update title with icon and count
    if (this.header) {
      const title = this.header.querySelector('h3');
      if (title) {
        title.innerHTML = `${IconLibrary.edit('currentColor', 16)} Edit Points${editedMessages.length > 0 ? ` (${editedMessages.length})` : ''}`;
      }
    }

    // Check if edits changed
    // Check if edits changed (include version info to detect version swaps)
    const currentSignature = editedMessages.map(e => `${e.containerId}-${e.versionInfo}`).join('|');
    const lastSignature = this.lastEditSignature;

    if (currentSignature === lastSignature) {
      return; // Nothing changed, skip update
    }

    this.lastEditSignature = currentSignature;

    // Clear content
    this.content.textContent = '';

    // Show empty state if no edits
    if (editedMessages.length === 0) {
      this.showEmptyState();
      return;
    }

    editedMessages.forEach((editMsg, index) => {
      const item = this.createPanelItem(editMsg, index);
      this.content.appendChild(item);
    });
  }

  /**
   * Panel item oluştur
   */
  createPanelItem(editMsg, index) {
    const item = DOMUtils.createElement('div');
    item.className = cardClass(true, 'mb-1');

    // Header
    const header = DOMUtils.createElement('div');
    header.className = 'flex justify-between items-center mb-1';

    const label = DOMUtils.createElement('span', {
      textContent: `Edit ${index + 1}`,
    });
    label.className = textClass({ color: 'primary', size: 'sm', weight: 'semibold' });

    const version = DOMUtils.createElement('span', {
      textContent: editMsg.versionInfo,
    });
    version.className = 'px-2 py-0.5 bg-accent-main-100 text-white text-xs rounded font-mono';

    header.appendChild(label);
    header.appendChild(version);

    // Preview
    const userMessage = editMsg.element.querySelector('[data-testid="user-message"]');
    const messageText = userMessage ? userMessage.textContent : '';
    const preview = DOMUtils.createElement('div', {
      textContent: messageText.substring(0, 50) + (messageText.length > 50 ? '...' : ''),
    });
    preview.className = textClass({ color: 'muted', size: 'xs', truncate: true });

    item.appendChild(header);
    item.appendChild(preview);

    // Click
    item.addEventListener('click', () => this.onItemClick(index));

    return item;
  }

  /**
   * Override: Panel toggle - use BasePanel's implementation
   */
  toggle() {
    super.toggle();
  }

  /**
   * Override: Panel remove - use destroy instead
   */
  remove() {
    this.destroy();
  }

  /**
   * Override: Get empty state message
   */
  getEmptyStateMessage() {
    return 'Henüz edit yok';
  }

  /**
   * Override: Get isOpen state (for compatibility)
   */
  get isOpen() {
    return this.isVisible;
  }

  set isOpen(value) {
    this.isVisible = value;
  }
}

export default EditPanel;
