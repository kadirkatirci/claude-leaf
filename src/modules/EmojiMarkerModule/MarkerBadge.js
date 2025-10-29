/**
 * MarkerBadge - Displays emoji badges on marked messages
 */
import DOMUtils from '../../utils/DOMUtils.js';

export class MarkerBadge {
  constructor(getTheme, emojiPicker, getFavoriteEmojis, onMarkerUpdate, onMarkerRemove) {
    this.getTheme = getTheme;
    this.emojiPicker = emojiPicker;
    this.getFavoriteEmojis = getFavoriteEmojis;
    this.onMarkerUpdate = onMarkerUpdate;
    this.onMarkerRemove = onMarkerRemove;
    this.badgeCache = new WeakMap(); // Track badges by message element
  }

  /**
   * Update all badges for current messages
   * Smart update: Only add/update/remove changed badges
   */
  updateAll(messages, markers) {
    messages.forEach((messageEl, index) => {
      const marker = markers.find(m => m.messageIndex === index);

      if (marker) {
        // Badge should exist
        if (!this.badgeCache.has(messageEl)) {
          // Add new badge
          this.addBadge(messageEl, marker);
        } else {
          // Update existing badge if emoji changed
          const existingBadge = this.badgeCache.get(messageEl);
          if (existingBadge.innerHTML !== marker.emoji) {
            this.updateBadge(messageEl, marker.emoji);
          }
        }
      } else {
        // Badge should not exist
        if (this.badgeCache.has(messageEl)) {
          // Remove badge
          this.removeBadge(messageEl);
        }
      }
    });
  }

  /**
   * Add emoji badge to a message
   */
  addBadge(messageEl, marker) {
    // Skip if badge already exists
    if (this.badgeCache.has(messageEl)) return;

    const theme = this.getTheme();

    // Container'ın DIŞINDA sabit pozisyon
    // Marker button ile aynı yatay hizada, üstünde
    const markerBtn = messageEl.querySelector('.emoji-marker-btn');

    let badgeRight, badgeTop;

    if (markerBtn) {
      // Marker button var: onun üstünde göster
      badgeRight = '-36px'; // Sabit pozisyon, marker button ile aynı
      badgeTop = '-25px'; // Button'un üstünde (çakışmayı önle)
    } else {
      // Marker button yok: container'ın dışında göster
      badgeRight = '-36px'; // Sabit pozisyon
      badgeTop = '8px'; // Normal top pozisyonu
    }

    const badge = DOMUtils.createElement('div', {
      className: 'emoji-marker-badge',
      innerHTML: marker.emoji,
      title: `Marked with ${marker.emoji}\nClick to see options`,
      style: {
        position: 'absolute',
        top: badgeTop, // Dinamik top
        right: badgeRight, // Dinamik right - container dışında
        width: '28px',
        height: '28px',
        borderRadius: '50%',
        background: theme.gradient,
        border: `2px solid ${theme.isDark ? '#1d1d1d' : 'white'}`,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '14px',
        fontWeight: 'bold',
        boxShadow: '0 2px 6px rgba(0, 0, 0, 0.15)',
        transition: 'all 0.2s ease',
        zIndex: '99',
        animation: 'fadeIn 0.3s ease',
      }
    });

    // Hover effect
    badge.addEventListener('mouseenter', () => {
      badge.style.transform = 'scale(1.15)';
      badge.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.25)';
    });

    badge.addEventListener('mouseleave', () => {
      badge.style.transform = 'scale(1)';
      badge.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.15)';
    });

    // Click handler
    badge.addEventListener('click', (e) => {
      e.stopPropagation();
      this.showBadgeOptions(badge, marker);
    });

    // Append to message
    messageEl.style.position = 'relative';
    messageEl.appendChild(badge);

    // Cache badge
    this.badgeCache.set(messageEl, badge);
  }

  /**
   * Remove badge from a specific message
   */
  removeBadge(messageEl) {
    const badge = this.badgeCache.get(messageEl);
    if (badge) {
      badge.remove();
      this.badgeCache.delete(messageEl);
    }
  }

  /**
   * Remove all badges (used in destroy)
   */
  removeAll() {
    document.querySelectorAll('.emoji-marker-badge').forEach(badge => badge.remove());
    this.badgeCache = new WeakMap();
  }

  /**
   * Update badge emoji (when marker changed)
   */
  updateBadge(messageEl, newEmoji) {
    const badge = this.badgeCache.get(messageEl);
    if (badge) {
      badge.innerHTML = newEmoji;
      badge.title = `Marked with ${newEmoji}\nClick to see options`;
    }
  }

  /**
   * Show badge options: emoji picker + delete button
   */
  showBadgeOptions(badge, marker) {
    // Önce mevcut options container'ı kapat (duplicate önleme)
    const existingContainer = badge.querySelector('.emoji-marker-options');
    if (existingContainer) {
      existingContainer.remove();
      return; // Toggle behavior: Açıksa kapat
    }

    const theme = this.getTheme();
    const favoriteEmojis = this.getFavoriteEmojis();

    // Create options container
    const container = DOMUtils.createElement('div', {
      className: 'emoji-marker-options',
      style: {
        position: 'absolute',
        top: '100%',
        right: '0',
        marginTop: '8px',
        background: theme.isDark ? '#2d2d2d' : 'white',
        border: `1px solid ${theme.isDark ? '#555' : '#ddd'}`,
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
        padding: '8px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        zIndex: '1000',
        minWidth: '200px',
      }
    });

    // Emoji picker grid
    const emojiGrid = DOMUtils.createElement('div', {
      style: {
        display: 'grid',
        gridTemplateColumns: 'repeat(6, 1fr)',
        gap: '4px',
      }
    });

    favoriteEmojis.forEach(emoji => {
      const emojiBtn = DOMUtils.createElement('button', {
        innerHTML: emoji,
        style: {
          width: '32px',
          height: '32px',
          border: 'none',
          borderRadius: '4px',
          background: emoji === marker.emoji ? theme.gradient : (theme.isDark ? '#3d3d3d' : '#f5f5f5'),
          cursor: 'pointer',
          fontSize: '18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s ease',
        }
      });

      emojiBtn.addEventListener('mouseenter', () => {
        emojiBtn.style.transform = 'scale(1.1)';
      });

      emojiBtn.addEventListener('mouseleave', () => {
        emojiBtn.style.transform = 'scale(1)';
      });

      emojiBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        container.remove();
        this.onMarkerUpdate(marker.id, emoji);
      });

      emojiGrid.appendChild(emojiBtn);
    });

    // Delete button
    const deleteBtn = DOMUtils.createElement('button', {
      innerHTML: '🗑️ Delete Marker',
      style: {
        padding: '8px 12px',
        border: 'none',
        borderRadius: '6px',
        background: '#ef4444',
        color: 'white',
        cursor: 'pointer',
        fontSize: '13px',
        fontWeight: '500',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        transition: 'all 0.2s ease',
      }
    });

    deleteBtn.addEventListener('mouseenter', () => {
      deleteBtn.style.background = '#dc2626';
    });

    deleteBtn.addEventListener('mouseleave', () => {
      deleteBtn.style.background = '#ef4444';
    });

    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      container.remove();
      this.onMarkerRemove(marker.id);
    });

    container.appendChild(emojiGrid);
    container.appendChild(deleteBtn);

    // Container'ı badge'e değil, badge'in parent'ına (messageEl) ekle
    // Badge'in position'ını BOZMADAN container'ı göster
    const messageEl = badge.parentElement;
    if (messageEl) {
      // Badge'in pozisyonunu al
      const badgeRect = badge.getBoundingClientRect();
      const messageRect = messageEl.getBoundingClientRect();

      // Container'ı badge'in altına konumlandır (message container'a göre)
      const topPosition = badgeRect.bottom - messageRect.top + 8; // Badge'in altında, 8px gap
      const rightPosition = messageRect.right - badgeRect.right; // Badge ile aynı right hizasında

      container.style.top = `${topPosition}px`;
      container.style.right = `${rightPosition}px`;

      messageEl.appendChild(container);
    }

    // Close on outside click
    setTimeout(() => {
      const closeMenu = (e) => {
        if (!container.contains(e.target) && !badge.contains(e.target)) {
          container.remove();
          document.removeEventListener('click', closeMenu);
        }
      };
      document.addEventListener('click', closeMenu);
    }, 100);
  }
}
