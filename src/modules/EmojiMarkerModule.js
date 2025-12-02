/**
 * EmojiMarkerModule - Emoji-based message marking system
 * 
 * Markers are tied to specific messages via content signature.
 * If the message exists, show the marker. If not, don't show it.
 * NEVER auto-delete - only user can delete.
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
import IconLibrary from '../components/primitives/IconLibrary.js';
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

    this.versionChangeUnsubscribe = null;
  }

  async init() {
    try {
      await super.init();
      if (!this.enabled) return;

      this.log('Emoji Markers başlatılıyor...');

      await markerStore.setStorageType('local');

      const markers = await markerStore.getAll();
      this.log(`${markers.length} marker yüklendi`);

      FixedButtonMixin.enhance(this);
      MessageObserverMixin.enhance(this);

      await this.createFixedButton({
        id: 'claude-marker-fixed-btn',
        icon: IconLibrary.pin('currentColor', 20),
        tooltip: 'Emoji Markers',
        position: { right: '30px', transform: 'translateY(-160px)' },
        onClick: () => this.panel.toggle(),
        showCounter: true
      });

      this.setupVisibilityListener();
      this.panel.create();
      await this.updateUI();

      this.subscribe(Events.MESSAGES_UPDATED, async () => {
        await this.updateUI();
      });

      this.registerForVersionChanges();

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

  registerForVersionChanges() {
    const tryRegister = () => {
      const scanner = EditScanner.getInstance();
      if (scanner) {
        this.versionChangeUnsubscribe = scanner.onVersionChange(async () => {
          await this.updateUI();
        });
      } else {
        setTimeout(tryRegister, 100);
      }
    };
    tryRegister();
  }

  clearUIElements() {
    this.button?.removeAll?.();
    this.badge?.removeAll?.();
    this.panel.updateContent([]);
  }

  async updateUI() {
    if (!this.lastConversationState) return;

    const allMessages = this.dom.findMessages();
    const messages = allMessages.filter(msg => {
      if (msg.hasAttribute('data-is-streaming')) {
        return msg.getAttribute('data-is-streaming') === 'false';
      }
      return true;
    });

    const conversationMarkers = await markerStore.getByConversation(window.location.pathname);

    // Only show markers whose messages exist (content match)
    const validMarkers = getValidMarkers(conversationMarkers, messages, { strictMode: false });
    const resolvedMarkers = validMarkers.map(item => ({
      ...item.marker,
      index: item.resolvedIndex,
      _status: item.status
    }));

    this.log(`📍 Markers: ${resolvedMarkers.length} shown / ${conversationMarkers.length} in storage`);

    this.updateButtonCounter(resolvedMarkers.length);

    const showBadges = await this.getSetting('showBadges');
    if (showBadges) {
      this.badge.updateAll(messages, resolvedMarkers);
    }

    const showOnHover = await this.getSetting('showOnHover');
    if (showOnHover) {
      this.button.addToMessages(messages, resolvedMarkers);
    }

    this.panel.updateContent(resolvedMarkers);
  }

  async waitAndUpdateUI() {
    let retries = 0;
    while (this.dom.findMessages().length === 0 && retries < 5) {
      await new Promise(r => setTimeout(r, 200 * Math.pow(1.5, retries)));
      retries++;
    }
    await this.updateUI();
  }

  /**
   * Add marker - checks by content signature to avoid duplicates
   */
  async addMarker(messageEl, messageIndex, emoji) {
    if (!this.dom.isOnConversationPage()) return;

    const conversationUrl = window.location.pathname;
    const currentSignature = generateSignature(messageEl);

    // Check if this exact message already has a marker
    const existingMarkers = await markerStore.getByConversation(conversationUrl);
    const existingMarker = existingMarkers.find(m => m.contentSignature === currentSignature);

    if (existingMarker) {
      // Update existing marker's emoji instead of adding new
      this.log(`Marker already exists for this message, updating emoji`);
      await this.updateMarker(existingMarker.id, emoji);
      return;
    }

    const messageText = getCleanMessageText(messageEl);
    const marker = {
      conversationUrl,
      index: messageIndex,
      emoji,
      timestamp: Date.now(),
      contentSignature: currentSignature,
      messagePreview: messageText.substring(0, 100).trim(),
    };

    await markerStore.add(marker);
    this.log(`✅ Marker eklendi: ${emoji} at index ${messageIndex}`);
    await this.updateUI();
  }

  async removeMarker(markerId) {
    await markerStore.remove(markerId);
    this.log(`Marker silindi: ${markerId}`);
    await this.updateUI();
  }

  async updateMarker(markerId, newEmoji) {
    await markerStore.update(markerId, { emoji: newEmoji });
    this.log(`Marker güncellendi: ${markerId} -> ${newEmoji}`);
    await this.updateUI();
  }

  scrollToMarker(marker) {
    const messages = this.dom.findMessages();
    const resolved = getValidMarkers([marker], messages, { strictMode: false });

    if (resolved.length > 0 && resolved[0].resolvedIndex !== null) {
      const messageEl = messages[resolved[0].resolvedIndex];
      DOMUtils.scrollToElement(messageEl, 'center');
      DOMUtils.flashClass(messageEl, 'claude-nav-highlight', 2000);
    }
  }

  async getFavoriteEmojis() {
    return await this.getSetting('favoriteEmojis') || ['⚠️', '❓', '💡', '⭐', '📌', '🔥'];
  }

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
    return (await markerStore.getAll()).length;
  }

  async importMarkers() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';

    return new Promise((resolve, reject) => {
      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return reject(new Error('No file'));

        const reader = new FileReader();
        reader.onload = async (event) => {
          try {
            const result = await markerStore.import(event.target.result, true);
            await this.updateUI();
            resolve(result.imported);
          } catch (error) {
            reject(error);
          }
        };
        reader.readAsText(file);
      };
      input.click();
    });
  }

  async reloadMarkers() {
    await this.updateUI();
  }

  async onSettingsChanged() {
    await this.updateUI();
  }

  async recreateUI() {
    this.destroyFixedButton();
    await this.createFixedButton({
      id: 'claude-marker-fixed-btn',
      icon: IconLibrary.pin('currentColor', 20),
      tooltip: 'Emoji Markers',
      position: { right: '30px', transform: 'translateY(-160px)' },
      onClick: () => this.panel.toggle(),
      showCounter: true
    });
    this.setupVisibilityListener();
    this.panel.remove();
    this.panel.create();
    await this.updateUI();
  }

  destroy() {
    this.versionChangeUnsubscribe?.();
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
