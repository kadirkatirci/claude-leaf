/**
 * BookmarkModule - Main coordinator for bookmark functionality
 * Uses smaller, maintainable sub-modules for different concerns
 */
import BaseModule from './BaseModule.js';
import { Events } from '../utils/EventBus.js';
import FixedButtonMixin from '../core/FixedButtonMixin.js';
import MessageObserverMixin from '../core/MessageObserverMixin.js';
import { hashString } from '../utils/HashUtils.js';
import { bookmarkStore } from '../stores/index.js';
import { BookmarkButton } from './BookmarkModule/BookmarkButton.js';
import { BookmarkPanel } from './BookmarkModule/BookmarkPanel.js';
import { BookmarkSidebar } from './BookmarkModule/BookmarkSidebar.js';

class BookmarkModule extends BaseModule {
  constructor() {
    super('bookmarks');

    this.observerTimeout = null;
    this.observer = null;
    this.visibilityUnsubscribe = null;
    this.lastConversationState = null;

    // Initialize sub-modules
    this.buttonManager = new BookmarkButton(this.dom, () => this.getTheme());
    this.panel = new BookmarkPanel(this.dom, () => this.getTheme(), (key) => this.getSetting(key));
    this.sidebar = new BookmarkSidebar(this.dom, () => this.getTheme());
  }

  async init() {
    await super.init();

    if (!this.enabled) return;

    this.log('Bookmarks başlatılıyor...');

    // Enhance with mixins
    FixedButtonMixin.enhance(this);
    MessageObserverMixin.enhance(this);

    // Set storage type from settings
    const storageType = await this.getSetting('storageType') || 'local';
    await bookmarkStore.setStorageType(storageType);

    // Bookmarks are loaded from store automatically, no migration needed
    // (Migration happens in store via version system)
    const bookmarks = await bookmarkStore.getAll();
    this.log(`Loaded ${bookmarks.length} bookmarks from store`);

    // Create UI
    this.panel.create(() => this.togglePanel());

    // Inject sidebar
    this.sidebar.inject();

    // Add bookmark buttons to messages
    await this.addBookmarkButtons();

    // Setup message observer
    this.setupMessageObserver(async () => {
      await this.addBookmarkButtons();
    }, {
      throttleDelay: 500,
      trackMessageCount: true,
      checkConversationPage: true
    });

    // Setup keyboard shortcuts
    if (await this.getSetting('keyboardShortcuts')) {
      this.setupKeyboardShortcuts();
    }

    // Listen for message updates
    this.subscribe(Events.MESSAGES_UPDATED, async () => {
      await this.addBookmarkButtons();
      // Only update counter, no need to update full UI on message updates
      const currentBookmarks = await this.getCurrentConversationBookmarks();
      this.panel.updateCounter(currentBookmarks.length);
    });

    // Listen for bookmark updates from popup
    chrome.runtime.onMessage.addListener(async (message) => {
      if (message.type === 'BOOKMARKS_UPDATED') {
        this.log('Bookmarks updated from popup (import)');
        await this.reloadBookmarks();
      } else if (message.type === 'STORAGE_TYPE_CHANGED') {
        this.log('Storage type changed:', message.storageType);
        await bookmarkStore.setStorageType(message.storageType);
        await this.reloadBookmarks();
      }
    });

    // Create fixed position button using FixedButtonMixin
    await this.createFixedButton({
      id: 'claude-bookmarks-fixed-btn',
      icon: '🔖',
      tooltip: 'Bookmarks',
      position: { right: '30px', transform: 'translateY(-40px)' },
      onClick: () => this.togglePanel(),
      showCounter: true
    });

    // Setup visibility listener from mixin
    this.setupVisibilityListener();

    // Mixin handles visibility changes, but we keep this for backward compatibility
    // The mixin will call clearUIElements() and updateUI() automatically

    // Initial UI update
    this.updateUI();

    // Check if navigating from bookmarks page
    this.checkBookmarkNavigation();

    this.log(`✅ ${bookmarks.length} bookmarks loaded`);
  }

  /**
   * Clear UI elements (called by FixedButtonMixin on page change)
   */
  clearUIElements() {
    this.log('Clearing bookmark UI elements');
    // Clear bookmark buttons from messages
    if (this.buttonManager && typeof this.buttonManager.removeAll === 'function') {
      this.buttonManager.removeAll();
    }
    // Clear panel and sidebar
    this.panel.updateContent([]);
    this.sidebar.update([]);
  }

  /**
   * Check if we need to navigate to a specific bookmark from URL
   */
  async checkBookmarkNavigation() {
    const urlParams = new URLSearchParams(window.location.search);
    const bookmarkId = urlParams.get('bookmark');

    if (bookmarkId) {
      this.log('Navigating to bookmark from URL:', bookmarkId);

      const bookmark = await bookmarkStore.getById(bookmarkId);
      if (!bookmark) {
        this.warn('Bookmark not found:', bookmarkId);
        // Clean up URL
        const url = new URL(window.location.href);
        url.searchParams.delete('bookmark');
        window.history.replaceState({}, '', url.toString());
        return;
      }

      // Check if we're already on the correct conversation page
      const currentPath = window.location.pathname;

      // Handle both old and new bookmark formats
      let bookmarkPath = bookmark.conversationUrl;
      if (bookmark.conversationUrl && bookmark.conversationUrl.startsWith('http')) {
        try {
          const url = new URL(bookmark.conversationUrl);
          bookmarkPath = url.pathname;
        } catch (e) {
          bookmarkPath = bookmark.conversationUrl;
        }
      }

      if (currentPath === bookmarkPath) {
        // Same page, just wait for messages and navigate
        this.log('Already on correct page, waiting for messages...');
        this.waitForMessagesAndNavigate(bookmark, 0);
      } else {
        // Different page, redirect first (the URL param will be preserved)
        this.log('Redirecting to conversation from:', currentPath, 'to:', bookmarkPath);

        // Redirect to the correct conversation with bookmark parameter
        if (bookmarkPath.startsWith('/')) {
          window.location.href = bookmarkPath + '?bookmark=' + bookmarkId;
        } else if (bookmarkPath.startsWith('http')) {
          window.location.href = bookmarkPath + '?bookmark=' + bookmarkId;
        }
        return; // Let the page redirect happen
      }
    }
  }

  /**
   * Wait for messages to load AND stabilize, then navigate to bookmark
   */
  waitForMessagesAndNavigate(bookmark, retryCount, previousCount = 0, stableCount = 0) {
    const maxRetries = 40; // Try for up to 20 seconds (40 * 500ms)
    const retryDelay = 500;
    const requiredStableChecks = 3; // Message count must be stable for 3 checks (1.5 seconds)

    const messages = this.dom.findMessages();
    const currentCount = messages.length;

    this.log(`[Retry ${retryCount}] Messages: ${currentCount} (previous: ${previousCount}, stable: ${stableCount}/${requiredStableChecks})`);

    // Check if message count has stabilized
    if (currentCount > 0 && currentCount === previousCount) {
      // Message count hasn't changed, increment stable counter
      const newStableCount = stableCount + 1;

      if (newStableCount >= requiredStableChecks) {
        // Message count is stable! Safe to navigate
        this.log(`✅ Messages stabilized at ${currentCount}. Navigating now...`);

        // Navigate immediately
        this.navigateToBookmark(bookmark, true);

        // Clean up URL
        setTimeout(() => {
          const url = new URL(window.location.href);
          url.searchParams.delete('bookmark');
          window.history.replaceState({}, '', url.toString());
        }, 100);
      } else {
        // Keep checking for stability
        this.log(`⏳ Messages stable (${newStableCount}/${requiredStableChecks})...`);
        setTimeout(() => {
          this.waitForMessagesAndNavigate(bookmark, retryCount + 1, currentCount, newStableCount);
        }, retryDelay);
      }
    } else if (retryCount < maxRetries) {
      // Message count changed or still at 0, reset stability counter
      if (currentCount > 0 && currentCount !== previousCount) {
        this.log(`⏳ Messages still loading (${previousCount} → ${currentCount})...`);
      }
      setTimeout(() => {
        this.waitForMessagesAndNavigate(bookmark, retryCount + 1, currentCount, 0);
      }, retryDelay);
    } else {
      // Give up after max retries
      this.warn('❌ Timed out waiting for messages to stabilize');
      this.warn(`Last count: ${currentCount}, never stabilized`);

      // Try to navigate anyway with what we have
      if (currentCount > 0) {
        this.warn('⚠️ Attempting navigation with unstable message count...');
        this.navigateToBookmark(bookmark, true);
      }

      // Clean up URL
      const url = new URL(window.location.href);
      url.searchParams.delete('bookmark');
      window.history.replaceState({}, '', url.toString());
    }
  }

  /**
   * Reload bookmarks from storage
   */
  async reloadBookmarks() {
    const bookmarks = await bookmarkStore.getAll();
    this.log('📚 Reloaded bookmarks:', bookmarks.map(b => ({
      id: b.id,
      index: b.index,
      preview: b.previewText?.substring(0, 50)
    })));
    await this.addBookmarkButtons();
    await this.updateUI();
  }

  /**
   * Add bookmark buttons to all messages
   */
  async addBookmarkButtons() {
    // Check if we're on conversation page
    if (!this.dom.isOnConversationPage()) {
      this.log('❌ Not on conversation page, skipping bookmark buttons');
      return;
    }

    // findMessages now automatically uses findActualMessages
    const messages = this.dom.findMessages();

    if (messages.length === 0) {
      this.log('❌ No actual messages found');
      return;
    }

    this.log(`✅ Adding bookmark buttons to ${messages.length} messages`);

    this.buttonManager.addToMessages(
      messages,
      (msg, idx) => idx, // Use simple index as ID
      async (idx) => await this.isMessageBookmarkedByIndex(idx),
      async (msgElement, idx) => await this.toggleBookmarkByIndex(msgElement, idx)
    );
  }

  /**
   * Toggle bookmark by index
   */
  async toggleBookmarkByIndex(messageElement, index) {
    const existing = await this.findBookmarkByIndex(index);

    if (existing) {
      // Remove bookmark
      this.log('Removing bookmark at index:', index);
      await this.deleteBookmark(existing.id);
    } else {
      // Add bookmark
      this.log('Adding bookmark at index:', index);
      await this.addBookmark(messageElement, index);
    }
  }

  /**
   * Check if message at index is bookmarked
   */
  async isMessageBookmarkedByIndex(index) {
    const messages = this.dom.findMessages();
    if (index >= messages.length) return false;

    const bookmark = await this.findBookmarkByIndex(index);
    return bookmark !== null;
  }

  /**
   * Find bookmark by index (current conversation only)
   * Simplified like emoji marker - no content verification for stability
   */
  async findBookmarkByIndex(index) {
    const currentPath = window.location.pathname;
    const bookmarks = await bookmarkStore.getByConversation(currentPath);

    // Find bookmark at this index in current conversation
    const bookmark = bookmarks.find(b => b.index === index);

    return bookmark || null;
  }

  /**
   * Get clean text content (excluding bookmark button)
   */
  getCleanMessageText(messageElement) {
    // Clone the element to avoid modifying the original
    const clone = messageElement.cloneNode(true);

    // Remove bookmark button from clone
    const bookmarkBtn = clone.querySelector('.claude-bookmark-btn');
    if (bookmarkBtn) {
      bookmarkBtn.remove();
    }

    return clone.textContent.trim();
  }

  /**
   * Add a bookmark
   */
  async addBookmark(messageElement, messageIndex) {
    const fullText = this.getCleanMessageText(messageElement);
    const previewText = fullText.substring(0, 200);
    const contentSignature = hashString(fullText.substring(0, 1000));

    // Use pathname for consistency
    const conversationPath = window.location.pathname;

    const bookmark = {
      index: messageIndex, // Array index of the message
      contentSignature: contentSignature, // Hash of content for verification
      previewText: previewText,
      note: '',
      timestamp: Date.now(),
      conversationUrl: conversationPath,
    };

    // Add to store (handles duplicate check internally)
    await bookmarkStore.add(bookmark);

    this.log('✅ Bookmark added:', {
      index: bookmark.index,
      preview: previewText.substring(0, 50)
    });

    // Update UI
    await this.updateUI();
    await this.addBookmarkButtons(); // Refresh buttons
  }

  /**
   * Delete a bookmark
   */
  async deleteBookmark(bookmarkId) {
    await bookmarkStore.remove(bookmarkId);

    // Update UI
    await this.updateUI();
    await this.addBookmarkButtons(); // Refresh buttons

    this.log('Bookmark deleted:', bookmarkId);
  }

  /**
   * Get bookmarks for current conversation
   */
  async getCurrentConversationBookmarks() {
    const currentPath = window.location.pathname;
    return await bookmarkStore.getByConversation(currentPath);
  }

  /**
   * Update all UI components
   */
  async updateUI() {
    // Don't update if not on conversation page
    if (!this.lastConversationState) return;

    // Only show bookmarks for current conversation
    const currentBookmarks = await this.getCurrentConversationBookmarks();

    // Update counter using mixin method
    this.updateButtonCounter(currentBookmarks.length);

    this.panel.updateContent(
      currentBookmarks,
      (bookmark) => this.navigateToBookmark(bookmark),
      (id) => this.deleteBookmark(id)
    );
    this.sidebar.update(
      currentBookmarks,
      (bookmark) => this.navigateToBookmark(bookmark)
    );
  }

  /**
   * Toggle panel visibility
   */
  togglePanel() {
    const isVisible = this.panel.toggle();
    if (isVisible) {
      this.updateUI();
    }
  }

  /**
   * Navigate to a bookmarked message - ROBUST approach
   * @param {Object} bookmark - The bookmark to navigate to
   * @param {Boolean} fromUrlNavigation - True if coming from bookmarks page (suppress error dialogs)
   */
  navigateToBookmark(bookmark, fromUrlNavigation = false) {
    // First check if we're on the correct conversation page
    const currentPath = window.location.pathname;

    // Handle both old and new bookmark formats
    let bookmarkPath = bookmark.conversationUrl;
    if (bookmark.conversationUrl && bookmark.conversationUrl.startsWith('http')) {
      try {
        const url = new URL(bookmark.conversationUrl);
        bookmarkPath = url.pathname;
      } catch (e) {
        bookmarkPath = bookmark.conversationUrl;
      }
    }

    if (currentPath !== bookmarkPath) {
      this.warn('❌ Wrong conversation! Current:', currentPath, 'Bookmark:', bookmarkPath);

      // If navigating from bookmarks page, open the correct conversation
      if (fromUrlNavigation && bookmarkPath) {
        window.location.href = bookmarkPath + '?bookmark=' + bookmark.id;
        return;
      }

      this.warn('This bookmark belongs to a different conversation.');
      return;
    }

    const messages = this.dom.findMessages();
    let foundMessage = null;
    let matchStrategy = null;

    if (messages.length === 0) {
      this.warn('❌ No messages found on page yet!');
      if (!fromUrlNavigation) {
        alert('No messages loaded yet. Please wait for the page to load.');
      }
      return;
    }

    this.log(`Searching for bookmark in ${messages.length} messages`);
    this.log(`Looking for index ${bookmark.index} with preview: "${bookmark.previewText.substring(0, 50)}..."`);

    // Strategy 1: Direct index match with fuzzy text verification
    if (bookmark.index !== undefined && bookmark.index < messages.length) {
      const candidateMessage = messages[bookmark.index];
      const cleanText = this.getCleanMessageText(candidateMessage);

      // Use first 100 chars for fuzzy matching (more forgiving)
      const candidatePreview = cleanText.substring(0, 100).toLowerCase().trim();
      const bookmarkPreview = bookmark.previewText.substring(0, 100).toLowerCase().trim();

      this.log(`Index ${bookmark.index} preview: "${candidatePreview.substring(0, 50)}..."`);

      // If first 50 chars match, it's the right message
      if (candidatePreview.substring(0, 50) === bookmarkPreview.substring(0, 50)) {
        foundMessage = candidateMessage;
        matchStrategy = 'index+preview';
        this.log('✅ Found by index with preview match');
      } else {
        this.log(`Preview mismatch at index ${bookmark.index}`);
      }
    }

    // Strategy 2: Search ALL messages by preview text
    if (!foundMessage) {
      this.log('Searching all messages by preview text...');
      const searchText = bookmark.previewText.substring(0, 100).toLowerCase().trim();

      for (let i = 0; i < messages.length; i++) {
        const msg = messages[i];
        const cleanText = this.getCleanMessageText(msg);
        const msgPreview = cleanText.substring(0, 100).toLowerCase().trim();

        // Match first 50 chars
        if (msgPreview.substring(0, 50) === searchText.substring(0, 50)) {
          foundMessage = msg;
          matchStrategy = 'preview-search';
          this.log(`✅ Found by preview search at index: ${i}`);
          break;
        }
      }
    }

    // Strategy 3: Fallback - just use the index if it exists
    if (!foundMessage && bookmark.index !== undefined && bookmark.index < messages.length) {
      this.warn('⚠️ Using fallback: navigating to index without verification');
      foundMessage = messages[bookmark.index];
      matchStrategy = 'index-fallback';
    }

    // Navigate if found
    if (foundMessage) {
      this.log(`✅ Navigation successful using ${matchStrategy}`);
      this.dom.scrollToElement(foundMessage, 'center');
      this.dom.flashClass(foundMessage, 'claude-nav-highlight', 2000);

      // Close panel if open
      if (this.panel && this.panel.elements.panel && this.panel.elements.panel.style.display === 'flex') {
        this.panel.toggle();
      }
      return;
    }

    // Message not found
    this.warn('❌ Bookmarked message not found on this page');
    this.warn('Bookmark details:', {
      index: bookmark.index,
      preview: bookmark.previewText.substring(0, 100)
    });

    // Only show error dialog if NOT from URL navigation
    if (!fromUrlNavigation && confirm('Bookmarked message not found on this page. Delete bookmark?')) {
      this.deleteBookmark(bookmark.id);
    }
  }


  /**
   * Setup keyboard shortcuts
   */
  setupKeyboardShortcuts() {
    const handleKeydown = (e) => {
      // Alt + Shift + B - Toggle panel
      if (e.altKey && e.shiftKey && e.key === 'B') {
        e.preventDefault();
        this.togglePanel();
      }

      // Alt + B - Toggle bookmark for current message
      if (e.altKey && !e.shiftKey && e.key === 'b') {
        e.preventDefault();
        this.toggleCurrentMessageBookmark();
      }
    };

    document.addEventListener('keydown', handleKeydown);
    this.unsubscribers.push(() => document.removeEventListener('keydown', handleKeydown));

    this.log('Keyboard shortcuts active: Alt+B (toggle bookmark), Alt+Shift+B (panel)');
  }

  /**
   * Toggle bookmark for currently visible message
   */
  toggleCurrentMessageBookmark() {
    const messages = this.dom.findMessages();
    const currentIndex = this.dom.getCurrentVisibleMessageIndex();

    if (currentIndex < 0 || currentIndex >= messages.length) return;

    const message = messages[currentIndex];
    this.toggleBookmarkByIndex(message, currentIndex);
  }

  /**
   * Handle settings changes
   */
  async onSettingsChanged(settings) {
    this.log('Settings updated:', settings);

    // Update position
    if (settings.position) {
      this.panel.updatePosition(settings.position);
    }

    // Update storage type
    if (settings.storageType && settings.storageType !== bookmarkStore.getStorageType()) {
      await bookmarkStore.setStorageType(settings.storageType);
      await this.reloadBookmarks();
    }

    // Handle theme changes
    if (this.settingsChanged(['colorTheme', 'customColor'], settings)) {
      await this.recreateUI();
    }
  }

  /**
   * Recreate UI with new theme
   */
  async recreateUI() {
    this.log('Recreating UI with new theme...');

    // Destroy old UI
    this.panel.destroy();
    if (this.buttonManager && typeof this.buttonManager.removeAll === 'function') {
      this.buttonManager.removeAll();
    }

    // Recreate UI
    this.panel.create(() => this.togglePanel());
    await this.addBookmarkButtons();
    await this.updateUI();
  }


  /**
   * Cleanup
   */
  async destroy() {
    this.log('Destroying BookmarkModule...');

    // Unsubscribe from visibility changes
    if (this.visibilityUnsubscribe) {
      this.visibilityUnsubscribe();
      this.visibilityUnsubscribe = null;
    }

    // Destroy message observer
    this.destroyMessageObserver();

    // Clean up UI
    if (this.buttonManager && typeof this.buttonManager.removeAll === 'function') {
      this.buttonManager.removeAll();
    }
    this.panel.destroy();
    this.sidebar.destroy();

    super.destroy();
  }
}

export default BookmarkModule;
