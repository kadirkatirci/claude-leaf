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
      this.setupMessageObserver(() => {
        this.scanContent();
      }, {
        throttleDelay: 500,
        trackMessageCount: true,
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
  async scanContent() {
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

      if (messages.length === this.lastMessageCount) {
        return; // No new messages
      }

      this.lastMessageCount = messages.length;

      this.log(`📊 Scanning ${messages.length} messages...`);

      // Scan for message-level folding (before content scanning)
      if (await this.getSetting('messages.enabled')) {
        await this.messageFolder.scanMessages(messages);
      }

      // Scan each message for headings and code blocks
      for (const [index, message] of messages.entries()) {
        // Skip user messages (only assistant messages have headings/code)
        if (message.querySelector('[data-testid="user-message"]')) {
          continue;
        }

        // Scan for headings
        if (await this.getSetting('headings.enabled')) {
          await this.headingFolder.scanMessage(message, index);
        }

        // Scan for code blocks
        if (await this.getSetting('codeBlocks.enabled')) {
          await this.codeBlockFolder.scanMessage(message, index);
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

    // Destroy message observer
    this.destroyMessageObserver();

    this.cleanup();

    super.destroy();
  }
}

export default ContentFoldingModule;
