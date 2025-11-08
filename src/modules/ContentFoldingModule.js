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
import FoldingStorage from './ContentFoldingModule/FoldingStorage.js';

class ContentFoldingModule extends BaseModule {
  constructor() {
    super('contentFolding');

    this.headingFolder = null;
    this.codeBlockFolder = null;
    this.messageFolder = null;
    this.storage = null;
    this.observer = null;
    this.lastMessageCount = 0;
  }

  async init() {
    try {
      await super.init();
      if (!this.enabled) return;

      this.log('Content Folding başlatılıyor...');

      // Enhance with MessageObserverMixin
      MessageObserverMixin.enhance(this);

      // Initialize storage
      this.storage = new FoldingStorage(this);

      // Initialize sub-components
      this.headingFolder = new HeadingFolder(this, this.storage);
      this.codeBlockFolder = new CodeBlockFolder(this, this.storage);
      this.messageFolder = new MessageFolder(this, this.storage);

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
  scanContent() {
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
      if (this.getSetting('messages.enabled')) {
        this.messageFolder.scanMessages(messages);
      }

      // Scan each message for headings and code blocks
      messages.forEach((message, index) => {
        // Skip user messages (only assistant messages have headings/code)
        if (message.querySelector('[data-testid="user-message"]')) {
          return;
        }

        // Scan for headings
        if (this.getSetting('headings.enabled')) {
          this.headingFolder.scanMessage(message, index);
        }

        // Scan for code blocks
        if (this.getSetting('codeBlocks.enabled')) {
          this.codeBlockFolder.scanMessage(message, index);
        }
      });

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
