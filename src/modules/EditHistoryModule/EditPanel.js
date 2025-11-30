/**
 * EditPanel - Floating panel for edit history
 * Extends BasePanel for common panel functionality
 */
import BasePanel from '../../core/BasePanel.js';
import DOMUtils from '../../utils/DOMUtils.js';
import { cn, cardClass, textClass } from '../../utils/ClassNames.js';
import { editHistoryStore } from '../../stores/index.js';

class EditPanel extends BasePanel {
  constructor(getTheme, onItemClick) {
    super({
      id: 'claude-edit-panel',
      title: '✏️ Edit Points',
      width: '280px',
      height: '500px',
      position: { right: '20px', top: '60px' }
    });

    this.getTheme = getTheme;
    this.onItemClick = onItemClick;
    this.lastEditIds = []; // Track edit container IDs to detect changes
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
    footer.className = 'p-2 border-t border-border-200 flex justify-between bg-bg-100';

    const exportBtn = DOMUtils.createElement('button', {
      textContent: 'Export',
      className: 'px-3 py-1 text-xs bg-bg-200 hover:bg-bg-300 rounded text-text-200 transition-colors'
    });

    const importBtn = DOMUtils.createElement('button', {
      textContent: 'Import',
      className: 'px-3 py-1 text-xs bg-bg-200 hover:bg-bg-300 rounded text-text-200 transition-colors'
    });

    // Hidden file input
    const fileInput = DOMUtils.createElement('input', {
      type: 'file',
      accept: '.json',
      style: { display: 'none' }
    });

    exportBtn.addEventListener('click', async () => {
      try {
        const json = await editHistoryStore.export();
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `claude-edit-history-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } catch (err) {
        console.error('Export failed:', err);
        alert('Export failed');
      }
    });

    importBtn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const result = await editHistoryStore.import(event.target.result);
          if (result.success) {
            alert(`Import successful! Added ${result.imported} entries.`);
            // Refresh panel if needed (although it updates on next scan/open)
          } else {
            alert('Import failed: ' + result.error);
          }
        } catch (err) {
          console.error('Import error:', err);
          alert('Import error');
        }
        fileInput.value = ''; // Reset
      };
      reader.readAsText(file);
    });

    footer.appendChild(importBtn);
    footer.appendChild(exportBtn);
    this.panel.appendChild(footer);
    this.panel.appendChild(fileInput);
  }

  /**
   * Update panel content
   * Only updates DOM if edits actually changed
   */
  updateContent(editedMessages) {
    if (!this.panel || !this.content) return;

    // Check if edits changed
    const currentIds = editedMessages.map(e => e.containerId).join(',');
    const lastIds = this.lastEditIds.join(',');

    if (currentIds === lastIds) {
      return; // Nothing changed, skip update
    }

    this.lastEditIds = editedMessages.map(e => e.containerId);

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
