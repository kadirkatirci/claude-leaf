/**
 * MarkerBadge - Displays emoji badges on marked messages
 */
import DOMUtils from '../../utils/DOMUtils.js';

export class MarkerBadge {
  constructor(getTheme, onClick) {
    this.getTheme = getTheme;
    this.onClick = onClick; // Callback when badge clicked
    this.badgeCache = new WeakMap(); // Track badges by message element
  }

  /**
   * Update all badges for current messages
   */
  updateAll(messages, markers) {
    // Remove old badges
    this.removeAll();

    // Add badges for marked messages
    messages.forEach((messageEl, index) => {
      const marker = markers.find(m => m.messageIndex === index);
      if (marker) {
        this.addBadge(messageEl, marker);
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

    const badge = DOMUtils.createElement('div', {
      className: 'emoji-marker-badge',
      innerHTML: marker.emoji,
      title: `Marked with ${marker.emoji}\nClick to see options`,
      style: {
        position: 'absolute',
        top: '8px',
        right: '88px', // Right of bookmark badge and marker button
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
      if (this.onClick) {
        this.onClick(marker);
      }
    });

    // Append to message
    messageEl.style.position = 'relative';
    messageEl.appendChild(badge);

    // Cache badge
    this.badgeCache.set(messageEl, badge);
  }

  /**
   * Remove badge from a message
   */
  removeBadge(messageEl) {
    const badge = this.badgeCache.get(messageEl);
    if (badge) {
      badge.remove();
      this.badgeCache.delete(messageEl);
    }
  }

  /**
   * Remove all badges
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
}
