/**
 * BookmarkModule - Bookmark functionality for messages
 *
 * Bookmarks are tied to specific messages via content signature.
 * If the message exists, show the bookmark. If not, don't show it.
 * NEVER auto-delete - only user can delete.
 */
import BaseModule from './BaseModule.js';
import { Events } from '../utils/EventBus.js';
import FixedButtonMixin from '../core/FixedButtonMixin.js';
import {
  getCleanMessageText,
  generateSignature,
  getValidMarkers,
  resolveMarkerIndex,
} from '../utils/MarkerUtils.js';
import { bookmarkStore } from '../stores/index.js';
import { BookmarkButton } from './BookmarkModule/BookmarkButton.js';
import { BookmarkPanel } from './BookmarkModule/BookmarkPanel.js';
import { BookmarkSidebar } from './BookmarkModule/BookmarkSidebar.js';
import IconLibrary from '../components/primitives/IconLibrary.js';
import { CategorySelector } from './BookmarkModule/CategorySelector.js';
import { MODULE_CONSTANTS } from '../config/ModuleConstants.js';

const BOOKMARK_CONFIG = MODULE_CONSTANTS.bookmarks;

class BookmarkModule extends BaseModule {
  constructor() {
    super('bookmarks');
    this.chromeMessageListener = null;

    this.buttonManager = new BookmarkButton(this.dom, () => this.getTheme());
    // Lazy initialization for panels (created on first use)
    this._panel = null;
    this._sidebar = null;
    this._categorySelector = null;
  }

  // Lazy getters for panels
  get panel() {
    if (!this._panel) {
      this._panel = new BookmarkPanel(
        this.dom,
        () => this.getTheme(),
        key => this.getSetting(key)
      );
    }
    return this._panel;
  }

  get sidebar() {
    if (!this._sidebar) {
      this._sidebar = new BookmarkSidebar(this.dom, () => this.getTheme());
    }
    return this._sidebar;
  }

  get categorySelector() {
    if (!this._categorySelector) {
      this._categorySelector = new CategorySelector(this.dom);
    }
    return this._categorySelector;
  }

  async init() {
    await super.init();
    if (!this.enabled) {
      return;
    }

    this.log('Bookmarks başlatılıyor...');

    FixedButtonMixin.enhance(this);

    await bookmarkStore.setStorageType(BOOKMARK_CONFIG.storageType);
    const bookmarks = await bookmarkStore.getAll();
    this.log(`Loaded ${bookmarks.length} bookmarks`);

    this.panel.create(() => this.togglePanel());
    this.sidebar.inject();
    await this.addBookmarkButtons();

    // Subscribe to MessageHub for content changes (replaces MessageObserver + VersionManager)
    this.subscribe(Events.HUB_CONTENT_CHANGED, async () => {
      await this.addBookmarkButtons();
      await this.updateUI();
    });

    if (BOOKMARK_CONFIG.keyboardShortcuts) {
      this.setupKeyboardShortcuts();
    }

    this.chromeMessageListener = async message => {
      if (message.type === 'BOOKMARKS_UPDATED' || message.type === 'STORAGE_TYPE_CHANGED') {
        if (message.storageType) {
          await bookmarkStore.setStorageType(message.storageType);
        }
        await this.addBookmarkButtons();
        await this.updateUI();
      }
    };
    chrome.runtime.onMessage.addListener(this.chromeMessageListener);

    await this.createFixedButton({
      id: 'claude-bookmarks-fixed-btn',
      icon: IconLibrary.bookmark(false, 'currentColor', 20),
      tooltip: 'Bookmarks',
      position: { right: '30px', transform: 'translateY(-40px)' },
      onClick: () => this.togglePanel(),
      showCounter: true,
    });

    this.setupVisibilityListener();
    await this.updateUI();
    this.checkBookmarkNavigation();

    this.log(`✅ Bookmarks ready`);
  }

  clearUIElements() {
    this.buttonManager?.removeAll?.();
    this.panel.updateContent([]);
    this.sidebar.update([]);
    this.sidebar.inject();
  }

  async checkBookmarkNavigation() {
    const bookmarkId = new URLSearchParams(window.location.search).get('bookmark');
    if (!bookmarkId) {
      return;
    }

    const bookmark = await bookmarkStore.getById(bookmarkId);
    if (!bookmark) {
      this.clearBookmarkParam();
      return;
    }

    let bookmarkPath = bookmark.conversationUrl;
    if (bookmarkPath?.startsWith('http')) {
      bookmarkPath = new URL(bookmarkPath).pathname;
    }

    if (window.location.pathname === bookmarkPath) {
      this.waitForMessagesAndNavigate(bookmark, 0);
    } else if (bookmarkPath) {
      window.location.href = bookmarkPath + '?bookmark=' + bookmarkId;
    }
  }

  clearBookmarkParam() {
    const url = new URL(window.location.href);
    url.searchParams.delete('bookmark');
    window.history.replaceState({}, '', url.toString());
  }

  waitForMessagesAndNavigate(bookmark, retryCount, prevCount = 0, stableCount = 0) {
    const messages = this.dom.findMessages();
    const count = messages.length;

    if (count > 0 && count === prevCount) {
      if (stableCount >= 2) {
        this.navigateToBookmark(bookmark, true);
        this.clearBookmarkParam();
      } else {
        setTimeout(
          () => this.waitForMessagesAndNavigate(bookmark, retryCount + 1, count, stableCount + 1),
          500
        );
      }
    } else if (retryCount < 40) {
      setTimeout(() => this.waitForMessagesAndNavigate(bookmark, retryCount + 1, count, 0), 500);
    } else {
      if (count > 0) {
        this.navigateToBookmark(bookmark, true);
      }
      this.clearBookmarkParam();
    }
  }

  async addBookmarkButtons() {
    if (!this.dom.isOnConversationPage()) {
      return;
    }

    const messages = this.dom.findMessages();
    if (messages.length === 0) {
      return;
    }

    const bookmarks = await bookmarkStore.getByConversation(window.location.pathname);

    // Get currently visible bookmarks (content matched)
    const validBookmarks = getValidMarkers(bookmarks, messages, { strictMode: false });
    const bookmarkedIndices = new Set(
      validBookmarks.map(item => item.resolvedIndex).filter(i => i !== null)
    );

    this.buttonManager.addToMessages(
      messages,
      (msg, idx) => idx,
      async idx => bookmarkedIndices.has(idx),
      async (msgElement, idx) => await this.toggleBookmarkByIndex(msgElement, idx)
    );
  }

  /**
   * Toggle bookmark - check by content signature, not just index
   * NOW: Opens CategorySelector instead of immediate toggle
   */
  async toggleBookmarkByIndex(messageElement, index) {
    const currentSignature = generateSignature(messageElement);
    const bookmarks = await bookmarkStore.getByConversation(window.location.pathname);

    // Find bookmark that matches THIS message's content (not just index)
    const existingBookmark = bookmarks.find(b => b.contentSignature === currentSignature);
    const buttonElement = this.buttonManager.get(messageElement);

    if (existingBookmark) {
      // If exists, show selector to change category or remove
      this.categorySelector.show(
        buttonElement, // Target element for popover
        existingBookmark.categoryId || 'default', // Current category
        async newCategoryId => {
          // On Select Category
          if (newCategoryId !== existingBookmark.categoryId) {
            await bookmarkStore.update(existingBookmark.id, { categoryId: newCategoryId });
            await this.updateUI();
            this.log(`Updated bookmark category to ${newCategoryId}`);
          }
        },
        async () => {
          // On Remove
          this.log(`Removing bookmark for message at index ${index}`);
          await this.deleteBookmark(existingBookmark.id);
        }
      );
    } else {
      // If new, show selector to choose category
      this.categorySelector.show(
        buttonElement,
        'default', // Default selected
        async categoryId => {
          // On Select
          this.log(`Adding bookmark for message at index ${index} with category ${categoryId}`);
          await this.addBookmark(messageElement, index, categoryId);
        }
      );
    }
  }

  async addBookmark(messageElement, messageIndex, categoryId = 'default') {
    const cleanText = getCleanMessageText(messageElement);

    // Capture HTML content
    // We specifically want the message content div
    const messageContent = messageElement.querySelector('.font-claude-message');
    let fullHtml = '';

    if (messageContent) {
      // Clone to avoid modifying live DOM
      const clone = messageContent.cloneNode(true);

      // Clean up unwanted elements before saving
      const selectors = [
        '.claude-expand-footer',
        '.claude-expand-button-container',
        '.claude-expand-btn',
        '.absolute.bottom-0.right-2',
        '[data-testid="action-bar-copy"]',
        'button[aria-label="Copy"]',
        'button[aria-label="Give positive feedback"]',
        'button[aria-label="Give negative feedback"]',
        '.group\\/btn',
      ];

      const toRemove = clone.querySelectorAll(selectors.join(', '));
      toRemove.forEach(el => el.remove());

      fullHtml = clone.innerHTML;
    } else {
      fullHtml = messageElement.innerHTML;
    }

    // Determine sender
    // User provided snippet shows: <div data-testid="user-message" class="... !font-user-message ...">
    // Previous check for '.font-user-message' failed likely due to '!' prefix or DOM structure

    const hasUserTestId = messageElement.querySelector('[data-testid="user-message"]') !== null;
    const hasUserAvatar =
      messageElement.querySelector('.bg-text-200.text-bg-100.rounded-full') !== null; // Based on specific avatar classes in snippet

    const isUser = hasUserTestId || hasUserAvatar;
    const sender = isUser ? 'user' : 'assistant';

    const bookmark = {
      index: messageIndex,
      contentSignature: generateSignature(messageElement),
      previewText: cleanText.substring(0, 200),
      fullText: fullHtml, // Store HTML
      note: '',
      timestamp: Date.now(),
      conversationUrl: window.location.pathname,
      categoryId: categoryId,
      sender: sender,
    };

    await bookmarkStore.add(bookmark);
    this.log(`✅ Bookmark added at index ${messageIndex}`);

    await this.updateUI();
    await this.addBookmarkButtons();
  }

  async deleteBookmark(bookmarkId) {
    await bookmarkStore.remove(bookmarkId);
    this.log(`Bookmark deleted: ${bookmarkId}`);
    await this.updateUI();
    await this.addBookmarkButtons();
  }

  async getCurrentConversationBookmarks() {
    return await bookmarkStore.getByConversation(window.location.pathname);
  }

  async updateUI() {
    if (!this.lastConversationState) {
      return;
    }

    const messages = this.dom.findMessages();
    const bookmarks = await bookmarkStore.getByConversation(window.location.pathname);

    // Only show bookmarks whose messages exist
    const validBookmarks = getValidMarkers(bookmarks, messages, { strictMode: false });
    const resolvedBookmarks = validBookmarks.map(item => ({
      ...item.marker,
      index: item.resolvedIndex,
      _status: item.status,
    }));

    this.log(`🔖 Bookmarks: ${resolvedBookmarks.length} visible / ${bookmarks.length} in storage`);

    this.updateButtonCounter(resolvedBookmarks.length);
    this.panel.updateContent(
      resolvedBookmarks,
      b => this.navigateToBookmark(b),
      id => this.deleteBookmark(id)
    );
    this.sidebar.inject();
    this.sidebar.update(resolvedBookmarks, b => this.navigateToBookmark(b));
  }

  async waitAndUpdateUI() {
    let retries = 0;
    while (this.dom.findMessages().length === 0 && retries < 5) {
      await new Promise(r => setTimeout(r, 200 * Math.pow(1.5, retries)));
      retries++;
    }
    await this.updateUI();
    await this.addBookmarkButtons();
    this.sidebar.inject();
  }

  togglePanel() {
    if (this.panel.toggle()) {
      this.updateUI();
    }
  }

  navigateToBookmark(bookmark, fromUrl = false) {
    let bookmarkPath = bookmark.conversationUrl;
    if (bookmarkPath?.startsWith('http')) {
      bookmarkPath = new URL(bookmarkPath).pathname;
    }

    if (window.location.pathname !== bookmarkPath) {
      if (fromUrl && bookmarkPath) {
        window.location.href = bookmarkPath + '?bookmark=' + bookmark.id;
      }
      return;
    }

    const messages = this.dom.findMessages();
    if (messages.length === 0) {
      return;
    }

    const result = resolveMarkerIndex(bookmark, messages, { strictMode: false });

    if (result.index !== null && result.message) {
      this.dom.scrollToElement(result.message, 'center');
      this.dom.flashClass(result.message, 'claude-nav-highlight', 2000);
      if (this.panel?.elements?.panel?.style.display === 'flex') {
        this.panel.toggle();
      }
    } else if (!fromUrl && confirm('Bookmarked message not found. Delete?')) {
      this.deleteBookmark(bookmark.id);
    }
  }

  setupKeyboardShortcuts() {
    const handler = e => {
      if (e.altKey && e.shiftKey && e.key === 'B') {
        e.preventDefault();
        this.togglePanel();
      }
      if (e.altKey && !e.shiftKey && e.key === 'b') {
        e.preventDefault();
        this.toggleCurrentMessageBookmark();
      }
    };
    document.addEventListener('keydown', handler);
    this.unsubscribers.push(() => document.removeEventListener('keydown', handler));
  }

  toggleCurrentMessageBookmark() {
    const messages = this.dom.findMessages();
    const idx = this.dom.getCurrentVisibleMessageIndex();
    if (idx >= 0 && idx < messages.length) {
      this.toggleBookmarkByIndex(messages[idx], idx);
    }
  }

  async onSettingsChanged(settings) {
    if (settings.position) {
      this.panel.updatePosition(settings.position);
    }
    if (settings.storageType) {
      await bookmarkStore.setStorageType(settings.storageType);
      await this.updateUI();
    }
    if (this.settingsChanged(['colorTheme', 'customColor'], settings)) {
      await this.recreateUI();
    }
  }

  async recreateUI() {
    this.panel.destroy();
    this.buttonManager?.removeAll?.();
    this.panel.create(() => this.togglePanel());
    await this.addBookmarkButtons();
    await this.updateUI();
  }

  async destroy() {
    if (this.chromeMessageListener) {
      chrome.runtime.onMessage.removeListener(this.chromeMessageListener);
    }
    this.buttonManager?.removeAll?.();
    this.panel.destroy();
    this.sidebar.destroy();
    // Note: MessageHub subscriptions are automatically cleaned up by BaseModule.destroy()
    super.destroy();
  }
}

export default BookmarkModule;
