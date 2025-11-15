/**
 * EmojiPicker - Reusable emoji selection component
 */
import DOMUtils from '../../utils/DOMUtils.js';
import { cn, panelClass, ClaudeClasses } from '../../utils/ClassNames.js';

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

    const picker = DOMUtils.createElement('div');
    picker.id = 'emoji-quick-picker';
    picker.className = panelClass('dropdown', 'min-w-[280px]');

    // Quick select section
    const quickSection = DOMUtils.createElement('div');
    quickSection.className = 'flex flex-wrap gap-1.5';

    // Add favorite emoji buttons
    favoriteEmojis.forEach(emoji => {
      const btn = this.createEmojiButton(emoji, false);
      quickSection.appendChild(btn);
    });

    // Add "more" button for full picker
    const moreBtn = DOMUtils.createElement('button');
    moreBtn.textContent = '⋯';
    moreBtn.title = 'More emojis';
    moreBtn.className = cn(
      ClaudeClasses.button.icon,
      ClaudeClasses.util.transition
    );

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

    const picker = DOMUtils.createElement('div');
    picker.id = 'emoji-full-picker';
    picker.className = panelClass('dropdown', 'w-80 max-h-[400px] overflow-hidden');

    // Search box
    const searchBox = DOMUtils.createElement('input');
    searchBox.type = 'text';
    searchBox.placeholder = 'Search emoji...';
    searchBox.className = ClaudeClasses.input.search;

    // Content area
    const content = DOMUtils.createElement('div');
    content.className = 'overflow-y-auto max-h-80 flex flex-col gap-3';

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
    const section = DOMUtils.createElement('div');
    section.className = 'emoji-category flex flex-col gap-1.5';

    const title = DOMUtils.createElement('div');
    title.textContent = name;
    title.className = 'text-xs font-bold text-text-400 mb-1';

    const emojiGrid = DOMUtils.createElement('div');
    emojiGrid.className = 'flex flex-wrap gap-1';

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
    const btn = DOMUtils.createElement('button');
    btn.textContent = emoji;
    btn.title = emoji;

    const sizeClass = small ? 'size-8 text-lg' : 'size-9 text-xl';
    btn.className = cn(
      sizeClass,
      'border border-border-300 rounded-md bg-bg-100 hover:bg-bg-200',
      'cursor-pointer flex items-center justify-center p-0',
      'transition-all hover:scale-110'
    );

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
}
