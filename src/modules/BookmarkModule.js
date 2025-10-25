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

      // Wait for messages to load, then navigate
      setTimeout(() => {
        const bookmark = this.bookmarks.find(b => b.id === bookmarkId);
        if (bookmark) {
          this.navigateToBookmark(bookmark);

          // Clean up URL
          const url = new URL(window.location.href);
          url.searchParams.delete('bookmark');
          window.history.replaceState({}, '', url.toString());
        } else {
          this.warn('Bookmark not found:', bookmarkId);
        }
      }, 1000); // Give time for messages to render
    }
  }

  /**
   * Reload bookmarks from storage
   */
  async reloadBookmarks() {
    this.bookmarks = await this.storage.load();
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
      (msg, idx) => this.getMessageId(msg, idx),
      (msgId) => this.isMessageBookmarked(msgId),
      (msgElement, msgId) => this.toggleBookmark(msgElement, msgId)
    );
  }

  /**
   * Toggle bookmark for a message
   */
  async toggleBookmark(messageElement, messageId) {
    const existing = this.findBookmarkByMessageId(messageId);

    if (existing) {
      // Remove bookmark
      await this.deleteBookmark(existing.id);
    } else {
      // Add bookmark
      await this.addBookmark(messageElement, messageId);
    }
  }

  /**
   * Add a bookmark
   */
  async addBookmark(messageElement, messageId) {
    const previewText = messageElement.textContent.trim().substring(0, 200);

    // Store reliable identifiers
    const renderCount = messageElement.getAttribute('data-test-render-count');
    const textHash = this.hashText(previewText);

    const bookmark = {
      id: `bookmark-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      messageId: messageId,
      renderCount: renderCount, // More reliable identifier
      textHash: textHash, // Fallback identifier
      previewText: previewText,
      note: '',
      timestamp: Date.now(),
      conversationUrl: window.location.href,
    };

    this.bookmarks.push(bookmark);
    await this.storage.save(this.bookmarks);

    // Update UI
    this.updateUI();
    this.addBookmarkButtons(); // Refresh buttons

    this.log('Bookmark added:', bookmark.id);
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
   * Update all UI components
   */
  updateUI() {
    this.panel.updateContent(
      this.bookmarks,
      (bookmark) => this.navigateToBookmark(bookmark),
      (id) => this.deleteBookmark(id)
    );
    this.sidebar.update(
      this.bookmarks,
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

    // Try multiple strategies to find the message
    let foundMessage = null;

    // Strategy 1: Match by render count (most reliable)
    if (bookmark.renderCount) {
      foundMessage = Array.from(messages).find(msg =>
        msg.getAttribute('data-test-render-count') === bookmark.renderCount
      );
    }

    // Strategy 2: Match by text hash
    if (!foundMessage && bookmark.textHash) {
      foundMessage = Array.from(messages).find(msg => {
        const msgText = msg.textContent.trim().substring(0, 200);
        return this.hashText(msgText) === bookmark.textHash;
      });
    }

    // Strategy 3: Match by messageId (fallback)
    if (!foundMessage) {
      for (let i = 0; i < messages.length; i++) {
        const messageId = this.getMessageId(messages[i], i);
        if (messageId === bookmark.messageId) {
          foundMessage = messages[i];
          break;
        }
      }
    }

    if (foundMessage) {
      this.dom.scrollToElement(foundMessage, 'center');
      this.dom.flashClass(foundMessage, 'claude-nav-highlight', 2000);
      if (this.panel && this.panel.elements.panel && this.panel.elements.panel.style.display === 'flex') {
        this.panel.toggle(); // Close panel if open
      }
      this.log('Navigated to bookmark:', bookmark.id);
      return;
    }

    // Message not found
    this.warn('Bookmarked message not found. Page may have been refreshed.');

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
   * Get unique message ID
   */
  getMessageId(messageElement, index) {
    // Try data-test-render-count first
    const renderCount = messageElement.getAttribute('data-test-render-count');
    if (renderCount) {
      return `msg-${renderCount}`;
    }

    // Fallback to hash-based ID
    const text = messageElement.textContent.trim().substring(0, 100);
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Check if message is bookmarked
   */
  isMessageBookmarked(messageId) {
    return this.bookmarks.some(b => b.messageId === messageId);
  }

  /**
   * Find bookmark by message ID
   */
  findBookmarkByMessageId(messageId) {
    return this.bookmarks.find(b => b.messageId === messageId);
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
    const messageId = this.getMessageId(message, currentIndex);
    this.toggleBookmark(message, messageId);
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
