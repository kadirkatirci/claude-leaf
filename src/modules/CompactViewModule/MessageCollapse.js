/**
 * MessageCollapse - Mesaj collapse/expand mantığı
 */
import DOMUtils from '../../utils/DOMUtils.js';

class MessageCollapse {
  constructor(settings, onStateChange) {
    this.settings = settings;
    this.onStateChange = onStateChange;
    this.collapsedMessages = new Map(); // message element -> collapsed state
  }

  /**
   * Mesajın collapse edilip edilmeyeceğini kontrol et
   */
  shouldCollapse(messageElement) {
    const minHeight = this.settings.minHeight || 300;
    const height = messageElement.scrollHeight;
    
    return height > minHeight;
  }

  /**
   * Mesajı collapse et
   */
  collapseMessage(messageElement) {
    if (this.collapsedMessages.get(messageElement)) {
      return; // Zaten collapsed
    }

    const previewLines = this.settings.previewLines || 10;
    const fadeHeight = this.settings.fadeHeight || 50;
    
    // Wrapper oluştur
    const wrapper = DOMUtils.createElement('div', {
      className: 'claude-message-collapsed',
      style: {
        position: 'relative',
        maxHeight: `${previewLines * 24}px`, // ~24px per line
        overflow: 'hidden',
        transition: 'max-height 0.3s ease',
      }
    });

    // Fade overlay
    const fadeOverlay = DOMUtils.createElement('div', {
      className: 'claude-collapse-fade',
      style: {
        position: 'absolute',
        bottom: '0',
        left: '0',
        right: '0',
        height: `${fadeHeight}px`,
        background: 'linear-gradient(to bottom, transparent, white)',
        pointerEvents: 'none',
      }
    });

    // Mesajı wrap et
    const parent = messageElement.parentElement;
    parent.insertBefore(wrapper, messageElement);
    wrapper.appendChild(messageElement);
    wrapper.appendChild(fadeOverlay);

    // State kaydet
    this.collapsedMessages.set(messageElement, {
      wrapper,
      fadeOverlay,
      originalHeight: messageElement.scrollHeight
    });

    this.onStateChange?.(messageElement, true);
  }

  /**
   * Mesajı expand et
   */
  expandMessage(messageElement) {
    const state = this.collapsedMessages.get(messageElement);
    if (!state) return;

    const { wrapper, fadeOverlay } = state;

    // Max height'ı kaldır
    wrapper.style.maxHeight = 'none';
    
    // Fade'i kaldır
    fadeOverlay.style.opacity = '0';
    
    setTimeout(() => {
      // Wrapper'ı kaldır, mesajı geri koy
      const parent = wrapper.parentElement;
      parent.insertBefore(messageElement, wrapper);
      wrapper.remove();
      
      this.collapsedMessages.delete(messageElement);
      this.onStateChange?.(messageElement, false);
    }, 300);
  }

  /**
   * Toggle collapse/expand
   */
  toggleMessage(messageElement) {
    if (this.collapsedMessages.has(messageElement)) {
      this.expandMessage(messageElement);
    } else {
      this.collapseMessage(messageElement);
    }
  }

  /**
   * Mesaj collapsed mı?
   */
  isCollapsed(messageElement) {
    return this.collapsedMessages.has(messageElement);
  }

  /**
   * Tüm collapsed mesajları temizle
   */
  clear() {
    this.collapsedMessages.forEach((state, message) => {
      this.expandMessage(message);
    });
    this.collapsedMessages.clear();
  }
}

export default MessageCollapse;
