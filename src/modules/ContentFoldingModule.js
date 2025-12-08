/**
 * ContentFoldingModule - Fold/unfold headings and code blocks (Obsidian-style)
 * Enables collapsing headings hierarchically and long code blocks
 */
import BaseModule from './BaseModule.js';
import DOMUtils from '../utils/DOMUtils.js';
import MessageObserverMixin from '../core/MessageObserverMixin.js';
import { Events } from '../utils/EventBus.js';
import HeadingFolder from './ContentFoldingModule/HeadingFolder.js';
import CodeBlockFolder from './ContentFoldingModule/CodeBlockFolder.js';
import MessageFolder from './ContentFoldingModule/MessageFolder.js';
import { conversationStateStore } from '../stores/index.js';
import { MODULE_CONSTANTS } from '../config/ModuleConstants.js';

const FOLDING_CONFIG = MODULE_CONSTANTS.contentFolding;

class ContentFoldingModule extends BaseModule {
  constructor() {
    super('contentFolding');

    this.headingFolder = null;
    this.codeBlockFolder = null;
    this.messageFolder = null;
    this.observer = null;
    this.lastMessageCount = 0;
    this.debouncedStateSave = null; // Will be initialized in init()
  }

  /**
   * Debounce utility - delays function execution until after wait time
   */
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  async init() {
    try {
      await super.init();
      if (!this.enabled) return;

      this.log('Content Folding başlatılıyor...');

      // Enhance with MessageObserverMixin
      MessageObserverMixin.enhance(this);

      // Set current conversation for state store
      conversationStateStore.setCurrentConversation(window.location.pathname);

      // Initialize sub-components (they will use conversationStateStore directly)
      this.headingFolder = new HeadingFolder(this);
      this.codeBlockFolder = new CodeBlockFolder(this);
      this.messageFolder = new MessageFolder(this);

      // Create debounced state saver (1 second delay)
      this.debouncedStateSave = this.debounce(async (state) => {
        await conversationStateStore.setCurrentState('folding', state);
        this.log('💾 Fold states saved (debounced)');
      }, 1000);

      // Listen for messages updated
      this.subscribe(Events.MESSAGES_UPDATED, () => {
        this.log('🔄 Messages updated, scanning content...');
        this.scanContent();
      });

      // Initial scan
      setTimeout(() => this.scanContent(), 1000);

      // Setup message observer
      // Observe DOM changes (not only message count) so final content
      // updates (e.g. streaming -> completed) also trigger a scan.
      this.setupMessageObserver(() => {
        // Force a rescan when the observer fires due to DOM changes so that
        // in-place content updates (same message count) are processed.
        this.scanContent(true);
      }, {
        throttleDelay: 500,
        // See note above: we disable strict message-count-only checks so the
        // observer will fire on DOM updates; we then call scanContent with
        // `force=true` to ensure content changes are handled.
        trackMessageCount: false,
        checkConversationPage: false
      });

      this.log('✅ Content Folding aktif');
    } catch (error) {
      this.error('❌ Content Folding init failed:', error);
      throw error;
    }
  }

  /**
   * Scan all messages for foldable content
   */
  async scanContent(force = false) {
    try {
      // Check if we're on a conversation page
      if (!this.dom.isOnConversationPage()) {
        // Don't log repeatedly to avoid console spam
        if (!this.lastNonConversationLog || Date.now() - this.lastNonConversationLog > 5000) {
          this.log('Not on conversation page, skipping content scan');
          this.lastNonConversationLog = Date.now();
        }

        // Don't clean up - just skip scanning
        this.lastMessageCount = 0;
        return;
      }

      // Reset non-conversation log timer
      this.lastNonConversationLog = null;

      const messages = this.dom.findMessages();

      // If there are no changes in message count and caller didn't force a
      // rescan (e.g. observer detected in-place content updates), skip heavy
      // scanning. When `force` is true we always proceed to scan, which is
      // useful for platforms that update message contents in-place.
      if (messages.length === this.lastMessageCount && !force) {
        return; // No new messages and not forced
      }

      this.lastMessageCount = messages.length;

      this.log(`📊 Scanning ${messages.length} messages...`);

      // Get latest settings
      const settings = await this.getSettings();
      const config = {
        messages: { ...FOLDING_CONFIG.messages, ...settings.messages },
        headings: { ...FOLDING_CONFIG.headings, ...settings.headings },
        codeBlocks: { ...FOLDING_CONFIG.codeBlocks, ...settings.codeBlocks }
      };

      // Update config on helpers
      this.headingFolder.config = config;
      this.codeBlockFolder.config = config;
      this.messageFolder.config = config;

      // Scan for message-level folding (before content scanning)
      if (config.messages.enabled) {
        await this.messageFolder.scanMessages(messages, config);
      }

      // Scan each message for headings and code blocks
      for (const [index, message] of messages.entries()) {
        // Skip user messages (only assistant messages have headings/code)
        if (message.querySelector('[data-testid="user-message"]')) {
          continue;
        }

        // Scan for headings
        if (config.headings.enabled) {
          await this.headingFolder.scanMessage(message, index, config);
        }

        // Scan for code blocks
        if (config.codeBlocks.enabled) {
          await this.codeBlockFolder.scanMessage(message, index, config);
        }
      }

      this.log('✅ Content scan complete');
    } catch (error) {
      this.error('❌ Content scan error:', error);
    }
  }


  /**
   * Settings changed
   */
  onSettingsChanged() {
    this.log('⚙️ Settings değişti');

    if (!this.enabled) {
      // Module disabled, clean up
      this.cleanup();
      return;
    }

    // Re-scan content with new settings
    this.lastMessageCount = 0; // Force rescan
    this.scanContent();
  }

  /**
   * Clean up
   */
  cleanup() {
    if (this.headingFolder) {
      this.headingFolder.cleanup();
    }
    if (this.codeBlockFolder) {
      this.codeBlockFolder.cleanup();
    }
    if (this.messageFolder) {
      this.messageFolder.cleanup();
    }
    this.lastMessageCount = 0;
  }

  /**
   * Destroy module
   */
  destroy() {
    this.log('🛑 Content Folding durduruluyor...');

    // Destroy message observer if it exists
    if (this.destroyMessageObserver && typeof this.destroyMessageObserver === 'function') {
      this.destroyMessageObserver();
    }

    this.cleanup();

    super.destroy();
  }
}

export default ContentFoldingModule;
