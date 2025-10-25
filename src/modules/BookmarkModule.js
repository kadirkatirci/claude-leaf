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
        return;
      }

      // Wait for messages to load with retry mechanism
      this.waitForMessagesAndNavigate(bookmark, 0);
    }
  }

  /**
   * Wait for messages to load, then navigate to bookmark
   */
  waitForMessagesAndNavigate(bookmark, retryCount) {
    const maxRetries = 20; // Try for up to 10 seconds (20 * 500ms)
    const retryDelay = 500;

    const messages = this.dom.findMessages();

    if (messages.length > 0) {
      // Messages loaded, navigate now
      this.log(`✅ Messages loaded (${messages.length} found), navigating to bookmark`);
      this.navigateToBookmark(bookmark);

      // Clean up URL
      const url = new URL(window.location.href);
      url.searchParams.delete('bookmark');
      window.history.replaceState({}, '', url.toString());
    } else if (retryCount < maxRetries) {
      // Messages not loaded yet, retry
      this.log(`Waiting for messages to load... (attempt ${retryCount + 1}/${maxRetries})`);
      setTimeout(() => {
        this.waitForMessagesAndNavigate(bookmark, retryCount + 1);
      }, retryDelay);
    } else {
      // Give up after max retries
      this.warn('❌ Timed out waiting for messages to load');
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
    const messages = this.dom.findMessages();

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
    const contentSignature = this.hashText(messageElement.textContent.trim().substring(0, 1000));
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
   * Add a bookmark
   */
  async addBookmark(messageElement, messageIndex) {
    const fullText = messageElement.textContent.trim();
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
   * Navigate to a bookmarked message
   */
  navigateToBookmark(bookmark) {
    const messages = this.dom.findMessages();
    let foundMessage = null;
    let matchStrategy = null;

    // Strategy 1: Try the stored index first (fast path)
    if (bookmark.messageIndex !== undefined && bookmark.messageIndex < messages.length) {
      const candidateMessage = messages[bookmark.messageIndex];
      const candidateSignature = this.hashText(candidateMessage.textContent.trim().substring(0, 1000));

      if (candidateSignature === bookmark.contentSignature) {
        foundMessage = candidateMessage;
        matchStrategy = 'index';
        this.log('✅ Found by index:', bookmark.messageIndex);
      }
    }

    // Strategy 2: Search by content signature (slower but reliable)
    if (!foundMessage && bookmark.contentSignature) {
      for (let i = 0; i < messages.length; i++) {
        const msg = messages[i];
        const msgSignature = this.hashText(msg.textContent.trim().substring(0, 1000));

        if (msgSignature === bookmark.contentSignature) {
          foundMessage = msg;
          matchStrategy = 'contentSignature';
          this.log('✅ Found by contentSignature at index:', i);
          break;
        }
      }
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

    if (confirm('Bookmarked message not found on this page. Delete bookmark?')) {
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
