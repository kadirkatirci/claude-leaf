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
import MessageObserverMixin from '../core/MessageObserverMixin.js';
import { getCleanMessageText, generateSignature, getValidMarkers, resolveMarkerIndex } from '../utils/MarkerUtils.js';
import { bookmarkStore } from '../stores/index.js';
import { BookmarkButton } from './BookmarkModule/BookmarkButton.js';
import { BookmarkPanel } from './BookmarkModule/BookmarkPanel.js';
import { BookmarkSidebar } from './BookmarkModule/BookmarkSidebar.js';
import IconLibrary from '../components/primitives/IconLibrary.js';
import EditScanner from './EditHistoryModule/EditScanner.js';
import { CategorySelector } from './BookmarkModule/CategorySelector.js';

class BookmarkModule extends BaseModule {
  constructor() {
    super('bookmarks');
    this.versionChangeUnsubscribe = null;
    this.chromeMessageListener = null;

    this.buttonManager = new BookmarkButton(this.dom, () => this.getTheme());
    this.panel = new BookmarkPanel(this.dom, () => this.getTheme(), (key) => this.getSetting(key));
    this.sidebar = new BookmarkSidebar(this.dom, () => this.getTheme());
    this.categorySelector = new CategorySelector(this.dom);
  }

  async init() {
    await super.init();
    if (!this.enabled) return;

    this.log('Bookmarks başlatılıyor...');

    FixedButtonMixin.enhance(this);
    MessageObserverMixin.enhance(this);

    await bookmarkStore.setStorageType('local');
    const bookmarks = await bookmarkStore.getAll();
    this.log(`Loaded ${bookmarks.length} bookmarks`);

    this.panel.create(() => this.togglePanel());
    this.sidebar.inject();
    await this.addBookmarkButtons();

    this.setupMessageObserver(async () => {
      await this.addBookmarkButtons();
      await this.updateUI();
    }, { throttleDelay: 500, trackMessageCount: true, checkConversationPage: true });

    if (await this.getSetting('keyboardShortcuts')) {
      this.setupKeyboardShortcuts();
    }

    this.subscribe(Events.MESSAGES_UPDATED, async () => {
      await this.addBookmarkButtons();
      await this.updateUI();
    });

    this.registerForVersionChanges();

    this.chromeMessageListener = async (message) => {
      if (message.type === 'BOOKMARKS_UPDATED' || message.type === 'STORAGE_TYPE_CHANGED') {
        if (message.storageType) await bookmarkStore.setStorageType(message.storageType);
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
      showCounter: true
    });

    this.setupVisibilityListener();
    await this.updateUI();
    this.checkBookmarkNavigation();

    this.log(`✅ Bookmarks ready`);
  }

  registerForVersionChanges() {
    const tryRegister = () => {
      const scanner = EditScanner.getInstance();
      if (scanner) {
        this.versionChangeUnsubscribe = scanner.onVersionChange(async () => {
          await this.addBookmarkButtons();
          await this.updateUI();
        });
      } else {
        setTimeout(tryRegister, 100);
      }
    };
    tryRegister();
  }

  clearUIElements() {
    this.buttonManager?.removeAll?.();
    this.panel.updateContent([]);
    this.sidebar.update([]);
    this.sidebar.inject();
  }

  async checkBookmarkNavigation() {
    const bookmarkId = new URLSearchParams(window.location.search).get('bookmark');
    if (!bookmarkId) return;

    const bookmark = await bookmarkStore.getById(bookmarkId);
    if (!bookmark) {
      this.clearBookmarkParam();
      return;
    }

    let bookmarkPath = bookmark.conversationUrl;
    if (bookmarkPath?.startsWith('http')) bookmarkPath = new URL(bookmarkPath).pathname;

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
        setTimeout(() => this.waitForMessagesAndNavigate(bookmark, retryCount + 1, count, stableCount + 1), 500);
      }
    } else if (retryCount < 40) {
      setTimeout(() => this.waitForMessagesAndNavigate(bookmark, retryCount + 1, count, 0), 500);
    } else {
      if (count > 0) this.navigateToBookmark(bookmark, true);
      this.clearBookmarkParam();
    }
  }

  async addBookmarkButtons() {
    if (!this.dom.isOnConversationPage()) return;

    const messages = this.dom.findMessages();
    if (messages.length === 0) return;

    const bookmarks = await bookmarkStore.getByConversation(window.location.pathname);

    // Get currently visible bookmarks (content matched)
    const validBookmarks = getValidMarkers(bookmarks, messages, { strictMode: false });
    const bookmarkedIndices = new Set(validBookmarks.map(item => item.resolvedIndex).filter(i => i !== null));

    this.buttonManager.addToMessages(
      messages,
      (msg, idx) => idx,
      async (idx) => bookmarkedIndices.has(idx),
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
        async (newCategoryId) => { // On Select Category
          if (newCategoryId !== existingBookmark.categoryId) {
            await bookmarkStore.update(existingBookmark.id, { categoryId: newCategoryId });
            await this.updateUI();
            this.log(`Updated bookmark category to ${newCategoryId}`);
          }
        },
        async () => { // On Remove
          this.log(`Removing bookmark for message at index ${index}`);
          await this.deleteBookmark(existingBookmark.id);
        }
      );
    } else {
      // If new, show selector to choose category
      this.categorySelector.show(
        buttonElement,
        'default', // Default selected
        async (categoryId) => { // On Select
          this.log(`Adding bookmark for message at index ${index} with category ${categoryId}`);
          await this.addBookmark(messageElement, index, categoryId);
        }
      );
    }
  }

  async addBookmark(messageElement, messageIndex, categoryId = 'default') {
    const fullText = getCleanMessageText(messageElement); // Currently returns truncated text? No, getCleanMessageText returns full text usually.
    // Wait, let's verify getCleanMessageText. 
    // Usually it returns full text. The previous code was doing .substring(0, 200) manually for preview.

    // We will save FULL text separately.

    const bookmark = {
      index: messageIndex,
      contentSignature: generateSignature(messageElement),
      previewText: fullText.substring(0, 200),
      fullText: fullText, // Save full text
      note: '',
      timestamp: Date.now(),
      conversationUrl: window.location.pathname,
      categoryId: categoryId // Save category
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
    if (!this.lastConversationState) return;

    const messages = this.dom.findMessages();
    const bookmarks = await bookmarkStore.getByConversation(window.location.pathname);

    // Only show bookmarks whose messages exist
    const validBookmarks = getValidMarkers(bookmarks, messages, { strictMode: false });
    const resolvedBookmarks = validBookmarks.map(item => ({
      ...item.marker,
      index: item.resolvedIndex,
      _status: item.status
    }));

    this.log(`🔖 Bookmarks: ${resolvedBookmarks.length} visible / ${bookmarks.length} in storage`);

    this.updateButtonCounter(resolvedBookmarks.length);
    this.panel.updateContent(resolvedBookmarks, (b) => this.navigateToBookmark(b), (id) => this.deleteBookmark(id));
    this.sidebar.inject();
    this.sidebar.update(resolvedBookmarks, (b) => this.navigateToBookmark(b));
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
    if (this.panel.toggle()) this.updateUI();
  }

  navigateToBookmark(bookmark, fromUrl = false) {
    let bookmarkPath = bookmark.conversationUrl;
    if (bookmarkPath?.startsWith('http')) bookmarkPath = new URL(bookmarkPath).pathname;

    if (window.location.pathname !== bookmarkPath) {
      if (fromUrl && bookmarkPath) window.location.href = bookmarkPath + '?bookmark=' + bookmark.id;
      return;
    }

    const messages = this.dom.findMessages();
    if (messages.length === 0) return;

    const result = resolveMarkerIndex(bookmark, messages, { strictMode: false });

    if (result.index !== null && result.message) {
      this.dom.scrollToElement(result.message, 'center');
      this.dom.flashClass(result.message, 'claude-nav-highlight', 2000);
      if (this.panel?.elements?.panel?.style.display === 'flex') this.panel.toggle();
    } else if (!fromUrl && confirm('Bookmarked message not found. Delete?')) {
      this.deleteBookmark(bookmark.id);
    }
  }

  setupKeyboardShortcuts() {
    const handler = (e) => {
      if (e.altKey && e.shiftKey && e.key === 'B') { e.preventDefault(); this.togglePanel(); }
      if (e.altKey && !e.shiftKey && e.key === 'b') { e.preventDefault(); this.toggleCurrentMessageBookmark(); }
    };
    document.addEventListener('keydown', handler);
    this.unsubscribers.push(() => document.removeEventListener('keydown', handler));
  }

  toggleCurrentMessageBookmark() {
    const messages = this.dom.findMessages();
    const idx = this.dom.getCurrentVisibleMessageIndex();
    if (idx >= 0 && idx < messages.length) this.toggleBookmarkByIndex(messages[idx], idx);
  }

  async onSettingsChanged(settings) {
    if (settings.position) this.panel.updatePosition(settings.position);
    if (settings.storageType) {
      await bookmarkStore.setStorageType(settings.storageType);
      await this.updateUI();
    }
    if (this.settingsChanged(['colorTheme', 'customColor'], settings)) await this.recreateUI();
  }

  async recreateUI() {
    this.panel.destroy();
    this.buttonManager?.removeAll?.();
    this.panel.create(() => this.togglePanel());
    await this.addBookmarkButtons();
    await this.updateUI();
  }

  async destroy() {
    this.versionChangeUnsubscribe?.();
    if (this.chromeMessageListener) chrome.runtime.onMessage.removeListener(this.chromeMessageListener);
    this.destroyMessageObserver();
    this.buttonManager?.removeAll?.();
    this.panel.destroy();
    this.sidebar.destroy();
    super.destroy();
  }
}

export default BookmarkModule;
