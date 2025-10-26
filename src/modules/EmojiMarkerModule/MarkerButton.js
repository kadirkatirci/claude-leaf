/**
 * MarkerButton - Manages marker buttons on messages (hover-triggered)
 */
import DOMUtils from '../../utils/DOMUtils.js';

export class MarkerButton {
  constructor(getTheme, getFavoriteEmojis, emojiPicker, onMarkerAdd, onMarkerRemove, onMarkerUpdate) {
    this.getTheme = getTheme;
    this.getFavoriteEmojis = getFavoriteEmojis;
    this.emojiPicker = emojiPicker;
    this.onMarkerAdd = onMarkerAdd;
    this.onMarkerRemove = onMarkerRemove;
    this.onMarkerUpdate = onMarkerUpdate;
    this.buttonCache = new WeakMap(); // Track buttons by message element
  }

  /**
   * Add hover buttons to all messages
   */
  addToMessages(messages, markers) {
    messages.forEach((messageEl, index) => {
      // Skip if button already exists
      if (this.buttonCache.has(messageEl)) {
        // Update button state if marker changed
        const existingMarker = markers.find(m => m.messageIndex === index);
        this.updateButtonState(messageEl, existingMarker);
        return;
      }

      // Create marker button
      const button = this.createButton(messageEl, index, markers);
      this.buttonCache.set(messageEl, button);

      // Attach hover listeners (SADECE BİR KEZ!)
      this.attachHoverListeners(messageEl, button);
    });
  }

  /**
   * Attach hover event listeners to show/hide button
   * Called only once when button is first created
   */
  attachHoverListeners(messageEl, button) {
    messageEl.addEventListener('mouseenter', () => {
      button.style.opacity = '1';
      button.style.pointerEvents = 'auto';
    });

    messageEl.addEventListener('mouseleave', () => {
      button.style.opacity = '0';
      button.style.pointerEvents = 'none';
    });
  }

  /**
   * Create marker button for a message
   */
  createButton(messageEl, messageIndex, markers) {
    const theme = this.getTheme();
    const existingMarker = markers.find(m => m.messageIndex === messageIndex);

    // Dinamik pozisyonlama: Bookmark button var mı kontrol et
    const bookmarkBtn = messageEl.querySelector('.claude-bookmark-btn');
    const buttonRight = bookmarkBtn ? '48px' : '8px'; // Bookmark'un yanında veya sağda

    const button = DOMUtils.createElement('button', {
      className: 'emoji-marker-btn',
      innerHTML: existingMarker ? existingMarker.emoji : '🏷️',
      title: existingMarker ? `Marked with ${existingMarker.emoji}` : 'Add emoji marker',
      style: {
        position: 'absolute',
        top: '8px',
        right: buttonRight, // Dinamik pozisyon
        width: '32px',
        height: '32px',
        borderRadius: '6px',
        background: existingMarker ? theme.gradient : (theme.isDark ? '#3d3d3d' : '#f5f5f5'),
        border: `1px solid ${theme.isDark ? '#555' : '#ddd'}`,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: existingMarker ? '16px' : '18px',
        opacity: '0',
        pointerEvents: 'none',
        transition: 'all 0.2s ease',
        zIndex: '100',
      }
    });

    // Hover effects
    button.addEventListener('mouseenter', () => {
      button.style.transform = 'scale(1.1)';
      button.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.2)';
    });

    button.addEventListener('mouseleave', () => {
      button.style.transform = 'scale(1)';
      button.style.boxShadow = 'none';
    });

    // Click handler
    button.addEventListener('click', (e) => {
      e.stopPropagation();

      if (existingMarker) {
        // Show options: change emoji or remove
        this.showMarkerOptions(button, messageEl, messageIndex, existingMarker);
      } else {
        // Show emoji picker to add marker
        this.showEmojiPickerForAdd(button, messageEl, messageIndex);
      }
    });

    // Append to message
    messageEl.style.position = 'relative';
    messageEl.appendChild(button);

    return button;
  }

  /**
   * Show emoji picker to add marker
   */
  showEmojiPickerForAdd(button, messageEl, messageIndex) {
    const favoriteEmojis = this.getFavoriteEmojis();

    this.emojiPicker.showQuickSelect(button, favoriteEmojis, (emoji) => {
      this.onMarkerAdd(messageEl, messageIndex, emoji);

      // Update button
      button.innerHTML = emoji;
      button.title = `Marked with ${emoji}`;
      button.style.background = this.getTheme().gradient;
      button.style.right = '48px'; // Move right
    });
  }

  /**
   * Show marker options (change/remove)
   */
  showMarkerOptions(button, messageEl, messageIndex, marker) {
    const theme = this.getTheme();

    // Create options menu
    const menu = DOMUtils.createElement('div', {
      style: {
        position: 'absolute',
        top: '100%',
        right: '0',
        marginTop: '4px',
        background: theme.isDark ? '#2d2d2d' : 'white',
        border: `1px solid ${theme.isDark ? '#555' : '#ddd'}`,
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
        padding: '8px',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        zIndex: '101',
        minWidth: '120px',
      }
    });

    // Change emoji button
    const changeBtn = DOMUtils.createElement('button', {
      textContent: 'Change Emoji',
      style: {
        padding: '6px 12px',
        border: 'none',
        borderRadius: '4px',
        background: theme.isDark ? '#3d3d3d' : '#f5f5f5',
        color: theme.isDark ? 'white' : 'black',
        cursor: 'pointer',
        fontSize: '13px',
        textAlign: 'left',
      }
    });

    changeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      menu.remove();

      const favoriteEmojis = this.getFavoriteEmojis();
      this.emojiPicker.showQuickSelect(button, favoriteEmojis, (emoji) => {
        this.onMarkerUpdate(marker.id, emoji);

        // Update button
        button.innerHTML = emoji;
        button.title = `Marked with ${emoji}`;
      });
    });

    // Remove button
    const removeBtn = DOMUtils.createElement('button', {
      textContent: 'Remove Marker',
      style: {
        padding: '6px 12px',
        border: 'none',
        borderRadius: '4px',
        background: '#ef4444',
        color: 'white',
        cursor: 'pointer',
        fontSize: '13px',
        textAlign: 'left',
      }
    });

    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      menu.remove();
      this.onMarkerRemove(marker.id);

      // Update button to "add" state
      button.innerHTML = '🏷️';
      button.title = 'Add emoji marker';
      button.style.background = theme.isDark ? '#3d3d3d' : '#f5f5f5';
      button.style.right = '8px';
    });

    menu.appendChild(changeBtn);
    menu.appendChild(removeBtn);

    button.style.position = 'relative';
    button.appendChild(menu);

    // Close on outside click
    setTimeout(() => {
      const closeMenu = (e) => {
        if (!menu.contains(e.target)) {
          menu.remove();
          document.removeEventListener('click', closeMenu);
        }
      };
      document.addEventListener('click', closeMenu);
    }, 100);
  }

  /**
   * Update button state based on marker
   */
  updateButtonState(messageEl, marker) {
    const button = this.buttonCache.get(messageEl);
    if (!button) return;

    const theme = this.getTheme();

    if (marker) {
      button.innerHTML = marker.emoji;
      button.title = `Marked with ${marker.emoji}`;
      button.style.background = theme.gradient;
      button.style.right = '48px';
    } else {
      button.innerHTML = '🏷️';
      button.title = 'Add emoji marker';
      button.style.background = theme.isDark ? '#3d3d3d' : '#f5f5f5';
      button.style.right = '8px';
    }
  }

  /**
   * Remove all buttons
   */
  removeAll() {
    document.querySelectorAll('.emoji-marker-btn').forEach(btn => btn.remove());
    this.buttonCache = new WeakMap();
  }
}
