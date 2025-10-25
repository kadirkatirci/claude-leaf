/**
 * BookmarkModule - Main coordinator for bookmark functionality
 * Uses smaller, maintainable sub-modules for different concerns
 */
import BaseModule from './BaseModule.js';
import { Events } from '../utils/EventBus.js';
import { BookmarkStorage } from './BookmarkModule/BookmarkStorage.js';
import { BookmarkButton } from './BookmarkModule/BookmarkButton.js';
import { BookmarkPanel } from './BookmarkModule/BookmarkPanel.js';
import { BookmarkSidebar } from './BookmarkModule/BookmarkSidebar.js';

class BookmarkModule extends BaseModule {
  constructor() {
    super('bookmarks');

    this.bookmarks = [];
    this.observerTimeout = null;
    this.observer = null;

    // Initialize sub-modules
    this.storage = new BookmarkStorage();
    this.buttonManager = new BookmarkButton(this.dom, () => this.getTheme());
    this.panel = new BookmarkPanel(this.dom, () => this.getTheme(), (key) => this.getSetting(key));
    this.sidebar = new BookmarkSidebar(this.dom, () => this.getTheme());
  }

  async init() {
    await super.init();

    if (!this.enabled) return;

    this.log('Bookmarks başlatılıyor...');

    // Load storage settings
    const storageType = this.getSetting('storageType') || 'local';
    this.storage.setStorageType(storageType);

    // Load bookmarks
    this.bookmarks = await this.storage.load();

    // Create UI
    this.panel.create(() => this.togglePanel());

    // Inject sidebar
    this.sidebar.inject();

    // Add bookmark buttons to messages
    this.addBookmarkButtons();

    // Observe DOM changes
    this.observeMessages();

    // Setup keyboard shortcuts
    if (this.getSetting('keyboardShortcuts')) {
      this.setupKeyboardShortcuts();
    }

    // Listen for message updates
    this.subscribe(Events.MESSAGES_UPDATED, () => {
      this.addBookmarkButtons();
      this.updateUI();
    });

    // Listen for bookmark updates from popup
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'BOOKMARKS_UPDATED') {
        this.log('Bookmarks updated from popup (import)');
        this.reloadBookmarks();
      } else if (message.type === 'STORAGE_TYPE_CHANGED') {
        this.log('Storage type changed:', message.storageType);
        this.storage.setStorageType(message.storageType);
        this.reloadBookmarks();
      }
    });

    // Initial UI update
    this.updateUI();

    // Check if navigating from bookmarks page
    this.checkBookmarkNavigation();

    this.log(`✅ ${this.bookmarks.length} bookmarks loaded`);
  }

  /**
   * Check if we need to navigate to a specific bookmark from URL
   */
  checkBookmarkNavigation() {
    const urlParams = new URLSearchParams(window.location.search);
    const bookmarkId = urlParams.get('bookmark');

    if (bookmarkId) {
      this.log('Navigating to bookmark from URL:', bookmarkId);

      const bookmark = this.bookmarks.find(b => b.id === bookmarkId);
      if (!bookmark) {
        this.warn('Bookmark not found:', bookmarkId);
        // Clean up URL
        const url = new URL(window.location.href);
        url.searchParams.delete('bookmark');
        window.history.replaceState({}, '', url.toString());
        return;
      }

      // Check if we're already on the correct conversation page
      const currentUrl = window.location.href.split('?')[0]; // Remove query params
      const bookmarkUrl = bookmark.conversationUrl.split('?')[0];

      if (currentUrl === bookmarkUrl) {
        // Same page, just wait for messages and navigate
        this.log('Already on correct page, waiting for messages...');
        this.waitForMessagesAndNavigate(bookmark, 0);
      } else {
        // Different page, redirect first (the URL param will be preserved)
        this.log('Redirecting to conversation:', bookmark.conversationUrl);
        // URL already has ?bookmark=X, so navigation will continue after redirect
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
    this.bookmarks = await this.storage.load();
    this.log('📚 Reloaded bookmarks:', this.bookmarks.map(b => ({
      id: b.id,
      messageId: b.messageId,
      renderCount: b.renderCount,
      preview: b.previewText.substring(0, 50)
    })));
    this.addBookmarkButtons();
    this.updateUI();
  }

  /**
   * Add bookmark buttons to all messages
   */
  addBookmarkButtons() {
    const allMessages = this.dom.findMessages();

    // Filter out sidebar elements and only keep actual chat messages
    const messages = allMessages.filter(msg => {
      // Exclude elements inside sidebar
      const isInSidebar = msg.closest('.flex.flex-col.overflow-y-auto.overflow-x-hidden') !== null ||
                          msg.closest('[data-testid="sidebar"]') !== null ||
                          msg.closest('nav') !== null;

      // Exclude our own bookmark sidebar section
      const isBookmarkSidebar = msg.closest('#claude-bookmarks-sidebar-list') !== null;

      return !isInSidebar && !isBookmarkSidebar;
    });

    this.buttonManager.addToMessages(
      messages,
      (msg, idx) => idx, // Use simple index as ID
      (idx) => this.isMessageBookmarkedByIndex(idx),
      (msgElement, idx) => this.toggleBookmarkByIndex(msgElement, idx)
    );
  }

  /**
   * Toggle bookmark by index
   */
  async toggleBookmarkByIndex(messageElement, index) {
    const existing = this.findBookmarkByIndex(index, messageElement);

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
  isMessageBookmarkedByIndex(index) {
    const messages = this.dom.findMessages();
    if (index >= messages.length) return false;

    const messageElement = messages[index];
    return this.findBookmarkByIndex(index, messageElement) !== null;
  }

  /**
   * Find bookmark by index and verify content (current conversation only)
   */
  findBookmarkByIndex(index, messageElement) {
    const cleanText = this.getCleanMessageText(messageElement);
    const contentSignature = this.hashText(cleanText.substring(0, 1000));
    const currentUrl = window.location.href;

    // Find bookmarks at this index in current conversation
    const candidateBookmarks = this.bookmarks.filter(b =>
      b.messageIndex === index && b.conversationUrl === currentUrl
    );

    // Verify content signature matches
    for (const bookmark of candidateBookmarks) {
      if (bookmark.contentSignature === contentSignature) {
        return bookmark;
      }
    }

    return null;
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
    const contentSignature = this.hashText(fullText.substring(0, 1000));

    const bookmark = {
      id: `bookmark-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      messageIndex: messageIndex, // Array index of the message
      contentSignature: contentSignature, // Hash of content for verification
      previewText: previewText,
      note: '',
      timestamp: Date.now(),
      conversationUrl: window.location.href,
    };

    this.bookmarks.push(bookmark);
    await this.storage.save(this.bookmarks);

    this.log('✅ Bookmark added:', {
      id: bookmark.id,
      messageIndex: bookmark.messageIndex,
      preview: previewText.substring(0, 50)
    });

    // Update UI
    this.updateUI();
    this.addBookmarkButtons(); // Refresh buttons
  }

  /**
   * Delete a bookmark
   */
  async deleteBookmark(bookmarkId) {
    this.bookmarks = this.bookmarks.filter(b => b.id !== bookmarkId);
    await this.storage.save(this.bookmarks);

    // Update UI
    this.updateUI();
    this.addBookmarkButtons(); // Refresh buttons

    this.log('Bookmark deleted:', bookmarkId);
  }

  /**
   * Get bookmarks for current conversation
   */
  getCurrentConversationBookmarks() {
    const currentUrl = window.location.href;
    // Match bookmarks for this specific conversation
    return this.bookmarks.filter(b => b.conversationUrl === currentUrl);
  }

  /**
   * Update all UI components
   */
  updateUI() {
    // Only show bookmarks for current conversation
    const currentBookmarks = this.getCurrentConversationBookmarks();

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
    const currentUrl = window.location.href.split('?')[0];
    const bookmarkUrl = bookmark.conversationUrl.split('?')[0];

    if (currentUrl !== bookmarkUrl) {
      this.warn('❌ Wrong conversation! Current:', currentUrl, 'Bookmark:', bookmarkUrl);
      this.warn('This bookmark belongs to a different conversation.');
      return; // Don't show error dialog, this is expected
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
    this.log(`Looking for index ${bookmark.messageIndex} with preview: "${bookmark.previewText.substring(0, 50)}..."`);

    // Strategy 1: Direct index match with fuzzy text verification
    if (bookmark.messageIndex !== undefined && bookmark.messageIndex < messages.length) {
      const candidateMessage = messages[bookmark.messageIndex];
      const cleanText = this.getCleanMessageText(candidateMessage);

      // Use first 100 chars for fuzzy matching (more forgiving)
      const candidatePreview = cleanText.substring(0, 100).toLowerCase().trim();
      const bookmarkPreview = bookmark.previewText.substring(0, 100).toLowerCase().trim();

      this.log(`Index ${bookmark.messageIndex} preview: "${candidatePreview.substring(0, 50)}..."`);

      // If first 50 chars match, it's the right message
      if (candidatePreview.substring(0, 50) === bookmarkPreview.substring(0, 50)) {
        foundMessage = candidateMessage;
        matchStrategy = 'index+preview';
        this.log('✅ Found by index with preview match');
      } else {
        this.log(`Preview mismatch at index ${bookmark.messageIndex}`);
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
    if (!foundMessage && bookmark.messageIndex !== undefined && bookmark.messageIndex < messages.length) {
      this.warn('⚠️ Using fallback: navigating to index without verification');
      foundMessage = messages[bookmark.messageIndex];
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
      index: bookmark.messageIndex,
      preview: bookmark.previewText.substring(0, 100)
    });

    // Only show error dialog if NOT from URL navigation
    if (!fromUrlNavigation && confirm('Bookmarked message not found on this page. Delete bookmark?')) {
      this.deleteBookmark(bookmark.id);
    }
  }

  /**
   * Hash text for identification
   */
  hashText(text) {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Observe DOM changes
   */
  observeMessages() {
    this.observer = this.dom.observeDOM(() => {
      clearTimeout(this.observerTimeout);
      this.observerTimeout = setTimeout(() => {
        this.addBookmarkButtons();
      }, 500);
    });
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
  onSettingsChanged(settings) {
    this.log('Settings updated:', settings);

    // Update position
    if (settings.position) {
      this.panel.updatePosition(settings.position);
    }

    // Update storage type
    if (settings.storageType && settings.storageType !== this.storage.getStorageType()) {
      this.storage.setStorageType(settings.storageType);
      this.reloadBookmarks();
    }

    // Handle theme changes
    if (this.settingsChanged(['colorTheme', 'customColor'], settings)) {
      this.recreateUI();
    }
  }

  /**
   * Recreate UI with new theme
   */
  async recreateUI() {
    this.log('Recreating UI with new theme...');

    // Destroy old UI
    this.panel.destroy();
    this.buttonManager.clear();

    // Recreate UI
    this.panel.create(() => this.togglePanel());
    this.addBookmarkButtons();
    this.updateUI();
  }

  /**
   * Cleanup
   */
  async destroy() {
    this.log('Destroying BookmarkModule...');

    // Stop observing
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    // Clean up UI
    this.buttonManager.clear();
    this.panel.destroy();
    this.sidebar.destroy();

    super.destroy();
  }
}

export default BookmarkModule;
