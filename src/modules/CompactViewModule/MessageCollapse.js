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
    const settings = this.settings();
    const minLines = settings.minLines || 30;

    // Satır sayısını hesapla (yaklaşık 24px per line)
    const lineHeight = 24;
    const lines = Math.floor(messageElement.scrollHeight / lineHeight);

    return lines > minLines;
  }

  /**
   * Mesajı collapse et
   */
  collapseMessage(messageElement) {
    if (this.collapsedMessages.get(messageElement)) {
      return; // Zaten collapsed
    }

    const settings = this.settings();
    const previewLines = settings.previewLines || 8;
    const fadeHeight = 120; // Daha uzun fade için

    // Scroll position'u kaydet (scroll sorunu için)
    const scrollY = window.scrollY;

    // Get computed background color from body for theme-aware gradient
    const computedBg = window.getComputedStyle(document.body).backgroundColor || 'rgb(255, 255, 255)';

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

    // Theme-aware fade overlay using CSS variables (Claude native colors)
    const fadeOverlay = DOMUtils.createElement('div', {
      className: 'claude-collapse-fade',
      style: {
        position: 'absolute',
        bottom: '0',
        left: '0',
        right: '0',
        height: `${fadeHeight}px`,
        // Multi-stop gradient for smooth fade using computed body background
        background: `linear-gradient(to bottom, 
          transparent 0%, 
          ${computedBg.replace('rgb', 'rgba').replace(')', ', 0.3)')} 40%, 
          ${computedBg.replace('rgb', 'rgba').replace(')', ', 0.8)')} 70%, 
          ${computedBg} 100%
        )`,
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

    // Scroll position'u geri yükle
    requestAnimationFrame(() => {
      window.scrollTo(0, scrollY);
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

    // Scroll position'u kaydet
    const scrollY = window.scrollY;

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

      // Scroll position'u geri yükle
      requestAnimationFrame(() => {
        window.scrollTo(0, scrollY);
      });

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
