import DOMUtils from '../../utils/DOMUtils.js';
import { editHistoryStore } from '../../stores/index.js';
import BranchTreeBuilder from './BranchTreeBuilder.js';
import BranchMapRenderer from './BranchMapRenderer.js';
import IconLibrary from '../../components/primitives/IconLibrary.js';
import Badge from '../../components/primitives/Badge.js';
import { debugLog } from '../../config/debug.js';

/**
 * BranchMapModal - Modal that shows the conversation branch map
 *
 * Features:
 * - Visualizes branch structure created from snapshots
 * - Same message number = same horizontal alignment
 * - Continuing paths stay in the same column
 * - Isolated ones stay in their own column
 * - Hover shows message content in tooltip
 */
class BranchMapModal {
  constructor() {
    this.overlay = null;
    this.modal = null;
    this.isVisible = false;
    this.renderer = null;
  }

  createMarkupNode(markup) {
    const template = document.createElement('template');
    template.innerHTML = markup.trim();
    return template.content.firstElementChild || document.createTextNode('');
  }

  /**
   * Show modal
   * @param {string} conversationUrl - Conversation URL
   */
  async show(conversationUrl) {
    if (this.isVisible) {
      return;
    }

    // Fetch all snapshots for this conversation
    const snapshots = await editHistoryStore.getSnapshots(conversationUrl);
    const history = await editHistoryStore.getByConversation(conversationUrl);

    if ((!snapshots || snapshots.length === 0) && (!history || history.length === 0)) {
      this.showEmptyState();
      return;
    }

    debugLog(
      'editHistory',
      `BranchMapModal loaded ${snapshots?.length || 0} snapshots, ${history?.length || 0} history entries`
    );

    this.createModal(snapshots || [], history || []);
    this.isVisible = true;
    document.body.style.overflow = 'hidden';
  }

  /**
   * Hide modal
   */
  hide() {
    if (!this.isVisible) {
      return;
    }

    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }

    this.modal = null;
    this.renderer = null;
    this.isVisible = false;
    document.body.style.overflow = '';
  }

  createCenteredState(icon, title, description) {
    const container = DOMUtils.createElement('div', {
      className: 'flex flex-col items-center justify-center h-full text-text-300',
    });

    const iconEl = DOMUtils.createElement('span', {
      className: 'text-4xl mb-4',
      textContent: icon,
    });
    const titleEl = DOMUtils.createElement('p', {
      className: 'text-lg',
      textContent: title,
    });
    const descriptionEl = DOMUtils.createElement('p', {
      className: 'text-sm mt-2 text-text-400',
      textContent: description,
    });

    container.appendChild(iconEl);
    container.appendChild(titleEl);
    container.appendChild(descriptionEl);
    return container;
  }

  createStatsBadge(content) {
    return Badge.create({
      content,
      variant: 'neutral',
      size: 'xs',
      rounded: true,
      className: 'font-normal text-text-300',
    });
  }

  /**
   * Show empty state
   */
  showEmptyState() {
    const toast = DOMUtils.createElement('div');
    toast.className =
      'fixed bottom-4 right-4 bg-bg-200 text-text-100 px-4 py-3 rounded-lg shadow-lg z-[10002] flex items-center gap-2 transition-opacity duration-300';
    toast.appendChild(
      DOMUtils.createElement('span', {
        textContent: '📭',
      })
    );
    toast.appendChild(
      DOMUtils.createElement('span', {
        textContent:
          'No edit history captured yet. Navigate through edited messages to capture snapshots.',
      })
    );
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('opacity-0');
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  /**
   * Create modal
   * @param {Array} snapshots - Snapshot list
   * @param {Array} history - History list
   */
  createModal(snapshots, history) {
    // Overlay
    this.overlay = DOMUtils.createElement('div');
    this.overlay.className =
      'fixed inset-0 z-[999999] bg-black/60 flex items-center justify-center p-6 backdrop-blur-sm';
    this.overlay.addEventListener('click', e => {
      if (e.target === this.overlay) {
        this.hide();
      }
    });

    // Modal Container
    this.modal = DOMUtils.createElement('div');
    this.modal.className =
      'bg-bg-000 rounded-xl shadow-2xl w-[95vw] max-w-[1400px] h-[85vh] flex flex-col border border-border-200 overflow-hidden';

    // Header
    const header = this.createHeader(snapshots, history);

    // Content Area
    const content = DOMUtils.createElement('div');
    content.className = 'flex-1 overflow-auto bg-bg-000 relative';
    content.id = 'branch-map-content';

    // Help text
    const helpText = DOMUtils.createElement('div');
    helpText.className =
      'absolute bottom-4 left-4 text-xs text-text-400 bg-bg-100/80 px-3 py-1.5 rounded-full backdrop-blur-sm';
    helpText.textContent = '🖱️ Drag to pan • Scroll to zoom • Hover to see content';

    this.modal.appendChild(header);
    this.modal.appendChild(content);
    content.appendChild(helpText);
    this.overlay.appendChild(this.modal);
    document.body.appendChild(this.overlay);

    // Render the map AFTER the modal is in the DOM
    requestAnimationFrame(() => {
      try {
        this.renderBranchMap(content, snapshots, history);
      } catch (error) {
        console.error('[BranchMapModal] Render error:', error);
        DOMUtils.clearElement(content);
        content.appendChild(
          this.createCenteredState('😕', 'Failed to render branch map', error.message)
        );
      }
    });
  }

  /**
   * Create header
   * @param {Array} snapshots - Snapshot list
   * @param {Array} history - History list
   */
  createHeader(snapshots, history) {
    const header = DOMUtils.createElement('div');
    header.className = 'p-4 border-b border-border-200 flex justify-between items-center bg-bg-100';

    // Title
    const titleContainer = DOMUtils.createElement('div');
    titleContainer.className = 'flex items-center gap-3';

    const title = DOMUtils.createElement('h2');
    title.className = 'text-lg font-semibold text-text-100 flex items-center gap-2';
    title.appendChild(this.createMarkupNode(IconLibrary.map('currentColor', 20)));
    title.appendChild(document.createTextNode('Chat Branch Map'));

    // Stats badges
    const statsContainer = DOMUtils.createElement('div');
    statsContainer.className = 'flex items-center gap-2';

    if (snapshots.length > 0) {
      const snapshotBadge = this.createStatsBadge(`${snapshots.length} snapshots`);
      statsContainer.appendChild(snapshotBadge);
    }

    // Count unique edited messages
    const uniqueMessages = new Set();
    history.forEach(h => uniqueMessages.add(h.containerId));
    if (uniqueMessages.size > 0) {
      const msgBadge = this.createStatsBadge(`${uniqueMessages.size} edited messages`);
      statsContainer.appendChild(msgBadge);
    }

    titleContainer.appendChild(title);
    titleContainer.appendChild(statsContainer);

    // Close button
    const closeBtn = DOMUtils.createElement('button');
    closeBtn.className =
      'p-2 hover:bg-bg-200 rounded-lg transition-colors text-text-300 hover:text-text-100';
    closeBtn.appendChild(this.createMarkupNode(IconLibrary.close('currentColor', 20)));
    closeBtn.addEventListener('click', () => this.hide());

    header.appendChild(titleContainer);
    header.appendChild(closeBtn);

    return header;
  }

  /**
   * Render branch map
   * @param {HTMLElement} container - Container element
   * @param {Array} snapshots - Snapshot list
   * @param {Array} history - History list
   */
  renderBranchMap(container, snapshots, history) {
    debugLog('editHistory', 'BranchMapModal building branch map...');

    // Build tree/data structure
    const builder = new BranchTreeBuilder(snapshots, history);
    const data = builder.build();

    debugLog('editHistory', 'BranchMapModal data built:', data);

    // Empty data check
    if (!data.columns || data.columns.length === 0) {
      DOMUtils.clearElement(container);
      container.appendChild(
        this.createCenteredState(
          '🌱',
          'No branches to display',
          'Edit some messages and navigate between versions to see the branch map.'
        )
      );
      return;
    }

    // Render
    debugLog('editHistory', 'BranchMapModal rendering...');
    this.renderer = new BranchMapRenderer(container, data);
    this.renderer.render();

    debugLog('editHistory', 'BranchMapModal render complete');
  }
}

export default BranchMapModal;
