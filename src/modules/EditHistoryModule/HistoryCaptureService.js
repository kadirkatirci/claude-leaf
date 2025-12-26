/**
 * HistoryCaptureService - Captures edit history to store
 *
 * Replaces legacy EditScanner.
 * Focuses ONLY on data capture logic, separated from detection loop.
 */
import DOMUtils from '../../utils/DOMUtils.js';
import { editHistoryStore } from '../../stores/index.js';
import { debugLog } from '../../config/debug.js';

class HistoryCaptureService {
  /**
   * Capture content for history storage
   */
  async captureHistory(editedPrompts) {
    if (!editedPrompts || editedPrompts.length === 0) {
      return;
    }

    try {
      const conversationUrl = window.location.pathname;

      for (const edit of editedPrompts) {
        // Extract text content
        const userMessage = edit.element.querySelector('[data-testid="user-message"]');
        if (!userMessage) {
          continue;
        }

        const content = userMessage.textContent.trim();

        // Add to store
        await editHistoryStore.addOrUpdate({
          conversationUrl,
          containerId: edit.containerId,
          messageIndex: edit.domIndex, // Fallback
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
      const allMessages = DOMUtils.findActualMessages ? DOMUtils.findActualMessages() : [];
      const snapshot = {
        conversationUrl,
        timestamp: Date.now(),
        messages: [],
      };

      allMessages.forEach((container, idx) => {
        const userMessage = container.querySelector('[data-testid="user-message"]');
        if (!userMessage) {
          return;
        }

        // Check for version info
        const allSpans = container.querySelectorAll('span');
        let versionInfo = null;

        for (const span of allSpans) {
          const text = span.textContent.trim();
          if (/^\d+\s*\/\s*\d+$/.test(text)) {
            versionInfo = text;
            break;
          }
        }

        // Only include edited messages (version !== null) to save storage
        if (versionInfo) {
          snapshot.messages.push({
            containerId: `edit-index-${idx}`,
            version: versionInfo, // e.g. "2/3"
            contentPreview: userMessage.textContent.trim().substring(0, 100),
          });
        }
      });

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
