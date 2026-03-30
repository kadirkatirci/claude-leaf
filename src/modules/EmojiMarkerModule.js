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
import { getCleanMessageText, generateSignature, getValidMarkers } from '../utils/MarkerUtils.js';
import { markerStore } from '../stores/index.js';
import { EmojiPicker } from './EmojiMarkerModule/EmojiPicker.js';
import { MarkerButton } from './EmojiMarkerModule/MarkerButton.js';
import { MarkerBadge } from './EmojiMarkerModule/MarkerBadge.js';
import { MarkerPanel } from './EmojiMarkerModule/MarkerPanel.js';
import IconLibrary from '../components/primitives/IconLibrary.js';
import { MODULE_CONSTANTS } from '../config/ModuleConstants.js';
import { trackEvent, trackPerfScan } from '../analytics/Analytics.js';

const EMOJI_CONFIG = MODULE_CONSTANTS.emojiMarkers;

class EmojiMarkerModule extends BaseModule {
  constructor() {
    super('emojiMarkers');

    this.emojiPicker = new EmojiPicker();
    this.badge = new MarkerBadge(
      () => this.getTheme(),
      this.emojiPicker,
      () => this.getFavoriteEmojis(),
      (markerId, newEmoji) => this.updateMarker(markerId, newEmoji, 'badge'),
      markerId => this.removeMarker(markerId, 'badge')
    );
    this.button = new MarkerButton(
      () => this.getTheme(),
      () => this.getFavoriteEmojis(),
      this.emojiPicker,
      (messageEl, messageIndex, emoji) => this.addMarker(messageEl, messageIndex, emoji, 'button'),
      markerId => this.removeMarker(markerId, 'button'),
      (markerId, newEmoji) => this.updateMarker(markerId, newEmoji, 'button')
    );

    // Lazy initialization for panel (created on first use)
    this._panel = null;
  }

  // Lazy getter for panel
  get panel() {
    if (!this._panel) {
      this._panel = new MarkerPanel(
        () => this.getTheme(),
        marker => this.scrollToMarker(marker, 'panel'),
        markerId => this.removeMarker(markerId, 'panel')
      );
    }
    return this._panel;
  }

  async init() {
    try {
      const initStart = performance.now();
      await super.init();
      if (!this.enabled) {
        return;
      }

      this.log('Emoji Markers initializing...');

      const markers = await markerStore.getAll();
      this.log(`${markers.length} markers loaded`);

      FixedButtonMixin.enhance(this);

      await this.createFixedButton({
        id: 'claude-marker-fixed-btn',
        icon: IconLibrary.pin('currentColor', 20),
        tooltip: 'Emoji Markers',
        position: { right: '30px', transform: 'translateY(-160px)' },
        onClick: () => this.togglePanel('button'),
        showCounter: true,
      });

      this.setupVisibilityListener();
      this.panel.create();
      await this.updateUI();

      // Subscribe to MessageHub for content changes (replaces MessageObserver + VersionManager + MESSAGES_UPDATED)
      this.subscribe(Events.HUB_CONTENT_CHANGED, async () => {
        await this.updateUI();
      });

      this.log('✅ Emoji Markers active');
      trackEvent('perf_init', {
        module: 'emojiMarkers',
        init_ms: Math.round(performance.now() - initStart),
      });
    } catch (error) {
      this.error('❌ Emoji Markers init failed:', error);
      throw error;
    }
  }

  clearUIElements() {
    this.button?.removeAll?.();
    this.badge?.removeAll?.();
    this.panel.updateContent([]);
  }

  async updateUI() {
    const scanStart = performance.now();
    if (!this.lastConversationState) {
      return;
    }

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
      _status: item.status,
    }));

    this.log(
      `📍 Markers: ${resolvedMarkers.length} shown / ${conversationMarkers.length} in storage`
    );

    this.updateButtonCounter(resolvedMarkers.length);

    const showBadges = EMOJI_CONFIG.showBadges;
    if (showBadges) {
      this.badge.updateAll(messages, resolvedMarkers);
    }

    const showOnHover = EMOJI_CONFIG.showOnHover;
    if (showOnHover) {
      this.button.addToMessages(messages, resolvedMarkers);
    }

    this.panel.updateContent(resolvedMarkers);

    trackPerfScan(
      {
        module: 'emojiMarkers',
        method: 'update_ui',
        scan_ms: Math.round(performance.now() - scanStart),
        item_count: resolvedMarkers.length,
        marker_count: resolvedMarkers.length,
      },
      { key: 'emojiMarkers:update_ui', minIntervalMs: 5000 }
    );
  }

  async waitAndUpdateUI() {
    let retries = 0;
    while (this.dom.findMessages().length === 0 && retries < 5) {
      await new Promise(r => {
        setTimeout(r, 200 * Math.pow(1.5, retries));
      });
      retries++;
    }
    await this.updateUI();
  }

  togglePanel(method = 'button') {
    const wasVisible = this.panel.isVisible;
    const isVisible = this.panel.toggle();
    trackEvent('marker_panel_toggle', {
      module: 'emojiMarkers',
      method,
      state: isVisible ? 'open' : 'close',
    });
    if (!wasVisible && isVisible) {
      this.updateUI();
    }
  }

  /**
   * Add marker - checks by content signature to avoid duplicates
   */
  async addMarker(messageEl, messageIndex, emoji, method = 'button') {
    if (!this.dom.isOnConversationPage()) {
      return;
    }

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
    this.log(`✅ Marker added: ${emoji} at index ${messageIndex}`);
    trackEvent('marker_add', {
      module: 'emojiMarkers',
      method,
      emoji,
      message_index: messageIndex,
    });
    await this.updateUI();
  }

  async removeMarker(markerId, method = 'panel') {
    await markerStore.remove(markerId);
    this.log(`Marker removed: ${markerId}`);
    trackEvent('marker_remove', {
      module: 'emojiMarkers',
      method,
    });
    await this.updateUI();
  }

  async updateMarker(markerId, newEmoji, method = 'panel') {
    const existing = await markerStore.getById(markerId);
    await markerStore.update(markerId, { emoji: newEmoji });
    this.log(`Marker updated: ${markerId} -> ${newEmoji}`);
    trackEvent('marker_update', {
      module: 'emojiMarkers',
      method,
      from_emoji: existing?.emoji,
      to_emoji: newEmoji,
    });
    await this.updateUI();
  }

  scrollToMarker(marker, method = 'panel') {
    const messages = this.dom.findMessages();
    const resolved = getValidMarkers([marker], messages, { strictMode: false });

    if (resolved.length > 0 && resolved[0].resolvedIndex !== null) {
      const messageEl = messages[resolved[0].resolvedIndex];
      DOMUtils.scrollToElement(messageEl, 'center');
      DOMUtils.flashClass(messageEl, 'claude-nav-highlight', 2000);
      trackEvent('marker_navigate', {
        module: 'emojiMarkers',
        method,
        result: 'found',
        message_index: resolved[0].resolvedIndex,
      });
    } else {
      trackEvent('marker_navigate', {
        module: 'emojiMarkers',
        method,
        result: 'not_found',
      });
    }
  }

  getFavoriteEmojis() {
    return EMOJI_CONFIG.favoriteEmojis;
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

  importMarkers() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';

    return new Promise((resolve, reject) => {
      input.onchange = e => {
        const file = e.target.files[0];
        if (!file) {
          return reject(new Error('No file'));
        }

        const reader = new FileReader();
        reader.onload = async event => {
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

  async onSettingsChanged(settings) {
    if (this.refreshFixedButtonVisibility) {
      this.refreshFixedButtonVisibility();
    }

    if (this.settingsChanged(['general.colorTheme', 'general.customColor'], settings)) {
      await this.recreateUI();
      return;
    }

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
      showCounter: true,
    });
    this.setupVisibilityListener();
    this.panel.remove();
    this.panel.create();
    await this.updateUI();
  }

  destroy() {
    this.destroyFixedButton();
    this.button.removeAll();
    this.badge.removeAll();
    this.panel.remove();
    this.emojiPicker.removePicker();

    // Reset lazy-initialized components for proper reinit
    this._panel = null;

    // Note: MessageHub subscriptions are automatically cleaned up by BaseModule.destroy()
    super.destroy();
  }
}

export default EmojiMarkerModule;
