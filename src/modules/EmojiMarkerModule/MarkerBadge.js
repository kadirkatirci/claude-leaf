/**
 * MarkerBadge - Displays emoji badges on marked messages
 */
import DOMUtils from '../../utils/DOMUtils.js';
import { cn } from '../../utils/ClassNames.js';

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
      const marker = markers.find(m => m.index === index);

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
    if (this.badgeCache.has(messageEl)) {
      return;
    }

    // Fixed position OUTSIDE the container
    // Same horizontal alignment as marker button, above it
    const markerBtn = messageEl.querySelector('.emoji-marker-btn');

    let badgeRight, badgeTop;

    if (markerBtn) {
      // Marker button exists: show above it
      badgeRight = '-36px'; // Fixed position, same as marker button
      badgeTop = '10px'; // Above the button (prevent overlap)
    } else {
      // No marker button: show outside the container
      badgeRight = '-36px'; // Fixed position
      badgeTop = '10px'; // Normal top position
    }

    const badge = DOMUtils.createElement('div', {
      className: cn(
        'emoji-marker-badge',
        'absolute z-1',
        'size-7 flex items-center justify-center',
        'rounded-full cursor-pointer',
        'text-sm font-bold',
        'transition-all duration-200',
        'hover:scale-110 hover:shadow-lg'
      ),
      innerHTML: marker.emoji,
      title: `Marked with ${marker.emoji}\nClick to see options`,
      style: {
        top: badgeTop, // Dynamic top
        right: badgeRight, // Dynamic right - outside container
        animation: 'fadeIn 0.3s ease',
      },
    });

    // Click handler
    badge.addEventListener('click', e => {
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
      badge.textContent = newEmoji;
      badge.title = `Marked with ${newEmoji}\nClick to see options`;
    }
  }

  /**
   * Show badge options: emoji picker + delete button
   */
  async showBadgeOptions(badge, marker) {
    // First close existing options container (prevent duplicates)
    const existingContainer = badge.querySelector('.emoji-marker-options');
    if (existingContainer) {
      existingContainer.remove();
      return; // Toggle behavior: Close if open
    }

    const theme = this.getTheme();
    const favoriteEmojis = await this.getFavoriteEmojis();

    // Create options container
    const container = DOMUtils.createElement('div', {
      className: cn(
        'emoji-marker-options',
        'absolute top-full right-0 mt-2',
        'bg-bg-000 border border-border-300 rounded-lg shadow-xl',
        'p-2 flex flex-col gap-2 z-[1000]',
        'min-w-[200px]'
      ),
    });

    // Emoji picker grid
    const emojiGrid = DOMUtils.createElement('div');
    emojiGrid.className = 'grid grid-cols-6 gap-1';
    // Fallback: Claude may not have grid classes, add inline styles
    Object.assign(emojiGrid.style, {
      display: 'grid',
      gridTemplateColumns: 'repeat(6, 1fr)',
      gap: '4px',
    });

    const primaryColor = theme.primary || theme.accentColor || '#CC785C';

    favoriteEmojis.forEach(emoji => {
      const isSelected = emoji === marker.emoji;

      const emojiBtn = DOMUtils.createElement('button');
      emojiBtn.innerHTML = emoji;
      emojiBtn.className = cn(
        'size-8 flex items-center justify-center',
        'border-none rounded cursor-pointer',
        'text-lg transition-all duration-200',
        'hover:scale-110',
        isSelected ? 'bg-accent-main-100' : 'bg-bg-100 hover:bg-bg-200'
      );

      if (isSelected) {
        emojiBtn.style.backgroundColor = primaryColor;
      }

      emojiBtn.addEventListener('click', e => {
        e.stopPropagation();
        container.remove();
        this.onMarkerUpdate(marker.id, emoji);
      });

      emojiGrid.appendChild(emojiBtn);
    });

    // Delete button
    const deleteBtn = DOMUtils.createElement('button');
    deleteBtn.innerHTML = '🗑️ Delete Marker';
    // Use inline styles for danger button (red colors not in Claude native classes)
    deleteBtn.className =
      'px-3 py-2 border-none rounded cursor-pointer text-white text-sm font-medium flex items-center justify-center gap-1.5 transition-all duration-200';
    deleteBtn.style.backgroundColor = '#ef4444'; // red-500
    deleteBtn.style.fontFamily = 'inherit';

    // Add hover effect
    deleteBtn.addEventListener('mouseenter', () => {
      deleteBtn.style.backgroundColor = '#dc2626'; // red-600
    });
    deleteBtn.addEventListener('mouseleave', () => {
      deleteBtn.style.backgroundColor = '#ef4444'; // red-500
    });

    deleteBtn.addEventListener('click', e => {
      e.stopPropagation();
      container.remove();
      this.onMarkerRemove(marker.id);
    });

    container.appendChild(emojiGrid);
    container.appendChild(deleteBtn);

    // Add container to badge's parent (messageEl), not to badge itself
    // Show container WITHOUT breaking badge's position
    const messageEl = badge.parentElement;
    if (messageEl) {
      // Get badge's position
      const badgeRect = badge.getBoundingClientRect();
      const messageRect = messageEl.getBoundingClientRect();

      // Position container below badge (relative to message container)
      const topPosition = badgeRect.bottom - messageRect.top + 8; // Below badge, 8px gap
      const rightPosition = messageRect.right - badgeRect.right; // Same right alignment as badge

      container.style.top = `${topPosition}px`;
      container.style.right = `${rightPosition}px`;

      messageEl.appendChild(container);
    }

    // Close on outside click
    setTimeout(() => {
      const closeMenu = e => {
        if (!container.contains(e.target) && !badge.contains(e.target)) {
          container.remove();
          document.removeEventListener('click', closeMenu);
        }
      };
      document.addEventListener('click', closeMenu);
    }, 100);
  }
}
