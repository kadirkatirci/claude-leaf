/**
 * EmojiMarkerModule - Emoji-based message marking system
 */
import BaseModule from './BaseModule.js';
import { Events } from '../utils/EventBus.js';
import DOMUtils from '../utils/DOMUtils.js';
import VisibilityManager from '../utils/VisibilityManager.js';
import { MarkerStorage } from './EmojiMarkerModule/MarkerStorage.js';
import { EmojiPicker } from './EmojiMarkerModule/EmojiPicker.js';
import { MarkerButton } from './EmojiMarkerModule/MarkerButton.js';
import { MarkerBadge } from './EmojiMarkerModule/MarkerBadge.js';
import { MarkerPanel } from './EmojiMarkerModule/MarkerPanel.js';

class EmojiMarkerModule extends BaseModule {
  constructor() {
    super('emojiMarkers');

    this.markers = [];
    this.storage = new MarkerStorage();
    this.visibilityUnsubscribe = null;
    this.lastConversationState = null;
    this.emojiPicker = new EmojiPicker();
    this.badge = new MarkerBadge(
      () => this.getTheme(),
      this.emojiPicker,
      () => this.getFavoriteEmojis(),
      (markerId, newEmoji) => this.updateMarker(markerId, newEmoji),
      (markerId) => this.removeMarker(markerId)
    );
    this.button = new MarkerButton(
      () => this.getTheme(),
      () => this.getFavoriteEmojis(),
      this.emojiPicker,
      (messageEl, messageIndex, emoji) => this.addMarker(messageEl, messageIndex, emoji),
      (markerId) => this.removeMarker(markerId),
      (markerId, newEmoji) => this.updateMarker(markerId, newEmoji)
    );
    this.panel = new MarkerPanel(
      () => this.getTheme(),
      (marker) => this.scrollToMarker(marker),
      (markerId) => this.removeMarker(markerId)
    );
  }

  async init() {
    try {
      await super.init();
      if (!this.enabled) return;

      this.log('Emoji Markers başlatılıyor...');

      // Set storage type from settings
      const storageType = this.getSetting('storageType') || 'local';
      this.storage.setStorageType(storageType);

      // Load markers
      this.markers = await this.storage.load();
      this.log(`${this.markers.length} marker yüklendi`);

      // Create fixed button
      this.createFixedButton();

      // Create panel
      this.panel.create();

      // Subscribe to visibility changes
      this.visibilityUnsubscribe = VisibilityManager.onVisibilityChange((isConversationPage) => {
        this.handleVisibilityChange(isConversationPage);
      });

      // Initial UI update
      this.updateUI();

      // Listen for message updates
      this.subscribe(Events.MESSAGES_UPDATED, () => {
        this.updateUI();
      });

      // Observe DOM changes
      this.observeMessages();

      this.log('✅ Emoji Markers aktif');
    } catch (error) {
      this.error('❌ Emoji Markers init failed:', error);
      throw error; // Re-throw to see in console
    }
  }

  /**
   * Handle visibility change from VisibilityManager
   */
  handleVisibilityChange(isConversationPage) {
    // Only update if state actually changed
    if (this.lastConversationState === isConversationPage) return;

    this.lastConversationState = isConversationPage;

    if (this.elements.button) {
      VisibilityManager.setElementVisibility(this.elements.button, isConversationPage);
    }

    if (!isConversationPage) {
      this.log('Page changed to non-conversation, hiding marker UI');
      // Clear UI elements with defensive checks
      if (this.button && typeof this.button.removeAll === 'function') {
        this.button.removeAll();
      }
      if (this.badge && typeof this.badge.removeAll === 'function') {
        this.badge.removeAll();
      }
      if (this.elements.counter) {
        this.elements.counter.textContent = '0';
      }
      this.panel.updateContent([]);
    } else {
      this.log('Page changed to conversation, showing marker UI');
      // Re-update UI on conversation page
      this.updateUI();
    }
  }

  /**
   * Create fixed position button
   */
  createFixedButton() {
    const theme = this.getTheme();

    // Pin button
    const button = this.dom.createElement('button', {
      id: 'claude-marker-fixed-btn',
      innerHTML: '📍',
      style: {
        position: 'fixed',
        right: '30px',
        top: '50%',
        transform: 'translateY(-160px)', // Collapse button'un eski yeri
        width: '48px',
        height: '48px',
        borderRadius: '50%',
        background: theme.gradient,
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        transition: 'all 0.2s ease',
        color: 'white',
        fontSize: '20px',
        zIndex: '9998',
        opacity: this.getSetting('opacity') || 0.7,
      }
    });

    // Counter badge
    const counter = this.dom.createElement('div', {
      id: 'claude-marker-counter',
      textContent: '0',
      style: {
        position: 'absolute',
        top: '-8px',
        right: '-8px',
        background: '#ff4757',
        color: 'white',
        borderRadius: '12px',
        padding: '2px 6px',
        fontSize: '10px',
        fontWeight: 'bold',
        minWidth: '20px',
        textAlign: 'center',
      }
    });

    button.appendChild(counter);

    // Click handler
    button.addEventListener('click', () => {
      this.panel.toggle();
    });

    // Hover effects
    button.addEventListener('mouseenter', () => {
      button.style.transform = 'translateY(-160px) scale(1.1)';
      button.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.25)';
      button.style.opacity = '1';
    });

    button.addEventListener('mouseleave', () => {
      button.style.transform = 'translateY(-160px) scale(1)';
      button.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
      button.style.opacity = this.getSetting('opacity') || 0.7;
    });

    document.body.appendChild(button);
    this.elements.button = button;
    this.elements.counter = counter;
  }

  /**
   * Observe DOM changes
   * Pattern: BookmarkModule (only update when message count changes)
   */
  observeMessages() {
    let lastMessageCount = 0;

    this.observer = this.dom.observeDOM(() => {
      clearTimeout(this.observerTimeout);
      this.observerTimeout = setTimeout(() => {
        // Only update UI if message count changed
        const messages = this.dom.findMessages();
        const currentCount = messages.length;

        if (currentCount !== lastMessageCount) {
          this.log(`Mesaj sayısı güncellendi: ${lastMessageCount} → ${currentCount}`);
          lastMessageCount = currentCount;
          this.updateUI();
        }
      }, 500);
    });
  }

  /**
   * Update all UI components
   */
  updateUI() {
    // Don't update if not on conversation page
    if (!this.lastConversationState) return;

    const allMessages = this.dom.findMessages();

    // Filter: Sadece gerçek mesaj container'larını kullan
    // Streaming olan mesajları EXCLUDE et (data-is-streaming="true")
    const messages = allMessages.filter(msg => {
      // Eğer data-is-streaming attribute'u varsa
      if (msg.hasAttribute('data-is-streaming')) {
        // Streaming=true olanları EXCLUDE et (henüz tamamlanmamış)
        return msg.getAttribute('data-is-streaming') === 'false';
      }
      // Attribute yoksa INCLUDE et (eski mesajlar attribute olmayabilir)
      return true;
    });

    this.log(`UI güncelleniyor: ${messages.length} mesaj bulundu (${allMessages.length} toplam)`);

    const currentConversationUrl = window.location.pathname;
    const conversationMarkers = this.storage.getByConversation(currentConversationUrl, this.markers);

    // Update counter
    if (this.elements.counter) {
      this.elements.counter.textContent = conversationMarkers.length.toString();
    }

    // Update badges
    if (this.getSetting('showBadges')) {
      this.badge.updateAll(messages, conversationMarkers);
    }

    // Update hover buttons
    if (this.getSetting('showOnHover')) {
      this.button.addToMessages(messages, conversationMarkers);
    }

    // Update panel
    this.panel.updateContent(conversationMarkers);
  }

  /**
   * Add a new marker
   */
  async addMarker(messageEl, messageIndex, emoji) {
    // Validate we're on a conversation page
    if (!this.dom.isOnConversationPage()) {
      this.warn('Cannot add marker - not on conversation page');
      return;
    }

    const conversationUrl = window.location.pathname;

    // Get message preview
    const messageText = messageEl.textContent || '';
    const messagePreview = messageText.substring(0, 50).trim();

    // Create marker object
    const marker = {
      id: `marker-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      conversationUrl,
      messageIndex,
      emoji,
      timestamp: Date.now(),
      contentSignature: this.hashString(messageText.substring(0, 1000)),
      messagePreview,
    };

    // Add to storage
    this.markers = await this.storage.add(marker, this.markers);

    this.log(`Marker eklendi: ${emoji} at index ${messageIndex}`);

    // Update UI
    this.updateUI();
  }

  /**
   * Remove a marker
   */
  async removeMarker(markerId) {
    this.markers = await this.storage.remove(markerId, this.markers);

    this.log(`Marker silindi: ${markerId}`);

    // Update UI
    this.updateUI();
  }

  /**
   * Update marker emoji
   */
  async updateMarker(markerId, newEmoji) {
    this.markers = await this.storage.update(markerId, newEmoji, this.markers);

    this.log(`Marker güncellendi: ${markerId} -> ${newEmoji}`);

    // Update UI
    this.updateUI();
  }

  /**
   * Scroll to marker
   */
  scrollToMarker(marker) {
    const messages = this.dom.findMessages();
    const messageEl = messages[marker.messageIndex];

    if (messageEl) {
      DOMUtils.scrollToElement(messageEl, 'center');
      DOMUtils.flashClass(messageEl, 'claude-nav-highlight', 2000);
      this.log(`Scrolled to marker: ${marker.emoji}`);
    } else {
      this.warn(`Message not found for marker: ${marker.id}`);
    }
  }

  /**
   * Get favorite emojis from settings
   */
  getFavoriteEmojis() {
    return this.getSetting('favoriteEmojis') || ['⚠️', '❓', '💡', '⭐', '📌', '🔥'];
  }

  /**
   * Simple string hash
   */
  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  /**
   * Export markers
   */
  async exportMarkers() {
    const count = await this.storage.export(this.markers);
    this.log(`${count} markers exported`);
    return count;
  }

  /**
   * Import markers
   */
  async importMarkers() {
    try {
      const newMarkers = await this.storage.import(this.markers);
      this.markers = [...this.markers, ...newMarkers];
      await this.storage.save(this.markers);

      this.log(`${newMarkers.length} markers imported`);
      this.updateUI();

      return newMarkers.length;
    } catch (error) {
      this.error('Import failed:', error);
      throw error;
    }
  }

  /**
   * Reload markers from storage
   */
  async reloadMarkers() {
    this.markers = await this.storage.load();
    this.updateUI();
  }

  /**
   * Settings değiştiğinde
   */
  onSettingsChanged() {
    this.log('⚙️ Settings değişti');

    // Storage type değiştiyse
    const storageType = this.getSetting('storageType') || 'local';
    if (this.storage.getStorageType() !== storageType) {
      this.storage.setStorageType(storageType);
      this.reloadMarkers();
    }

    // Tema değiştiyse UI yenile
    if (this.settings && this.settings.general) {
      this.recreateUI();
    } else {
      this.updateUI();
    }
  }

  /**
   * UI'ı yeniden oluştur
   */
  recreateUI() {
    // Remove old button
    if (this.elements.button) {
      this.elements.button.remove();
    }

    // Recreate button
    this.createFixedButton();

    // Remove and recreate panel
    this.panel.remove();
    this.panel.create();

    // Update UI
    this.updateUI();

    this.log('🎨 UI tema ile yenilendi');
  }

  /**
   * Modülü durdur
   */
  destroy() {
    this.log('🛑 Emoji Markers durduruluyor...');

    // Unsubscribe from visibility changes
    if (this.visibilityUnsubscribe) {
      this.visibilityUnsubscribe();
      this.visibilityUnsubscribe = null;
    }

    // Remove button
    if (this.elements.button) {
      this.elements.button.remove();
    }

    // Remove components
    this.button.removeAll();
    this.badge.removeAll();
    this.panel.remove();
    this.emojiPicker.removePicker();

    // Disconnect observer
    if (this.observer) {
      this.observer.disconnect();
    }

    super.destroy();
  }
}

export default EmojiMarkerModule;
