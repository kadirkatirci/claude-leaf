/**
 * EmojiMarkerModule - Emoji-based message marking system
 * 
 * Handles edit version changes: When user changes edit version, message indices
 * may shift. This module uses content-based verification to resolve markers
 * to their correct positions.
 * 
 * Uses EditScanner's direct callback for instant version change detection
 * (same mechanism as EditHistoryModule for reliability).
 */
import BaseModule from './BaseModule.js';
import { Events } from '../utils/EventBus.js';
import DOMUtils from '../utils/DOMUtils.js';
import FixedButtonMixin from '../core/FixedButtonMixin.js';
import MessageObserverMixin from '../core/MessageObserverMixin.js';
import { getCleanMessageText, generateSignature, getValidMarkers } from '../utils/MarkerUtils.js';
import { markerStore } from '../stores/index.js';
import { EmojiPicker } from './EmojiMarkerModule/EmojiPicker.js';
import { MarkerButton } from './EmojiMarkerModule/MarkerButton.js';
import { MarkerBadge } from './EmojiMarkerModule/MarkerBadge.js';
import { MarkerPanel } from './EmojiMarkerModule/MarkerPanel.js';
import EditScanner from './EditHistoryModule/EditScanner.js';

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
    
    // Will hold unsubscribe function for EditScanner callback
    this.versionChangeUnsubscribe = null;
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

      // Listen for message updates (NavigationModule triggers this)
      this.subscribe(Events.MESSAGES_UPDATED, async () => {
        await this.updateUI();
      });

      // Register for edit version changes directly with EditScanner
      // This is the same mechanism EditHistoryModule uses - no EventBus delay
      this.registerForVersionChanges();

      // Setup message observer (fallback for other changes)
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
   * Uses content-based verification to handle edit version changes
   */
  async updateUI() {
    // Don't update if not on conversation page
    if (!this.lastConversationState) return;

    const allMessages = this.dom.findMessages();

    // Filter: Sadece gerçek mesaj container'larını kullan
    // Streaming olan mesajları EXCLUDE et (data-is-streaming="true")
    const messages = allMessages.filter(msg => {
      if (msg.hasAttribute('data-is-streaming')) {
        return msg.getAttribute('data-is-streaming') === 'false';
      }
      return true;
    });

    this.log(`UI güncelleniyor: ${messages.length} mesaj bulundu`);

    const currentConversationUrl = window.location.pathname;
    const conversationMarkers = await markerStore.getByConversation(currentConversationUrl);

    // Resolve markers to their current positions using content verification
    const updateCallback = async (markerId, updates) => {
      await markerStore.update(markerId, updates);
      this.log(`🔄 Marker index güncellendi: ${markerId}`, updates);
    };

    const validMarkers = getValidMarkers(conversationMarkers, messages, { 
      updateCallback,
      strictMode: false
    });

    // Create resolved markers array with updated indices
    const resolvedMarkers = validMarkers.map(item => ({
      ...item.marker,
      index: item.resolvedIndex,
      _status: item.status
    }));

    this.log(`📍 Markers resolved: ${resolvedMarkers.length}/${conversationMarkers.length} valid`);

    // Log any markers that couldn't be resolved
    const invalidCount = conversationMarkers.length - resolvedMarkers.length;
    if (invalidCount > 0) {
      this.warn(`⚠️ ${invalidCount} marker(s) could not be resolved`);
    }

    // Update counter
    this.updateButtonCounter(resolvedMarkers.length);

    // Update badges with resolved markers
    const showBadges = await this.getSetting('showBadges');
    if (showBadges) {
      this.badge.updateAll(messages, resolvedMarkers);
    }

    // Update hover buttons with resolved markers
    const showOnHover = await this.getSetting('showOnHover');
    if (showOnHover) {
      this.button.addToMessages(messages, resolvedMarkers);
    }

    // Update panel with resolved markers
    this.panel.updateContent(resolvedMarkers);
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

        if (messages.length > 0) {
          this.log(`✅ Found ${messages.length} messages after ${retryCount} retries`);
        } else {
          this.log(`⚠️ No messages found after ${retryCount} retries`);
        }
        return;
      }

      retryCount++;
      const delay = Math.min(baseDelay * Math.pow(1.5, retryCount), 1000);
      this.log(`🔄 Marker retry ${retryCount}/${maxRetries}: Waiting ${delay}ms...`);

      await new Promise(resolve => setTimeout(resolve, delay));
      return checkForMessages();
    };

    await checkForMessages();
  }

  /**
   * Add a new marker
   */
  async addMarker(messageEl, messageIndex, emoji) {
    if (!this.dom.isOnConversationPage()) {
      this.warn('Cannot add marker - not on conversation page');
      return;
    }

    const conversationUrl = window.location.pathname;
    const messageText = getCleanMessageText(messageEl);
    const messagePreview = messageText.substring(0, 100).trim();

    const marker = {
      conversationUrl,
      index: messageIndex,
      emoji,
      timestamp: Date.now(),
      contentSignature: generateSignature(messageEl),
      messagePreview,
    };

    await markerStore.add(marker);
    this.log(`Marker eklendi: ${emoji} at index ${messageIndex}`);
    await this.updateUI();
  }

  /**
   * Remove a marker
   */
  async removeMarker(markerId) {
    await markerStore.remove(markerId);
    this.log(`Marker silindi: ${markerId}`);
    await this.updateUI();
  }

  /**
   * Update marker emoji
   */
  async updateMarker(markerId, newEmoji) {
    await markerStore.update(markerId, { emoji: newEmoji });
    this.log(`Marker güncellendi: ${markerId} -> ${newEmoji}`);
    await this.updateUI();
  }

  /**
   * Scroll to marker
   */
  scrollToMarker(marker) {
    const messages = this.dom.findMessages();
    const resolved = getValidMarkers([marker], messages, { strictMode: false });
    
    if (resolved.length > 0 && resolved[0].resolvedIndex !== null) {
      const messageEl = messages[resolved[0].resolvedIndex];
      DOMUtils.scrollToElement(messageEl, 'center');
      DOMUtils.flashClass(messageEl, 'claude-nav-highlight', 2000);
      this.log(`Scrolled to marker: ${marker.emoji} at index ${resolved[0].resolvedIndex}`);
    } else {
      const messageEl = messages[marker.index];
      if (messageEl) {
        DOMUtils.scrollToElement(messageEl, 'center');
        DOMUtils.flashClass(messageEl, 'claude-nav-highlight', 2000);
        this.warn(`Scrolled to marker using fallback index: ${marker.index}`);
      } else {
        this.warn(`Message not found for marker: ${marker.id}`);
      }
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
    await this.updateUI();
  }

  /**
   * UI'ı yeniden oluştur
   */
  async recreateUI() {
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

    this.panel.remove();
    this.panel.create();
    await this.updateUI();
    this.log('🎨 UI tema ile yenilendi');
  }

  /**
   * Modülü durdur
   */
  destroy() {
    this.log('🛑 Emoji Markers durduruluyor...');

    // Unsubscribe from version changes
    if (this.versionChangeUnsubscribe) {
      this.versionChangeUnsubscribe();
      this.versionChangeUnsubscribe = null;
    }

    this.destroyFixedButton();
    this.button.removeAll();
    this.badge.removeAll();
    this.panel.remove();
    this.emojiPicker.removePicker();
    this.destroyMessageObserver();

    super.destroy();
  }
}

export default EmojiMarkerModule;
