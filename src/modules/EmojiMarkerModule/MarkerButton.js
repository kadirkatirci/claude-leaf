/**
 * MarkerButton - Manages marker buttons on messages (hover-triggered)
 */
import DOMUtils from '../../utils/DOMUtils.js';
import HoverButtonManager from '../../utils/HoverButtonManager.js';
import IconLibrary from '../../components/primitives/IconLibrary.js';
import { cn, ClaudeClasses } from '../../utils/ClassNames.js';

export class MarkerButton {
  constructor(getTheme, getFavoriteEmojis, emojiPicker, onMarkerAdd, onMarkerRemove, onMarkerUpdate) {
    this.getTheme = getTheme;
    this.getFavoriteEmojis = getFavoriteEmojis;
    this.emojiPicker = emojiPicker;
    this.onMarkerAdd = onMarkerAdd;
    this.onMarkerRemove = onMarkerRemove;
    this.onMarkerUpdate = onMarkerUpdate;
    this.buttonCache = new WeakMap(); // Track buttons by message element
    this.hoverCleanups = new Map(); // Track cleanup functions by message element (Map supports forEach)
  }

  /**
   * Add hover buttons to all messages
   */
  addToMessages(messages, markers) {
    messages.forEach((messageEl, index) => {
      // Skip if button already exists
      if (this.buttonCache.has(messageEl)) {
        // Update button state if marker changed
        const existingMarker = markers.find(m => m.index === index);
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
    // Use HoverButtonManager for delayed hover with bounds checking
    const cleanup = HoverButtonManager.attachDelayedHover(messageEl, button, 100);

    // Store cleanup function
    this.hoverCleanups.set(messageEl, cleanup);
  }

  /**
   * Create marker button for a message
   */
  createButton(messageEl, messageIndex, markers) {
    const existingMarker = markers.find(m => m.index === messageIndex);

    // Container'ın DIŞINDA sabit pozisyon
    const buttonRight = '-36px'; // Sabit pozisyon, bookmark varlığından bağımsız

    const button = DOMUtils.createElement('button');

    // Claude's native button classes - automatically adapts to dark/light mode
    button.className = cn(
      'emoji-marker-btn',
      'absolute',
      'size-8',
      'rounded-md',
      'bg-bg-100',
      'hover:bg-bg-200',
      'border',
      'border-border-300',
      'flex',
      'items-center',
      'justify-center',
      'text-lg',
      'opacity-0',
      'pointer-events-none',
      'transition-all',
      'duration-200',
      'hover:scale-110',
      'hover:shadow-md'
    );

    button.style.cssText = `
      top: 8px;
      right: ${buttonRight};
      display: ${existingMarker ? 'none' : 'flex'};
      z-index: 1;
    `;

    button.innerHTML = IconLibrary.pin('currentColor', 16); // Use pin icon for marker
    button.title = 'Add emoji marker';

    // Click handler - sadece marker yoksa (add için)
    button.addEventListener('click', (e) => {
      e.stopPropagation();

      // Marker button sadece marker yoksa görünür, bu yüzden direkt add
      this.showEmojiPickerForAdd(button, messageEl, messageIndex);
    });

    // Append to message
    messageEl.style.position = 'relative';
    messageEl.appendChild(button);

    return button;
  }

  /**
   * Show emoji picker to add marker
   */
  async showEmojiPickerForAdd(button, messageEl, messageIndex) {
    const favoriteEmojis = await this.getFavoriteEmojis();

    this.emojiPicker.showQuickSelect(button, favoriteEmojis, (emoji) => {
      this.onMarkerAdd(messageEl, messageIndex, emoji);

      // Update button
      button.textContent = emoji;
      button.title = `Marked with ${emoji}`;
      // Add accent color class
      if (!button.classList.contains('bg-accent-main-100')) {
        button.classList.add('bg-accent-main-100');
      }
      // Position stays the same (fixed at -36px)
    });
  }

  /**
   * Show marker options (change/remove)
   */
  showMarkerOptions(button, messageEl, messageIndex, marker) {
    // Create options menu
    const menu = DOMUtils.createElement('div');

    // Claude's native dropdown menu classes
    menu.className = cn(
      'emoji-marker-options',
      ClaudeClasses.menu.container
    );

    // Change emoji button
    const changeBtn = DOMUtils.createElement('button');
    changeBtn.textContent = 'Change Emoji';
    changeBtn.className = ClaudeClasses.menu.item;

    changeBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      menu.remove();

      const favoriteEmojis = await this.getFavoriteEmojis();
      this.emojiPicker.showQuickSelect(button, favoriteEmojis, (emoji) => {
        this.onMarkerUpdate(marker.id, emoji);

        // Update button
        button.textContent = emoji;
        button.title = `Marked with ${emoji}`;
      });
    });

    // Remove button
    const removeBtn = DOMUtils.createElement('button');
    removeBtn.textContent = 'Remove Marker';
    // Use inline styles for danger color (red not in Claude native)
    removeBtn.className = 'px-3 py-1.5 rounded text-white cursor-pointer text-sm text-left transition-colors';
    removeBtn.style.backgroundColor = '#ef4444'; // red-500

    // Add hover effect
    removeBtn.addEventListener('mouseenter', () => {
      removeBtn.style.backgroundColor = '#dc2626'; // red-600
    });
    removeBtn.addEventListener('mouseleave', () => {
      removeBtn.style.backgroundColor = '#ef4444'; // red-500
    });

    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      menu.remove();
      this.onMarkerRemove(marker.id);

      // Update button to "add" state
      button.innerHTML = IconLibrary.pin('currentColor', 16);
      button.title = 'Add emoji marker';
      // Remove custom background to use native classes
      button.style.removeProperty('background');
      // Position stays the same (fixed at -36px)
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

    if (marker) {
      // Marker varsa button'u gizle (badge zaten gösteriyor)
      button.style.display = 'none';
    } else {
      // Marker yoksa button'u göster (add marker için)
      button.style.display = 'flex';
      button.innerHTML = IconLibrary.pin('currentColor', 16);
      button.title = 'Add emoji marker';
      // Remove custom background to use native classes
      button.style.removeProperty('background');
    }
    // Position stays the same (fixed at -36px)
  }

  /**
   * Remove all buttons
   */
  removeAll() {
    // Clean up hover listeners
    this.hoverCleanups.forEach(cleanup => cleanup());
    this.hoverCleanups.clear();

    // Remove buttons
    document.querySelectorAll('.emoji-marker-btn').forEach(btn => btn.remove());
    this.buttonCache = new WeakMap();
  }
}
