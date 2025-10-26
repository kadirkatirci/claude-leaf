/**
 * EmojiPicker - Reusable emoji selection component
 */
import DOMUtils from '../../utils/DOMUtils.js';

export class EmojiPicker {
  constructor() {
    this.picker = null;
    this.onSelect = null;

    // Emoji categories
    this.categories = {
      'Symbols': ['⚠️', '❓', '💡', '⭐', '📌', '🔥', '✅', '❌', '⚡', '🎯', '🏆', '💯', '🎉', '🎊', '💥', '✨', '🌟', '💫', '⭕', '🔴', '🟡', '🟢', '🔵', '🟣'],
      'Smileys': ['😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳'],
      'Gestures': ['👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '👇', '☝️', '✋', '🤚', '🖐️', '🖖', '👋', '🤝', '🙏', '💪', '🦾', '🦿'],
      'Objects': ['📝', '📋', '📌', '📍', '🗒️', '📄', '📃', '📑', '🔖', '🏷️', '💼', '📂', '📁', '🗂️', '📊', '📈', '📉', '📊', '💡', '🔦', '🔍', '🔎', '🔐', '🔒', '🔓', '🔑'],
      'Flags': ['🚩', '🎌', '🏁', '🏳️', '🏴', '🏳️‍🌈', '🏴‍☠️'],
      'Hearts': ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝'],
    };

    // Flatten all emojis for search
    this.allEmojis = Object.values(this.categories).flat();
  }

  /**
   * Show quick select picker (favorites only)
   */
  showQuickSelect(targetElement, favoriteEmojis, onSelect) {
    this.onSelect = onSelect;
    this.removePicker(); // Remove any existing picker

    const theme = this.getTheme();

    const picker = DOMUtils.createElement('div', {
      id: 'emoji-quick-picker',
      style: {
        position: 'absolute',
        background: theme.isDark ? '#2d2d2d' : 'white',
        border: `2px solid ${theme.primary}`,
        borderRadius: '12px',
        padding: '12px',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
        zIndex: '10000',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        minWidth: '280px',
      }
    });

    // Quick select section
    const quickSection = DOMUtils.createElement('div', {
      style: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: '6px',
      }
    });

    // Add favorite emoji buttons
    favoriteEmojis.forEach(emoji => {
      const btn = this.createEmojiButton(emoji, false);
      quickSection.appendChild(btn);
    });

    // Add "more" button for full picker
    const moreBtn = DOMUtils.createElement('button', {
      innerHTML: '⋯',
      title: 'More emojis',
      style: {
        width: '36px',
        height: '36px',
        fontSize: '20px',
        border: `1px solid ${theme.isDark ? '#555' : '#ddd'}`,
        borderRadius: '6px',
        background: theme.isDark ? '#3d3d3d' : '#f5f5f5',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.2s',
      }
    });

    moreBtn.addEventListener('mouseenter', () => {
      moreBtn.style.background = theme.isDark ? '#4d4d4d' : '#e5e5e5';
      moreBtn.style.transform = 'scale(1.1)';
    });

    moreBtn.addEventListener('mouseleave', () => {
      moreBtn.style.background = theme.isDark ? '#3d3d3d' : '#f5f5f5';
      moreBtn.style.transform = 'scale(1)';
    });

    moreBtn.addEventListener('click', () => {
      this.showFullPicker(targetElement, favoriteEmojis, onSelect);
    });

    quickSection.appendChild(moreBtn);
    picker.appendChild(quickSection);

    // Position picker
    this.positionPicker(picker, targetElement);
    document.body.appendChild(picker);
    this.picker = picker;

    // Close on outside click
    setTimeout(() => {
      document.addEventListener('click', this.handleOutsideClick);
    }, 100);
  }

  /**
   * Show full emoji picker
   */
  showFullPicker(targetElement, favoriteEmojis, onSelect) {
    this.onSelect = onSelect;
    this.removePicker();

    const theme = this.getTheme();

    const picker = DOMUtils.createElement('div', {
      id: 'emoji-full-picker',
      style: {
        position: 'absolute',
        background: theme.isDark ? '#2d2d2d' : 'white',
        border: `2px solid ${theme.primary}`,
        borderRadius: '12px',
        padding: '12px',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
        zIndex: '10000',
        width: '320px',
        maxHeight: '400px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }
    });

    // Search box
    const searchBox = DOMUtils.createElement('input', {
      type: 'text',
      placeholder: 'Search emoji...',
      style: {
        padding: '8px 12px',
        border: `1px solid ${theme.isDark ? '#555' : '#ddd'}`,
        borderRadius: '6px',
        background: theme.isDark ? '#1d1d1d' : 'white',
        color: theme.isDark ? 'white' : 'black',
        fontSize: '14px',
        outline: 'none',
      }
    });

    // Content area
    const content = DOMUtils.createElement('div', {
      style: {
        overflowY: 'auto',
        maxHeight: '320px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }
    });

    // Add favorites at top
    const favSection = this.createCategorySection('⭐ Favorites', favoriteEmojis);
    content.appendChild(favSection);

    // Add all categories
    Object.entries(this.categories).forEach(([name, emojis]) => {
      const section = this.createCategorySection(name, emojis);
      content.appendChild(section);
    });

    // Search functionality
    searchBox.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase().trim();
      if (query === '') {
        // Show all
        content.querySelectorAll('.emoji-category').forEach(cat => {
          cat.style.display = 'flex';
        });
      } else {
        // Filter emojis (simple search - can be improved)
        content.querySelectorAll('.emoji-category').forEach(cat => {
          cat.style.display = 'none';
        });

        // Create filtered section
        const filtered = this.allEmojis; // In real app, you'd filter based on emoji names
        const filteredSection = this.createCategorySection('Search Results', filtered);
        filteredSection.id = 'search-results';

        // Remove old search results
        const oldResults = content.querySelector('#search-results');
        if (oldResults) oldResults.remove();

        content.insertBefore(filteredSection, content.firstChild);
      }
    });

    picker.appendChild(searchBox);
    picker.appendChild(content);

    // Position picker
    this.positionPicker(picker, targetElement);
    document.body.appendChild(picker);
    this.picker = picker;

    // Focus search box
    setTimeout(() => searchBox.focus(), 100);

    // Close on outside click
    setTimeout(() => {
      document.addEventListener('click', this.handleOutsideClick);
    }, 100);
  }

  /**
   * Create category section
   */
  createCategorySection(name, emojis) {
    const section = DOMUtils.createElement('div', {
      className: 'emoji-category',
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
      }
    });

    const title = DOMUtils.createElement('div', {
      textContent: name,
      style: {
        fontSize: '12px',
        fontWeight: 'bold',
        color: '#888',
        marginBottom: '4px',
      }
    });

    const emojiGrid = DOMUtils.createElement('div', {
      style: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: '4px',
      }
    });

    emojis.forEach(emoji => {
      const btn = this.createEmojiButton(emoji, true);
      emojiGrid.appendChild(btn);
    });

    section.appendChild(title);
    section.appendChild(emojiGrid);
    return section;
  }

  /**
   * Create emoji button
   */
  createEmojiButton(emoji, small = false) {
    const theme = this.getTheme();
    const size = small ? '32px' : '36px';
    const fontSize = small ? '18px' : '20px';

    const btn = DOMUtils.createElement('button', {
      innerHTML: emoji,
      title: emoji,
      style: {
        width: size,
        height: size,
        fontSize: fontSize,
        border: `1px solid ${theme.isDark ? '#555' : '#ddd'}`,
        borderRadius: '6px',
        background: theme.isDark ? '#3d3d3d' : '#f5f5f5',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.2s',
        padding: '0',
      }
    });

    btn.addEventListener('mouseenter', () => {
      btn.style.background = theme.isDark ? '#4d4d4d' : '#e5e5e5';
      btn.style.transform = 'scale(1.1)';
    });

    btn.addEventListener('mouseleave', () => {
      btn.style.background = theme.isDark ? '#3d3d3d' : '#f5f5f5';
      btn.style.transform = 'scale(1)';
    });

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.onSelect) {
        this.onSelect(emoji);
      }
      this.removePicker();
    });

    return btn;
  }

  /**
   * Position picker relative to target
   */
  positionPicker(picker, targetElement) {
    const rect = targetElement.getBoundingClientRect();
    const pickerWidth = 320; // approximate

    // Position below target, aligned to right
    let left = rect.right - pickerWidth;
    let top = rect.bottom + 8;

    // Keep within viewport
    if (left < 10) left = 10;
    if (left + pickerWidth > window.innerWidth - 10) {
      left = window.innerWidth - pickerWidth - 10;
    }

    if (top + 400 > window.innerHeight) {
      top = rect.top - 408; // Position above
    }

    picker.style.left = `${left}px`;
    picker.style.top = `${top}px`;
  }

  /**
   * Remove picker
   */
  removePicker() {
    if (this.picker) {
      this.picker.remove();
      this.picker = null;
    }
    document.removeEventListener('click', this.handleOutsideClick);
  }

  /**
   * Handle outside click
   */
  handleOutsideClick = (e) => {
    if (this.picker && !this.picker.contains(e.target)) {
      this.removePicker();
    }
  }

  /**
   * Get theme (simplified)
   */
  getTheme() {
    const isDark = document.documentElement.classList.contains('dark');
    return {
      isDark,
      primary: '#9333ea',
    };
  }
}
