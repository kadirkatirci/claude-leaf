/**
 * EmojiMarkerModule - Emoji-based message marking system
 */
import BaseModule from './BaseModule.js';
import { Events } from '../utils/EventBus.js';
import DOMUtils from '../utils/DOMUtils.js';
import FixedButtonMixin from '../core/FixedButtonMixin.js';
import MessageObserverMixin from '../core/MessageObserverMixin.js';
import { hashString } from '../utils/HashUtils.js';
import { markerStore } from '../stores/index.js';
import { EmojiPicker } from './EmojiMarkerModule/EmojiPicker.js';
import { MarkerButton } from './EmojiMarkerModule/MarkerButton.js';
import { MarkerBadge } from './EmojiMarkerModule/MarkerBadge.js';
import { MarkerPanel } from './EmojiMarkerModule/MarkerPanel.js';

class EmojiMarkerModule extends BaseModule {
  constructor() {
    super('emojiMarkers');

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

      // Storage type is always 'local' (sync storage removed for simplicity)
      await markerStore.setStorageType('local');

      // Load markers
      const markers = await markerStore.getAll();
      this.log(`${markers.length} marker yüklendi`);

      // Enhance with mixins
      FixedButtonMixin.enhance(this);
      MessageObserverMixin.enhance(this);

      // Create fixed button
      await this.createFixedButton({
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
      await this.updateUI();

      // Listen for message updates
      this.subscribe(Events.MESSAGES_UPDATED, async () => {
        await this.updateUI();
      });

      // Setup message observer
      this.setupMessageObserver(async () => {
        await this.updateUI();
      }, {
        throttleDelay: 500,
        trackMessageCount: true,
        checkConversationPage: true
      });

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
   * Update all UI components
   */
  async updateUI() {
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
    const conversationMarkers = await markerStore.getByConversation(currentConversationUrl);

    // Update counter using mixin method
    this.updateButtonCounter(conversationMarkers.length);

    // Update badges
    const showBadges = await this.getSetting('showBadges');
    if (showBadges) {
      this.badge.updateAll(messages, conversationMarkers);
    }

    // Update hover buttons
    const showOnHover = await this.getSetting('showOnHover');
    if (showOnHover) {
      this.button.addToMessages(messages, conversationMarkers);
    }

    // Update panel
    this.panel.updateContent(conversationMarkers);
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
        // Messages found or max retries reached
        await this.updateUI();

        if (messages.length > 0) {
          this.log(`✅ Found ${messages.length} messages after ${retryCount} retries, markers updated`);
        } else {
          this.log(`⚠️ No messages found after ${retryCount} retries`);
        }
        return;
      }

      // Retry with exponential backoff
      retryCount++;
      const delay = Math.min(baseDelay * Math.pow(1.5, retryCount), 1000);
      this.log(`🔄 Marker retry ${retryCount}/${maxRetries}: Waiting ${delay}ms for messages...`);

      await new Promise(resolve => setTimeout(resolve, delay));
      return checkForMessages();
    };

    // Start checking
    await checkForMessages();
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
      conversationUrl,
      index: messageIndex,
      emoji,
      timestamp: Date.now(),
      contentSignature: hashString(messageText.substring(0, 1000)),
      messagePreview,
    };

    // Add to store (handles duplicate check internally)
    await markerStore.add(marker);

    this.log(`Marker eklendi: ${emoji} at index ${messageIndex}`);

    // Update UI
    await this.updateUI();
  }

  /**
   * Remove a marker
   */
  async removeMarker(markerId) {
    await markerStore.remove(markerId);

    this.log(`Marker silindi: ${markerId}`);

    // Update UI
    await this.updateUI();
  }

  /**
   * Update marker emoji
   */
  async updateMarker(markerId, newEmoji) {
    await markerStore.update(markerId, { emoji: newEmoji });

    this.log(`Marker güncellendi: ${markerId} -> ${newEmoji}`);

    // Update UI
    await this.updateUI();
  }

  /**
   * Scroll to marker
   */
  scrollToMarker(marker) {
    const messages = this.dom.findMessages();
    const messageEl = messages[marker.index];

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
  async getFavoriteEmojis() {
    return await this.getSetting('favoriteEmojis') || ['⚠️', '❓', '💡', '⭐', '📌', '🔥'];
  }

  /**
   * Export markers
   */
  async exportMarkers() {
    const exported = await markerStore.export();
    // Create download
    const dataBlob = new Blob([exported], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `claude-markers-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    const markers = await markerStore.getAll();
    this.log(`${markers.length} markers exported`);
    return markers.length;
  }

  /**
   * Import markers
   */
  async importMarkers() {
    try {
      // Open file picker
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/json';

      return new Promise((resolve, reject) => {
        input.onchange = async (e) => {
          try {
            const file = e.target.files[0];
            if (!file) {
              reject(new Error('No file selected'));
              return;
            }

            const reader = new FileReader();
            reader.onload = async (event) => {
              try {
                const jsonString = event.target.result;
                const result = await markerStore.import(jsonString, true);

                this.log(`${result.imported} markers imported`);
                await this.updateUI();

                resolve(result.imported);
              } catch (error) {
                this.error('Import failed:', error);
                reject(error);
              }
            };

            reader.readAsText(file);
          } catch (error) {
            reject(error);
          }
        };

        input.click();
      });
    } catch (error) {
      this.error('Import failed:', error);
      throw error;
    }
  }

  /**
   * Reload markers from storage
   */
  async reloadMarkers() {
    const markers = await markerStore.getAll();
    this.log(`Reloaded ${markers.length} markers`);
    await this.updateUI();
  }

  /**
   * Settings değiştiğinde
   */
  async onSettingsChanged() {
    this.log('⚙️ Settings değişti');

    // UI yenile
    await this.updateUI();
  }

  /**
   * UI'ı yeniden oluştur
   */
  async recreateUI() {
    // Destroy and recreate fixed button
    this.destroyFixedButton();
    await this.createFixedButton({
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
    await this.updateUI();

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

    // Destroy message observer
    this.destroyMessageObserver();

    super.destroy();
  }
}

export default EmojiMarkerModule;
