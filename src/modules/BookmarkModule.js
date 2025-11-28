/**
 * BookmarkModule - Main coordinator for bookmark functionality
 * Uses smaller, maintainable sub-modules for different concerns
 * 
 * Handles edit version changes: When user changes edit version, message indices
 * may shift. This module uses content-based verification to resolve bookmarks
 * to their correct positions.
 * 
 * Uses EditScanner's direct callback for instant version change detection
 * (same mechanism as EditHistoryModule for reliability).
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
import EditScanner from './EditHistoryModule/EditScanner.js';

class BookmarkModule extends BaseModule {
  constructor() {
    super('bookmarks');

    this.observerTimeout = null;
    this.observer = null;
    this.visibilityUnsubscribe = null;
    this.lastConversationState = null;
    this.chromeMessageListener = null;
    
    // Will hold unsubscribe function for EditScanner callback
    this.versionChangeUnsubscribe = null;

    // Initialize sub-modules
    this.buttonManager = new BookmarkButton(this.dom, () => this.getTheme());
    this.panel = new BookmarkPanel(this.dom, () => this.getTheme(), (key) => this.getSetting(key));
    this.sidebar = new BookmarkSidebar(this.dom, () => this.getTheme());
  }

  async init() {
    await super.init();

    if (!this.enabled) return;

    try {
      this.log('Bookmarks başlatılıyor...');

      // Enhance with mixins
      FixedButtonMixin.enhance(this);
      MessageObserverMixin.enhance(this);

      // Storage type is always 'local'
      try {
        await bookmarkStore.setStorageType('local');
      } catch (error) {
        this.error('Failed to set storage type:', error);
      }

      // Load bookmarks
      let bookmarks = [];
      try {
        bookmarks = await bookmarkStore.getAll();
        this.log(`Loaded ${bookmarks.length} bookmarks from store`);
      } catch (error) {
        this.error('Failed to load bookmarks:', error);
      }

      // Create UI
      try {
        this.panel.create(() => this.togglePanel());
      } catch (error) {
        this.error('Failed to create panel:', error);
      }

      // Inject sidebar
      try {
        this.sidebar.inject();
      } catch (error) {
        this.error('Failed to inject sidebar:', error);
      }

      // Add bookmark buttons to messages
      try {
        await this.addBookmarkButtons();
      } catch (error) {
        this.error('Failed to add bookmark buttons:', error);
      }

      // Setup message observer
      try {
        this.setupMessageObserver(async () => {
          try {
            await this.addBookmarkButtons();
          } catch (error) {
            this.error('Error in message observer callback:', error);
          }
        }, {
          throttleDelay: 500,
          trackMessageCount: true,
          checkConversationPage: true
        });
      } catch (error) {
        this.error('Failed to setup message observer:', error);
      }

      // Setup keyboard shortcuts
      try {
        if (await this.getSetting('keyboardShortcuts')) {
          this.setupKeyboardShortcuts();
        }
      } catch (error) {
        this.error('Failed to setup keyboard shortcuts:', error);
      }

      // Listen for message updates (NavigationModule triggers this)
      this.subscribe(Events.MESSAGES_UPDATED, async () => {
        try {
          await this.addBookmarkButtons();
          const currentBookmarks = await this.getCurrentConversationBookmarks();
          this.panel.updateCounter(currentBookmarks.length);
        } catch (error) {
          this.error('Error in message update handler:', error);
        }
      });

      // Register for edit version changes directly with EditScanner
      // This is the same mechanism EditHistoryModule uses - no EventBus delay
      this.registerForVersionChanges();

      // Listen for bookmark updates from popup
      try {
        this.chromeMessageListener = async (message) => {
          try {
            if (message.type === 'BOOKMARKS_UPDATED') {
              this.log('Bookmarks updated from popup (import)');
              await this.reloadBookmarks();
            } else if (message.type === 'STORAGE_TYPE_CHANGED') {
              this.log('Storage type changed:', message.storageType);
              await bookmarkStore.setStorageType(message.storageType);
              await this.reloadBookmarks();
            }
          } catch (error) {
            this.error('Error in Chrome message handler:', error);
          }
        };

        chrome.runtime.onMessage.addListener(this.chromeMessageListener);
      } catch (error) {
        this.error('Failed to setup Chrome message listener:', error);
      }

      // Create fixed position button
      try {
        await this.createFixedButton({
          id: 'claude-bookmarks-fixed-btn',
          icon: '🔖',
          tooltip: 'Bookmarks',
          position: { right: '30px', transform: 'translateY(-40px)' },
          onClick: () => this.togglePanel(),
          showCounter: true
        });
      } catch (error) {
        this.error('Failed to create fixed button:', error);
        throw error;
      }

      // Setup visibility listener from mixin
      try {
        this.setupVisibilityListener();
      } catch (error) {
        this.error('Failed to setup visibility listener:', error);
      }

      // Initial UI update
      try {
        this.updateUI();
      } catch (error) {
        this.error('Error in initial UI update:', error);
      }

      // Check if navigating from bookmarks page
      try {
        this.checkBookmarkNavigation();
      } catch (error) {
        this.error('Error checking bookmark navigation:', error);
      }

      this.log(`✅ ${bookmarks.length} bookmarks loaded`);
    } catch (error) {
      this.error('BookmarkModule initialization failed:', error);
      throw error;
    }
  }

  /**
   * Register for version changes directly with EditScanner
   * Uses polling to wait for scanner to be available
   */
  registerForVersionChanges() {
    const tryRegister = () => {
      const scanner = EditScanner.getInstance();
      if (scanner) {
        this.versionChangeUnsubscribe = scanner.onVersionChange(async (data) => {
          this.log(`📡 Version change callback: ${data.changeReason}`);
          await this.addBookmarkButtons();
          await this.updateUI();
        });
        this.log('✅ Registered for EditScanner version changes');
      } else {
        // Scanner not ready yet, try again
        this.log('⏳ EditScanner not ready, retrying in 100ms...');
        setTimeout(tryRegister, 100);
      }
    };
    
    tryRegister();
  }

  /**
   * Clear UI elements (called by FixedButtonMixin on page change)
   */
  clearUIElements() {
    this.log('Clearing bookmark UI elements');
    if (this.buttonManager && typeof this.buttonManager.removeAll === 'function') {
      this.buttonManager.removeAll();
    }
    this.panel.updateContent([]);
    this.sidebar.update([]);

    try {
      this.sidebar.inject();
    } catch (error) {
      this.error('Failed to inject sidebar during clearUIElements:', error);
    }
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
        const url = new URL(window.location.href);
        url.searchParams.delete('bookmark');
        window.history.replaceState({}, '', url.toString());
        return;
      }

      const currentPath = window.location.pathname;
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
        this.log('Already on correct page, waiting for messages...');
        this.waitForMessagesAndNavigate(bookmark, 0);
      } else {
        this.log('Redirecting to conversation from:', currentPath, 'to:', bookmarkPath);
        if (bookmarkPath.startsWith('/')) {
          window.location.href = bookmarkPath + '?bookmark=' + bookmarkId;
        } else if (bookmarkPath.startsWith('http')) {
          window.location.href = bookmarkPath + '?bookmark=' + bookmarkId;
        }
        return;
      }
    }
  }

  /**
   * Wait for messages to load AND stabilize, then navigate to bookmark
   */
  waitForMessagesAndNavigate(bookmark, retryCount, previousCount = 0, stableCount = 0) {
    const maxRetries = 40;
    const retryDelay = 500;
    const requiredStableChecks = 3;

    const messages = this.dom.findMessages();
    const currentCount = messages.length;

    this.log(`[Retry ${retryCount}] Messages: ${currentCount} (previous: ${previousCount}, stable: ${stableCount}/${requiredStableChecks})`);

    if (currentCount > 0 && currentCount === previousCount) {
      const newStableCount = stableCount + 1;

      if (newStableCount >= requiredStableChecks) {
        this.log(`✅ Messages stabilized at ${currentCount}. Navigating now...`);
        this.navigateToBookmark(bookmark, true);

        setTimeout(() => {
          const url = new URL(window.location.href);
          url.searchParams.delete('bookmark');
          window.history.replaceState({}, '', url.toString());
        }, 100);
      } else {
        this.log(`⏳ Messages stable (${newStableCount}/${requiredStableChecks})...`);
        setTimeout(() => {
          this.waitForMessagesAndNavigate(bookmark, retryCount + 1, currentCount, newStableCount);
        }, retryDelay);
      }
    } else if (retryCount < maxRetries) {
      if (currentCount > 0 && currentCount !== previousCount) {
        this.log(`⏳ Messages still loading (${previousCount} → ${currentCount})...`);
      }
      setTimeout(() => {
        this.waitForMessagesAndNavigate(bookmark, retryCount + 1, currentCount, 0);
      }, retryDelay);
    } else {
      this.warn('❌ Timed out waiting for messages to stabilize');
      if (currentCount > 0) {
        this.warn('⚠️ Attempting navigation with unstable message count...');
        this.navigateToBookmark(bookmark, true);
      }

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
   * Uses content-based resolution for edit version change handling
   */
  async addBookmarkButtons() {
    if (!this.dom.isOnConversationPage()) {
      this.log('❌ Not on conversation page, skipping bookmark buttons');
      return;
    }

    const messages = this.dom.findMessages();

    if (messages.length === 0) {
      this.log('❌ No actual messages found');
      return;
    }

    const currentPath = window.location.pathname;
    const bookmarks = await bookmarkStore.getByConversation(currentPath);
    
    const updateCallback = async (bookmarkId, updates) => {
      await bookmarkStore.update(bookmarkId, updates);
      this.log(`🔄 Bookmark index auto-updated: ${bookmarkId}`, updates);
    };

    const validBookmarks = getValidMarkers(bookmarks, messages, {
      updateCallback,
      strictMode: false
    });

    const bookmarkedIndices = new Set(
      validBookmarks
        .filter(item => item.resolvedIndex !== null)
        .map(item => item.resolvedIndex)
    );

    this.log(`✅ Adding bookmark buttons to ${messages.length} messages (${bookmarkedIndices.size} bookmarked)`);

    this.buttonManager.addToMessages(
      messages,
      (msg, idx) => idx,
      async (idx) => bookmarkedIndices.has(idx),
      async (msgElement, idx) => await this.toggleBookmarkByIndex(msgElement, idx)
    );
  }

  /**
   * Toggle bookmark by index
   */
  async toggleBookmarkByIndex(messageElement, index) {
    const existing = await this.findBookmarkByIndex(index);

    if (existing) {
      this.log('Removing bookmark at index:', index);
      await this.deleteBookmark(existing.id);
    } else {
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
   */
  async findBookmarkByIndex(index) {
    const currentPath = window.location.pathname;
    const bookmarks = await bookmarkStore.getByConversation(currentPath);
    const bookmark = bookmarks.find(b => b.index === index);
    return bookmark || null;
  }

  /**
   * Add a bookmark
   */
  async addBookmark(messageElement, messageIndex) {
    const fullText = getCleanMessageText(messageElement);
    const previewText = fullText.substring(0, 200);
    const contentSignature = generateSignature(messageElement);
    const conversationPath = window.location.pathname;

    const bookmark = {
      index: messageIndex,
      contentSignature: contentSignature,
      previewText: previewText,
      note: '',
      timestamp: Date.now(),
      conversationUrl: conversationPath,
    };

    await bookmarkStore.add(bookmark);

    this.log('✅ Bookmark added:', {
      index: bookmark.index,
      signature: contentSignature,
      preview: previewText.substring(0, 50)
    });

    await this.updateUI();
    await this.addBookmarkButtons();
  }

  /**
   * Delete a bookmark
   */
  async deleteBookmark(bookmarkId) {
    await bookmarkStore.remove(bookmarkId);
    await this.updateUI();
    await this.addBookmarkButtons();
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
   * Uses content-based verification to handle edit version changes
   */
  async updateUI() {
    if (!this.lastConversationState) return;

    const messages = this.dom.findMessages();
    const currentPath = window.location.pathname;
    const bookmarks = await bookmarkStore.getByConversation(currentPath);

    const updateCallback = async (bookmarkId, updates) => {
      await bookmarkStore.update(bookmarkId, updates);
      this.log(`🔄 Bookmark index güncellendi: ${bookmarkId}`, updates);
    };

    const validBookmarks = getValidMarkers(bookmarks, messages, {
      updateCallback,
      strictMode: false
    });

    const resolvedBookmarks = validBookmarks.map(item => ({
      ...item.marker,
      index: item.resolvedIndex,
      _status: item.status
    }));

    this.log(`🔖 Bookmarks resolved: ${resolvedBookmarks.length}/${bookmarks.length} valid`);

    const invalidCount = bookmarks.length - resolvedBookmarks.length;
    if (invalidCount > 0) {
      this.warn(`⚠️ ${invalidCount} bookmark(s) could not be resolved`);
    }

    this.updateButtonCounter(resolvedBookmarks.length);

    this.panel.updateContent(
      resolvedBookmarks,
      (bookmark) => this.navigateToBookmark(bookmark),
      (id) => this.deleteBookmark(id)
    );

    try {
      this.sidebar.inject();
    } catch (error) {
      this.error('Failed to inject sidebar during updateUI:', error);
    }

    this.sidebar.update(
      resolvedBookmarks,
      (bookmark) => this.navigateToBookmark(bookmark)
    );
  }

  /**
   * Wait for messages and update UI with retry mechanism
   */
  async waitAndUpdateUI() {
    const maxRetries = 5;
    const baseDelay = 200;
    let retryCount = 0;

    const checkForMessages = async () => {
      const messages = this.dom.findMessages();

      if (messages.length > 0 || retryCount >= maxRetries) {
        await this.updateUI();
        await this.addBookmarkButtons();

        try {
          this.sidebar.inject();
        } catch (error) {
          this.error('Failed to inject sidebar during waitAndUpdateUI:', error);
        }

        if (messages.length > 0) {
          this.log(`✅ Found ${messages.length} messages after ${retryCount} retries`);
        } else {
          this.log(`⚠️ No messages found after ${retryCount} retries`);
        }
        return;
      }

      retryCount++;
      const delay = Math.min(baseDelay * Math.pow(1.5, retryCount), 1000);
      this.log(`🔄 Bookmark retry ${retryCount}/${maxRetries}: Waiting ${delay}ms...`);

      await new Promise(resolve => setTimeout(resolve, delay));
      return checkForMessages();
    };

    await checkForMessages();
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
  navigateToBookmark(bookmark, fromUrlNavigation = false) {
    const currentPath = window.location.pathname;

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

      if (fromUrlNavigation && bookmarkPath) {
        window.location.href = bookmarkPath + '?bookmark=' + bookmark.id;
        return;
      }

      this.warn('This bookmark belongs to a different conversation.');
      return;
    }

    const messages = this.dom.findMessages();

    if (messages.length === 0) {
      this.warn('❌ No messages found on page yet!');
      if (!fromUrlNavigation) {
        alert('No messages loaded yet. Please wait for the page to load.');
      }
      return;
    }

    this.log(`Searching for bookmark in ${messages.length} messages`);

    const updateCallback = async (bookmarkId, updates) => {
      await bookmarkStore.update(bookmarkId, updates);
      this.log(`🔄 Bookmark index updated: ${bookmarkId}`, updates);
    };

    const result = resolveMarkerIndex(bookmark, messages, {
      updateCallback,
      strictMode: false
    });

    if (result.index !== null && result.message) {
      this.log(`✅ Navigation successful using ${result.status} strategy (index: ${result.index})`);
      this.dom.scrollToElement(result.message, 'center');
      this.dom.flashClass(result.message, 'claude-nav-highlight', 2000);

      if (this.panel && this.panel.elements.panel && this.panel.elements.panel.style.display === 'flex') {
        this.panel.toggle();
      }
      return;
    }

    this.warn('❌ Bookmarked message not found on this page');

    if (!fromUrlNavigation && confirm('Bookmarked message not found on this page. Delete bookmark?')) {
      this.deleteBookmark(bookmark.id);
    }
  }

  /**
   * Setup keyboard shortcuts
   */
  setupKeyboardShortcuts() {
    const handleKeydown = (e) => {
      if (e.altKey && e.shiftKey && e.key === 'B') {
        e.preventDefault();
        this.togglePanel();
      }

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

    if (settings.position) {
      this.panel.updatePosition(settings.position);
    }

    if (settings.storageType && settings.storageType !== bookmarkStore.getStorageType()) {
      await bookmarkStore.setStorageType(settings.storageType);
      await this.reloadBookmarks();
    }

    if (this.settingsChanged(['colorTheme', 'customColor'], settings)) {
      await this.recreateUI();
    }
  }

  /**
   * Recreate UI with new theme
   */
  async recreateUI() {
    this.log('Recreating UI with new theme...');

    this.panel.destroy();
    if (this.buttonManager && typeof this.buttonManager.removeAll === 'function') {
      this.buttonManager.removeAll();
    }

    this.panel.create(() => this.togglePanel());
    await this.addBookmarkButtons();
    await this.updateUI();
  }

  /**
   * Cleanup
   */
  async destroy() {
    this.log('Destroying BookmarkModule...');

    try {
      // Unsubscribe from version changes
      if (this.versionChangeUnsubscribe) {
        this.versionChangeUnsubscribe();
        this.versionChangeUnsubscribe = null;
      }

      if (this.chromeMessageListener) {
        chrome.runtime.onMessage.removeListener(this.chromeMessageListener);
        this.chromeMessageListener = null;
      }

      if (this.visibilityUnsubscribe) {
        this.visibilityUnsubscribe();
        this.visibilityUnsubscribe = null;
      }

      this.destroyMessageObserver();

      if (this.buttonManager && typeof this.buttonManager.removeAll === 'function') {
        this.buttonManager.removeAll();
      }

      this.panel.destroy();
      this.sidebar.destroy();

      super.destroy();
    } catch (error) {
      this.error('Error in destroy method:', error);
    }
  }
}

export default BookmarkModule;
