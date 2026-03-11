/**
 * HistoryCaptureService - Captures edit history to store
 *
 * Focuses ONLY on data capture logic, separated from detection loop.
 */
import DOMUtils from '../../utils/DOMUtils.js';
import { editHistoryStore } from '../../stores/index.js';
import { debugLog } from '../../config/debug.js';

class HistoryCaptureService {
  constructor() {
    this.captureQueue = Promise.resolve();
  }

  getOrCreateContainerId(container, userMessage, userMessageIndex) {
    if (!container) {
      return null;
    }

    const expectedId = `edit-index-${userMessageIndex}`;
    const existingId =
      container.getAttribute('data-edit-container-id') ||
      userMessage?.getAttribute('data-edit-container-id');
    if (existingId === expectedId) {
      return existingId;
    }

    container.setAttribute('data-edit-container-id', expectedId);
    if (userMessage) {
      userMessage.setAttribute('data-edit-container-id', expectedId);
    }
    return expectedId;
  }

  findVersionInfo(container, userMessage) {
    const pattern = /^\d+\s*\/\s*\d+$/;

    const versionContainer = container.querySelector('.inline-flex.items-center.gap-1');
    if (versionContainer) {
      const versionSpan = versionContainer.querySelector('span');
      if (versionSpan && pattern.test(versionSpan.textContent.trim())) {
        return versionSpan.textContent.trim();
      }
    }

    const allSpans = container.querySelectorAll('span');
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

  normalizeVersionLabel(versionLabel) {
    const parsed = this.parseVersionLabel(versionLabel);
    if (!parsed) {
      return '';
    }

    return `${parsed.current} / ${parsed.total}`;
  }

  collectSnapshotMessages() {
    const allMessages = DOMUtils.findActualMessages ? DOMUtils.findActualMessages() : [];
    const messages = [];

    allMessages.forEach((container, idx) => {
      const userMessage = container.querySelector('[data-testid="user-message"]');
      if (!userMessage) {
        return;
      }

      const containerId = this.getOrCreateContainerId(container, userMessage, idx);
      const versionInfo = this.findVersionInfo(container, userMessage);
      if (!versionInfo) {
        return;
      }

      messages.push({
        containerId,
        messageIndex: idx,
        version: this.normalizeVersionLabel(versionInfo),
        contentPreview: userMessage.textContent.trim().substring(0, 100),
      });
    });

    return messages.sort((a, b) => a.messageIndex - b.messageIndex);
  }

  async captureVersionSnapshot(entry) {
    const containerId = entry?.containerId;
    const versionLabel = this.normalizeVersionLabel(entry?.versionLabel);
    if (!containerId || !versionLabel) {
      return;
    }

    const conversationUrl = entry?.conversationUrl || window.location.pathname;
    const messages = this.collectSnapshotMessages();
    const existingIdx = messages.findIndex(item => item.containerId === containerId);

    const parsedIndex = Number.parseInt(String(containerId).replace('edit-index-', ''), 10);
    const messageIndex = Number.isFinite(entry?.messageIndex)
      ? entry.messageIndex
      : Number.isFinite(parsedIndex)
        ? parsedIndex
        : 0;

    const forcedMessage = {
      containerId,
      messageIndex,
      version: versionLabel,
      contentPreview: (entry?.content || '').substring(0, 100),
    };

    if (existingIdx >= 0) {
      messages[existingIdx] = forcedMessage;
    } else {
      messages.push(forcedMessage);
    }

    messages.sort((a, b) => a.messageIndex - b.messageIndex);

    if (messages.length === 0) {
      return;
    }

    await editHistoryStore.addSnapshot({
      conversationUrl,
      timestamp: entry?.timestamp || Date.now(),
      source: entry?.source || 'version_promotion',
      messages,
    });
    debugLog('editHistory', `Version snapshot captured: ${containerId} ${versionLabel}`);
  }

  /**
   * Capture content for history storage
   */
  captureHistory(editedPrompts) {
    if (!editedPrompts || editedPrompts.length === 0) {
      return;
    }

    const run = this.captureQueue.then(() => this._captureHistory(editedPrompts));
    this.captureQueue = run.catch(() => {});
    return run;
  }

  async _captureHistory(editedPrompts) {
    try {
      const conversationUrl = window.location.pathname;

      for (const edit of editedPrompts) {
        // Extract text content
        const userMessage = edit.element.querySelector('[data-testid="user-message"]');
        if (!userMessage) {
          continue;
        }

        const fallbackIndex = Number.isInteger(edit.domIndex) ? edit.domIndex : 0;
        const containerId =
          edit.containerId || this.getOrCreateContainerId(edit.element, userMessage, fallbackIndex);
        const parsedIndex = Number.parseInt(String(containerId).replace('edit-index-', ''), 10);
        const messageIndex = Number.isFinite(parsedIndex) ? parsedIndex : fallbackIndex;
        const content = userMessage.textContent.trim();

        // Add to store
        await editHistoryStore.addOrUpdate({
          conversationUrl,
          containerId,
          messageIndex,
          content,
          versionLabel: edit.versionInfo, // e.g. "2 / 3"
          timestamp: Date.now(),
        });
      }

      // Capture conversation snapshot
      // This captures the FULL state of all messages (not just edited ones)
      await this.captureSnapshot(conversationUrl);
    } catch (error) {
      console.error('[HistoryCaptureService] Failed to capture history:', error);
    }
  }

  /**
   * Capture a snapshot of the current conversation state
   * Only includes edited messages (version !== null) to save storage space
   */
  async captureSnapshot(conversationUrl) {
    try {
      const snapshot = {
        conversationUrl,
        timestamp: Date.now(),
        messages: this.collectSnapshotMessages(),
      };

      // Only save snapshot if there are edited messages
      if (snapshot.messages.length > 0) {
        await editHistoryStore.addSnapshot(snapshot);
        debugLog('editHistory', `Snapshot captured: ${snapshot.messages.length} edited messages`);
      }
    } catch (error) {
      console.error('[HistoryCaptureService] Failed to capture snapshot:', error);
    }
  }
}

// Singleton
export const historyCaptureService = new HistoryCaptureService();
