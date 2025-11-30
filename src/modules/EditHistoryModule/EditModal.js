/**
 * EditModal - Edit history modal dialog
 * Refactored to use Claude native classes
 */
import DOMUtils from '../../utils/DOMUtils.js';
import { textClass } from '../../utils/ClassNames.js';
import { editHistoryStore } from '../../stores/index.js';

class EditModal {
  constructor() {
    this.activeModal = null;
  }

  /**
   * Get current version info from DOM
   * Reads the version span in real-time to get the up-to-date version number
   */
  getCurrentVersionInfo(messageElement) {
    if (!messageElement) return null;

    // Find version span (same logic as getEditedPrompts)
    const allSpans = messageElement.querySelectorAll('span');
    for (const span of allSpans) {
      const text = span.textContent.trim();
      if (/^\d+\s*\/\s*\d+$/.test(text)) {
        return text; // Return current version like "2 / 3"
      }
    }

    return null;
  }

  /**
   * Modal'ı göster
   */
  async show(messageElement, versionInfo = '', containerId = null) {
    // Get the CURRENT version info from DOM (not from cached badge data)
    // This ensures we show the up-to-date version number
    const currentVersionInfo = this.getCurrentVersionInfo(messageElement) || versionInfo;

    // Mesaj içeriğini al
    const userMessage = messageElement.querySelector('[data-testid="user-message"]');
    const messageText = userMessage ? userMessage.textContent : messageElement.textContent;

    // Modal backdrop
    const modal = DOMUtils.createElement('div');
    modal.className = 'fixed inset-0 bg-black/70 flex items-center justify-center z-[10000]';
    modal.style.animation = 'fadeIn 0.2s ease';

    // Modal content
    const modalContent = DOMUtils.createElement('div');
    modalContent.className = 'bg-bg-000 rounded-xl p-6 overflow-auto shadow-2xl';
    Object.assign(modalContent.style, {
      maxWidth: '600px',
      maxHeight: '80vh',
      animation: 'slideUp 0.3s ease'
    });

    // Header
    const header = this.createHeader(currentVersionInfo);
    const closeBtn = header.querySelector('button');
    closeBtn.addEventListener('click', () => this.close());

    // Fetch history
    // Use passed containerId or try to find it
    const finalContainerId = containerId || this.getContainerId(messageElement);
    const history = await editHistoryStore.getHistoryForMessage(window.location.pathname, finalContainerId);

    // Content
    const content = this.createContent(messageText, history, currentVersionInfo);

    modalContent.appendChild(header);
    modalContent.appendChild(content);
    modal.appendChild(modalContent);

    // Click outside to close
    modal.addEventListener('click', (e) => {
      if (e.target === modal) this.close();
    });

    // ESC to close
    const escHandler = (e) => {
      if (e.key === 'Escape') this.close();
    };
    document.addEventListener('keydown', escHandler);

    // Store for cleanup
    this.activeModal = { element: modal, escHandler };

    document.body.appendChild(modal);
  }

  /**
   * Modal header oluştur
   */
  createHeader(versionInfo) {
    const header = DOMUtils.createElement('div');
    header.className = 'flex justify-between items-center mb-5 pb-4 border-b-2 border-border-300';

    const title = DOMUtils.createElement('h2');
    title.className = textClass({ size: 'xl', weight: 'semibold' });
    title.innerHTML = `✏️ Edit History ${versionInfo ? `<span class="text-accent-main-100 text-base">${versionInfo}</span>` : ''}`;

    const closeBtn = DOMUtils.createElement('button');
    closeBtn.className = 'bg-transparent border-0 text-2xl text-text-400 hover:bg-bg-200 hover:text-text-000 cursor-pointer p-0 size-8 rounded-full transition-all flex items-center justify-center';
    closeBtn.innerHTML = '✕';

    header.appendChild(title);
    header.appendChild(closeBtn);

    return header;
  }

  /**
   * Modal content oluştur
   */
  createContent(messageText, history = [], currentVersion) {
    const container = DOMUtils.createElement('div');

    // History List (if available)
    if (history.length > 0) {
      const historyBox = DOMUtils.createElement('div');
      historyBox.className = 'mb-5';

      const historyLabel = DOMUtils.createElement('div');
      historyLabel.className = 'mb-2 text-sm font-semibold text-text-300';
      historyLabel.innerHTML = '📜 Kaydedilen Versiyonlar:';

      const historyList = DOMUtils.createElement('div');
      historyList.className = 'flex flex-col gap-2 max-h-[200px] overflow-y-auto pr-1';

      history.forEach(item => {
        const isCurrent = item.versionLabel === currentVersion;
        const itemEl = DOMUtils.createElement('div');
        itemEl.className = `p-3 rounded-lg border ${isCurrent ? 'bg-accent-main-100/10 border-accent-main-100' : 'bg-bg-100 border-border-200'} cursor-pointer hover:bg-bg-200 transition-colors`;

        const header = DOMUtils.createElement('div');
        header.className = 'flex justify-between items-center mb-1';
        header.innerHTML = `
          <span class="text-xs font-mono font-bold ${isCurrent ? 'text-accent-main-100' : 'text-text-300'}">${item.versionLabel}</span>
          <span class="text-[10px] text-text-400">${new Date(item.timestamp).toLocaleTimeString()}</span>
        `;

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
      infoBox.innerHTML = `ℹ️ <strong>Not:</strong> Geçmiş versiyonlar siz gezindikçe kaydedilir.`;
      container.appendChild(infoBox);
    }

    // Current message box
    const messageBox = DOMUtils.createElement('div');
    messageBox.className = 'p-4 bg-bg-100 rounded-lg border-2 border-accent-main-100';
    messageBox.id = 'claude-edit-modal-view';

    const messageLabel = DOMUtils.createElement('div');
    messageLabel.className = 'mb-3 text-sm font-semibold text-accent-main-100 flex justify-between';
    messageLabel.innerHTML = `<span>📝 Görüntülenen İçerik</span> <span id="claude-edit-view-version" class="text-xs bg-accent-main-100 text-white px-2 py-0.5 rounded">${currentVersion}</span>`;

    const messageContent = DOMUtils.createElement('div');
    messageContent.id = 'claude-edit-view-content';
    messageContent.className = 'text-sm text-text-000 whitespace-pre-wrap break-words max-h-[300px] overflow-y-auto';
    messageContent.textContent = messageText;

    messageBox.appendChild(messageLabel);
    messageBox.appendChild(messageContent);

    // Tip box
    const tipBox = DOMUtils.createElement('div');
    tipBox.className = 'mt-5 p-3 bg-bg-100 rounded-lg text-xs text-text-300';
    tipBox.innerHTML = `💡 <strong>İpucu:</strong> Versiyonlar arasında gezinmek için mesaj üzerindeki <strong>◀ / ▶</strong> butonlarını kullanın.`;

    container.appendChild(messageBox);
    container.appendChild(tipBox);

    // Add Map Toggle
    const mapBtn = DOMUtils.createElement('button', {
      textContent: '🗺️ Show Branch Map',
      className: 'mt-3 text-xs text-accent-main-100 hover:underline w-full text-center'
    });

    const mapContainer = DOMUtils.createElement('div');
    mapContainer.className = 'hidden mt-4 p-4 bg-bg-100 rounded-lg border border-border-200 overflow-x-auto';

    mapBtn.addEventListener('click', () => {
      const isHidden = mapContainer.classList.contains('hidden');
      if (isHidden) {
        mapContainer.classList.remove('hidden');
        mapBtn.textContent = '📝 Hide Branch Map';
        this.renderBranchMap(mapContainer, history, currentVersion);
      } else {
        mapContainer.classList.add('hidden');
        mapBtn.textContent = '🗺️ Show Branch Map';
      }
    });

    container.appendChild(mapBtn);
    container.appendChild(mapContainer);

    return container;
  }

  renderBranchMap(container, history, currentVersion) {
    container.innerHTML = '';

    if (history.length === 0) {
      container.textContent = 'No history to visualize.';
      return;
    }

    // Simple horizontal timeline
    const timeline = DOMUtils.createElement('div');
    timeline.className = 'flex items-center gap-4 min-w-max p-2';

    // Sort by timestamp
    const sorted = [...history].sort((a, b) => a.timestamp - b.timestamp);

    sorted.forEach((item, idx) => {
      const isCurrent = item.versionLabel === currentVersion;

      // Node
      const node = DOMUtils.createElement('div');
      node.className = `relative flex flex-col items-center group cursor-pointer`;

      const circle = DOMUtils.createElement('div');
      circle.className = `w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${isCurrent ? 'bg-accent-main-100 border-accent-main-100 text-white scale-110' : 'bg-bg-000 border-border-300 text-text-300 hover:border-accent-main-100'}`;
      circle.textContent = item.versionLabel.split('/')[0].trim(); // Just the version number

      // Tooltip
      const tooltip = DOMUtils.createElement('div');
      tooltip.className = 'absolute bottom-full mb-2 w-48 p-2 bg-bg-300 text-text-000 text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10';
      tooltip.textContent = item.content.substring(0, 50) + '...';

      // Timestamp label
      const timeLabel = DOMUtils.createElement('div');
      timeLabel.className = 'mt-1 text-[10px] text-text-400 whitespace-nowrap';
      timeLabel.textContent = new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      node.appendChild(circle);
      node.appendChild(tooltip);
      node.appendChild(timeLabel);

      node.addEventListener('click', () => {
        this.updateMessageView(item.content, item.versionLabel);
      });

      timeline.appendChild(node);

      // Connector line
      if (idx < sorted.length - 1) {
        const line = DOMUtils.createElement('div');
        line.className = 'h-0.5 w-8 bg-border-300';
        timeline.appendChild(line);
      }
    });

    container.appendChild(timeline);
  }

  updateMessageView(content, versionLabel) {
    const contentEl = document.getElementById('claude-edit-view-content');
    const versionEl = document.getElementById('claude-edit-view-version');

    if (contentEl) contentEl.textContent = content;
    if (versionEl) versionEl.textContent = versionLabel;
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
   * Modal'ı kapat
   */
  close() {
    if (!this.activeModal) return;

    const { element, escHandler } = this.activeModal;
    element.style.animation = 'fadeOut 0.2s ease';

    setTimeout(() => {
      element.remove();
      document.removeEventListener('keydown', escHandler);
      this.activeModal = null;
    }, 200);
  }
}

export default EditModal;
