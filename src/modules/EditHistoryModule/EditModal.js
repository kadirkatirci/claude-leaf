/**
 * EditModal - Edit history modal dialog
 * Refactored to use Claude native classes
 */
import DOMUtils from '../../utils/DOMUtils.js';
import IconLibrary from '../../components/primitives/IconLibrary.js';
import Badge from '../../components/primitives/Badge.js';
import { cn, textClass } from '../../utils/ClassNames.js';
import { editHistoryStore } from '../../stores/index.js';

class EditModal {
  constructor() {
    this.activeModal = null;
  }

  createMarkupNode(markup) {
    const template = document.createElement('template');
    template.innerHTML = markup.trim();
    return template.content.firstElementChild || document.createTextNode('');
  }

  parseVersionLabel(versionLabel) {
    if (typeof versionLabel !== 'string') {
      return null;
    }

    const match = versionLabel.match(/^\s*(\d+)\s*\/\s*(\d+)\s*$/);
    if (!match) {
      return null;
    }

    const current = Number.parseInt(match[1], 10);
    const total = Number.parseInt(match[2], 10);

    if (!Number.isFinite(current) || !Number.isFinite(total) || current < 1 || total < 1) {
      return null;
    }

    return { current, total };
  }

  formatVersionLabel(current, total) {
    return `${current} / ${total}`;
  }

  getTimestampValue(item) {
    if (typeof item?.timestamp === 'number' && Number.isFinite(item.timestamp)) {
      return item.timestamp;
    }

    const parsed = new Date(item?.timestamp).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  }

  destroyActiveModal() {
    const modalState = this.activeModal;
    if (!modalState) {
      return;
    }

    if (modalState.closeTimer) {
      clearTimeout(modalState.closeTimer);
    }

    if (modalState.element?.isConnected) {
      modalState.element.remove();
    }

    if (modalState.escHandler) {
      document.removeEventListener('keydown', modalState.escHandler);
    }

    this.activeModal = null;
  }

  getHistoryItemClass(isCurrent) {
    return cn(
      'p-3 rounded-lg border cursor-pointer transition-colors',
      isCurrent
        ? 'bg-accent-main-100/10 border-accent-main-100'
        : 'bg-bg-100 border-border-200 hover:bg-bg-200'
    );
  }

  createVersionBadge(content, { variant = 'neutral', className = '' } = {}) {
    return Badge.create({
      content,
      variant,
      size: 'xs',
      rounded: true,
      className: cn('font-mono font-bold', className),
    });
  }

  /**
   * Get current version info from DOM
   * Reads the version span in real-time to get the up-to-date version number
   */
  getCurrentVersionInfo(messageElement) {
    if (!messageElement) {
      return null;
    }

    const pattern = /^\d+\s*\/\s*\d+$/;

    // Fast path: version navigation container in Claude UI
    const versionContainer = messageElement.querySelector('.inline-flex.items-center.gap-1');
    if (versionContainer) {
      const span = versionContainer.querySelector('span');
      if (span && pattern.test(span.textContent.trim())) {
        return span.textContent.trim();
      }
    }

    // Fallback: avoid message body spans to reduce false positives
    const userMessage = messageElement.querySelector('[data-testid="user-message"]');
    const allSpans = messageElement.querySelectorAll('span');
    for (const span of allSpans) {
      if (userMessage && userMessage.contains(span)) {
        continue;
      }

      const text = span.textContent.trim();
      if (pattern.test(text)) {
        return text;
      }
    }

    return null;
  }

  /**
   * Show modal
   */
  async show(messageElement, versionInfo = '', containerId = null) {
    if (!messageElement) {
      return;
    }

    // Always keep a single active modal/listener
    this.destroyActiveModal();

    // Get the CURRENT version info from DOM (not from cached badge data)
    // This ensures we show the up-to-date version number
    const currentVersionInfo = this.getCurrentVersionInfo(messageElement) || versionInfo;

    // Get message content
    const userMessage = messageElement.querySelector('[data-testid="user-message"]');
    const messageText = userMessage ? userMessage.textContent : messageElement.textContent;

    // Modal backdrop - use CSS transitions (not animations) to avoid FOUC flash
    const modal = DOMUtils.createElement('div');
    modal.className =
      'fixed inset-0 z-[10000] bg-black/70 flex items-center justify-center opacity-0 transition-opacity duration-200';

    // Modal content
    const modalContent = DOMUtils.createElement('div');
    modalContent.className =
      'bg-bg-000 rounded-xl p-6 overflow-auto shadow-2xl max-w-[600px] max-h-[80vh] opacity-0 translate-y-5 transition-all duration-300';

    // Header
    const header = this.createHeader(currentVersionInfo);
    const closeBtn = header.querySelector('button');
    closeBtn.addEventListener('click', () => this.close());

    // Fetch history
    // Use passed containerId or try to find it
    const finalContainerId = containerId || this.getContainerId(messageElement);
    const history = finalContainerId
      ? await editHistoryStore.getHistoryForMessage(window.location.pathname, finalContainerId)
      : [];

    // Content
    const content = this.createContent(messageText, history, currentVersionInfo);

    modalContent.appendChild(header);
    modalContent.appendChild(content);
    modal.appendChild(modalContent);

    // Click outside to close
    modal.addEventListener('click', e => {
      if (e.target === modal) {
        this.close();
      }
    });

    // ESC to close
    const escHandler = e => {
      if (e.key === 'Escape') {
        this.close();
      }
    };
    document.addEventListener('keydown', escHandler);

    // Store for cleanup
    this.activeModal = { element: modal, content: modalContent, escHandler };

    document.body.appendChild(modal);

    // Trigger transition on next frame (after element is in DOM)
    requestAnimationFrame(() => {
      modal.classList.remove('opacity-0');
      modal.classList.add('opacity-100');
      modalContent.classList.remove('opacity-0', 'translate-y-5');
      modalContent.classList.add('opacity-100', 'translate-y-0');
    });
  }

  /**
   * Create modal header
   */
  createHeader(versionInfo) {
    const header = DOMUtils.createElement('div');
    header.className = 'flex justify-between items-center mb-5 pb-4 border-b-2 border-border-300';

    const title = DOMUtils.createElement('h2');
    title.className = cn(textClass({ size: 'xl', weight: 'semibold' }), 'flex items-center gap-2');
    title.appendChild(this.createMarkupNode(IconLibrary.edit('currentColor', 16)));
    title.appendChild(document.createTextNode('Edit History'));
    if (versionInfo) {
      title.appendChild(
        DOMUtils.createElement('span', {
          className: 'text-accent-main-100 text-base',
          textContent: versionInfo,
        })
      );
    }

    const closeBtn = DOMUtils.createElement('button');
    closeBtn.className =
      'bg-transparent border-0 text-2xl text-text-400 hover:bg-bg-200 hover:text-text-000 cursor-pointer p-0 size-8 rounded-full transition-all flex items-center justify-center';
    closeBtn.textContent = '✕';

    header.appendChild(title);
    header.appendChild(closeBtn);

    return header;
  }

  /**
   * Normalize version labels to show maximum total count
   * Example: ["1/2", "2/2", "3/3"] -> ["1/3", "2/3", "3/3"]
   */
  normalizeVersionLabels(history) {
    if (!history || history.length === 0) {
      return history;
    }

    // Keep only valid versioned entries
    const validHistory = history
      .map(item => {
        const parsed = this.parseVersionLabel(item?.versionLabel);
        return parsed ? { item, parsed } : null;
      })
      .filter(Boolean);

    if (validHistory.length === 0) {
      return [];
    }

    // Find maximum total version count
    let maxTotal = 0;
    validHistory.forEach(({ parsed }) => {
      if (parsed.total > maxTotal) {
        maxTotal = parsed.total;
      }
    });

    // Update all version labels to use max total
    const normalized = validHistory.map(({ item, parsed }) => {
      return {
        ...item,
        versionLabel: this.formatVersionLabel(parsed.current, maxTotal),
        _versionCurrent: parsed.current,
      };
    });

    // Deduplicate: Keep only the most recent entry for each version number
    const versionMap = new Map();
    normalized.forEach(item => {
      const existing = versionMap.get(item.versionLabel);
      if (!existing || this.getTimestampValue(item) > this.getTimestampValue(existing)) {
        versionMap.set(item.versionLabel, item);
      }
    });

    return Array.from(versionMap.values()).sort((a, b) => {
      // Sort by version number (descending)
      return b._versionCurrent - a._versionCurrent;
    });
  }

  /**
   * Create modal content
   */
  createContent(messageText, history = [], currentVersion) {
    const container = DOMUtils.createElement('div');

    // Normalize version labels to show maximum total count
    const normalizedHistory = this.normalizeVersionLabels(history);

    // History List (if available)
    if (normalizedHistory.length > 0) {
      const historyBox = DOMUtils.createElement('div');
      historyBox.className = 'mb-5';

      const historyLabel = DOMUtils.createElement('div');
      historyLabel.className = 'mb-2 text-sm font-semibold text-text-300';
      historyLabel.textContent = '📜 Saved Versions:';

      const historyList = DOMUtils.createElement('div');
      historyList.id = 'claude-edit-history-list';
      historyList.className = 'flex flex-col gap-2 max-h-[200px] overflow-y-auto pr-1';

      const currentVersionParsed = this.parseVersionLabel(currentVersion);

      normalizedHistory.forEach(item => {
        const itemVersionParsed = this.parseVersionLabel(item.versionLabel);
        const isCurrent =
          currentVersionParsed && itemVersionParsed
            ? itemVersionParsed.current === currentVersionParsed.current
            : item.versionLabel === currentVersion;
        const itemEl = DOMUtils.createElement('div');
        itemEl.classList.add('claude-edit-history-item');
        itemEl.dataset.versionLabel = item.versionLabel;
        itemEl.dataset.currentVersion = isCurrent ? 'true' : 'false';
        itemEl.className = this.getHistoryItemClass(isCurrent);

        const header = DOMUtils.createElement('div');
        header.className = 'flex justify-between items-center mb-1';

        const versionBadge = this.createVersionBadge(item.versionLabel, {
          variant: isCurrent ? 'accent' : 'neutral',
          className: isCurrent ? '' : 'text-text-300',
        });
        const timeLabel = DOMUtils.createElement('span', {
          className: 'text-[10px] text-text-400',
          textContent: new Date(item.timestamp).toLocaleTimeString(),
        });

        header.appendChild(versionBadge);
        header.appendChild(timeLabel);

        const preview = DOMUtils.createElement('div');
        preview.className = 'text-xs text-text-200 line-clamp-2';
        preview.textContent = item.content;

        itemEl.appendChild(header);
        itemEl.appendChild(preview);

        // Click to view content
        itemEl.addEventListener('click', () => {
          this.updateMessageView(item.content, item.versionLabel);
        });

        historyList.appendChild(itemEl);
      });

      historyBox.appendChild(historyLabel);
      historyBox.appendChild(historyList);
      container.appendChild(historyBox);
    } else {
      // Info note only if no history
      const infoBox = DOMUtils.createElement('div');
      infoBox.className = 'mb-4 p-3 bg-bg-100 rounded-lg text-sm';
      infoBox.appendChild(document.createTextNode('ℹ️ '));
      infoBox.appendChild(DOMUtils.createElement('strong', { textContent: 'Note:' }));
      infoBox.appendChild(document.createTextNode(' Past versions are saved as you browse.'));
      container.appendChild(infoBox);
    }

    // Current message box
    const messageBox = DOMUtils.createElement('div');
    messageBox.className = 'p-4 bg-bg-100 rounded-lg border-2 border-accent-main-100';
    messageBox.id = 'claude-edit-modal-view';

    const messageLabel = DOMUtils.createElement('div');
    messageLabel.className = 'mb-3 text-sm font-semibold text-accent-main-100 flex justify-between';

    const messageLabelText = DOMUtils.createElement('span', {
      textContent: '📝 Displayed Content',
    });
    const messageVersion = this.createVersionBadge(currentVersion, {
      variant: 'accent',
      className: 'text-white',
    });
    messageVersion.id = 'claude-edit-view-version';

    messageLabel.appendChild(messageLabelText);
    messageLabel.appendChild(messageVersion);

    const messageContent = DOMUtils.createElement('div');
    messageContent.id = 'claude-edit-view-content';
    messageContent.className =
      'text-sm text-text-000 whitespace-pre-wrap break-words max-h-[300px] overflow-y-auto';
    messageContent.textContent = messageText;

    messageBox.appendChild(messageLabel);
    messageBox.appendChild(messageContent);

    // Tip box
    const tipBox = DOMUtils.createElement('div');
    tipBox.className = 'mt-5 p-3 bg-bg-100 rounded-lg text-xs text-text-300';
    tipBox.appendChild(document.createTextNode('💡 '));
    tipBox.appendChild(DOMUtils.createElement('strong', { textContent: 'Tip:' }));
    tipBox.appendChild(document.createTextNode(' Use the '));
    tipBox.appendChild(DOMUtils.createElement('strong', { textContent: '◀ / ▶' }));
    tipBox.appendChild(
      document.createTextNode(' buttons on the message to navigate between versions.')
    );

    container.appendChild(messageBox);
    container.appendChild(tipBox);

    return container;
  }

  updateMessageView(content, versionLabel) {
    const contentEl = document.getElementById('claude-edit-view-content');
    const versionEl = document.getElementById('claude-edit-view-version');

    if (contentEl) {
      contentEl.textContent = content;
    }
    if (versionEl) {
      versionEl.textContent = versionLabel;
    }
  }

  getContainerId(element) {
    // Try to find container ID from DOM attributes if we stored it
    // Or re-generate it using same logic as Scanner?
    // Better: Scanner stores it on the element or we can re-calculate
    // For now, let's try to find it from the element's data or re-calculate
    // Re-calculation is safer but complex here.
    // Let's assume Scanner attaches it to the element or we can look it up from EditHistoryModule's state?
    // Actually, EditModal receives the element.
    // Let's check if we can get it from the badge?
    // The badge has data=versionInfo.

    // Fallback: Re-calculate hash
    // This duplicates logic from EditScanner/DOMUtilsParsing, which is not ideal but acceptable for now
    // Ideally we should pass containerId to show()

    // For now, let's rely on the fact that we can't easily get containerId here without passing it.
    // Let's update show() signature in next step or use a helper.
    // Wait, I can't update show() call sites easily (it's called from EditBadge).
    // Let's use a workaround: EditBadge passes 'data' which is versionInfo.
    // Let's update EditBadge to pass containerId in data?

    // Alternative: Use DOMUtilsParsing.getEditedPrompts logic again?
    // No, that returns all prompts.

    // Best approach: Update EditBadge to store containerId on the badge element or pass it.
    // Let's assume for this step that we will update EditBadge next.
    // For now, return null and handle it.
    return element.getAttribute('data-edit-container-id') || null;
  }

  /**
   * Close modal
   */
  close() {
    if (!this.activeModal) {
      return;
    }

    const modalState = this.activeModal;
    const { element, content, escHandler } = modalState;
    element.classList.remove('opacity-100');
    element.classList.add('opacity-0');
    if (content) {
      content.classList.remove('opacity-100', 'translate-y-0');
      content.classList.add('opacity-0', 'translate-y-5');
    }

    modalState.closeTimer = setTimeout(() => {
      if (element?.isConnected) {
        element.remove();
      }
      document.removeEventListener('keydown', escHandler);
      if (this.activeModal === modalState) {
        this.activeModal = null;
      }
    }, 200);
  }
}

export default EditModal;
