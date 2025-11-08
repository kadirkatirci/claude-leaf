/**
 * EmojiMarkerModule - Emoji-based message marking system
 */
import BaseModule from './BaseModule.js';
import { Events } from '../utils/EventBus.js';
import DOMUtils from '../utils/DOMUtils.js';
import FixedButtonMixin from '../core/FixedButtonMixin.js';
import { hashString } from '../utils/HashUtils.js';
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

      // Enhance with FixedButtonMixin
      FixedButtonMixin.enhance(this);

      // Create fixed button
      this.createFixedButton({
        id: 'claude-marker-fixed-btn',
        icon: '📍',
        tooltip: 'Emoji Markers',
        position: { right: '30px', transform: 'translateY(-160px)' },
        onClick: () => this.panel.toggle(),
        showCounter: true
      });

      // Setup visibility listener (from mixin)
      this.setupVisibilityListener();

      // Create panel
      this.panel.create();

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
   * Clear UI elements on page change (required for FixedButtonMixin)
   */
  clearUIElements() {
    this.log('Clearing marker UI elements');

    // Clear hover buttons
    if (this.button && typeof this.button.removeAll === 'function') {
      this.button.removeAll();
    }

    // Clear badges
    if (this.badge && typeof this.badge.removeAll === 'function') {
      this.badge.removeAll();
    }

    // Clear panel
    this.panel.updateContent([]);
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

    // Update counter using mixin method
    this.updateButtonCounter(conversationMarkers.length);

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
      contentSignature: hashString(messageText.substring(0, 1000)),
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
    // Destroy and recreate fixed button
    this.destroyFixedButton();
    this.createFixedButton({
      id: 'claude-marker-fixed-btn',
      icon: '📍',
      tooltip: 'Emoji Markers',
      position: { right: '30px', transform: 'translateY(-160px)' },
      onClick: () => this.panel.toggle(),
      showCounter: true
    });
    this.setupVisibilityListener();

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

    // Destroy fixed button (includes visibility listener cleanup)
    this.destroyFixedButton();

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
