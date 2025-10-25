/**
 * BookmarkSidebar - Manages bookmark list in Claude's sidebar
 */
export class BookmarkSidebar {
  constructor(domUtils, getTheme) {
    this.dom = domUtils;
    this.getTheme = getTheme;
    this.elements = {};
    this.lastBookmarkIds = []; // Track to avoid unnecessary updates
  }

  /**
   * Inject bookmarks section into sidebar
   */
  inject() {
    const sidebar = document.querySelector('.flex.flex-col.overflow-y-auto.overflow-x-hidden.relative.px-2.mb-2');
    if (!sidebar) {
      console.log('[BookmarkSidebar] Sidebar not found, retrying in 2s...');
      setTimeout(() => this.inject(), 2000);
      return false;
    }

    // Create bookmark section
    const section = this.dom.createElement('div', {
      className: 'flex flex-col mb-6',
      style: {
        position: 'relative',
      }
    });

    // Header - make it clickable
    const header = this.dom.createElement('h3', {
      className: 'text-text-300 pb-2 mt-1 text-xs select-none pl-2 sticky top-0 z-10 bg-gradient-to-b from-bg-200 from-50% to-bg-200/40 cursor-pointer hover:text-text-100',
      'aria-hidden': 'true',
      style: {
        pointerEvents: 'auto',
        transition: 'color 0.2s ease',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
      }
    });

    // Add SVG icon and text
    header.innerHTML = `${this.getBookmarkSVG()} <span>Bookmarks</span>`;

    // Make header clickable to open bookmarks page
    header.addEventListener('click', () => {
      const bookmarksUrl = chrome.runtime.getURL('bookmarks/bookmarks.html');
      window.open(bookmarksUrl, '_blank');
    });

    // List container
    const list = this.dom.createElement('ul', {
      id: 'claude-bookmarks-sidebar-list',
      className: '-mx-1.5 flex flex-1 flex-col px-1.5 gap-px',
    });

    section.appendChild(header);
    section.appendChild(list);

    // Insert before starred section
    const starredSection = sidebar.querySelector('.flex.flex-col.mb-6');
    if (starredSection) {
      sidebar.insertBefore(section, starredSection);
    } else {
      sidebar.insertBefore(section, sidebar.firstChild);
    }

    this.elements = { section, list };
    console.log('[BookmarkSidebar] ✅ Sidebar injected');
    return true;
  }

  /**
   * Update sidebar with bookmarks
   * Only updates DOM if bookmarks actually changed
   */
  update(bookmarks, onNavigate) {
    const list = this.elements.list;
    if (!list) return;

    // Check if bookmarks actually changed
    const currentIds = bookmarks.map(b => b.id).sort().join(',');
    const lastIds = this.lastBookmarkIds.join(',');

    // Skip update if nothing changed
    if (currentIds === lastIds) {
      return;
    }

    this.lastBookmarkIds = bookmarks.map(b => b.id).sort();

    list.innerHTML = '';

    // Show message if no bookmarks
    if (bookmarks.length === 0) {
      const empty = this.createEmptyState();
      list.appendChild(empty);
    }
  }

  /**
   * Update header to be clickable (called on updates)
   */
  updateHeaderLink() {
    // Header is already set up as clickable in inject()
    // This method is here for consistency
  }

  /**
   * Create empty state
   */
  createEmptyState() {
    const li = this.dom.createElement('li', {
      style: {
        opacity: '1',
      }
    });

    const emptyText = this.dom.createElement('div', {
      textContent: 'No bookmarks yet',
      className: 'text-text-300 text-xs px-4 py-2',
    });

    li.appendChild(emptyText);
    return li;
  }

  /**
   * Create a sidebar bookmark item
   */
  createBookmarkItem(bookmark, onNavigate) {
    const li = this.dom.createElement('li', {
      style: {
        opacity: '1',
      }
    });

    const container = this.dom.createElement('div', {
      className: 'relative group',
      'data-state': 'closed',
    });

    const link = this.dom.createElement('a', {
      className: `inline-flex items-center justify-center relative shrink-0 can-focus select-none
        text-text-300 border-transparent transition font-base duration-300
        ease-[cubic-bezier(0.165,0.85,0.45,1)] hover:bg-bg-300 aria-checked:bg-bg-400
        aria-expanded:bg-bg-400 hover:text-text-100 h-8 rounded-md px-3 min-w-[4rem]
        active:scale-[0.985] whitespace-nowrap !text-xs w-full hover:bg-bg-400 overflow-hidden
        !min-w-0 group active:bg-bg-400 active:scale-[1.0] px-4`,
      style: {
        cursor: 'pointer',
        textDecoration: 'none',
      }
    });

    const innerDiv = this.dom.createElement('div', {
      className: '-translate-x-2 w-full flex flex-row items-center justify-start gap-3',
    });

    const bookmarkIcon = this.dom.createElement('div', {
      className: 'size-4 flex items-center justify-center',
      innerHTML: this.getBookmarkSVG(true), // filled version for items
    });

    const textSpan = this.dom.createElement('span', {
      className: `truncate text-sm whitespace-nowrap w-full
        group-hover:[mask-image:linear-gradient(to_right,hsl(var(--always-black))_78%,transparent_95%)]
        group-focus-within:[mask-image:linear-gradient(to_right,hsl(var(--always-black))_78%,transparent_95%)]
        [mask-size:100%_100%]`,
      textContent: bookmark.previewText.substring(0, 50),
    });

    innerDiv.appendChild(bookmarkIcon);
    innerDiv.appendChild(textSpan);
    link.appendChild(innerDiv);

    // Click handler
    link.addEventListener('click', (e) => {
      e.preventDefault();
      onNavigate(bookmark);
    });

    container.appendChild(link);
    li.appendChild(container);

    return li;
  }

  /**
   * Remove sidebar section
   */
  destroy() {
    if (this.elements.section) {
      this.elements.section.remove();
    }
    this.elements = {};
  }

  /**
   * Get bookmark SVG icon with dark/light mode support
   * @param {boolean} filled - Whether to use filled or stroked version
   * @returns {string} SVG markup
   */
  getBookmarkSVG(filled = false) {
    // Detect dark mode from Claude's UI
    const isDarkMode = document.documentElement.classList.contains('dark') ||
                       document.body.classList.contains('dark') ||
                       window.matchMedia('(prefers-color-scheme: dark)').matches;

    const color = isDarkMode ? '#ffffff' : '#141B34';

    if (filled) {
      return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" style="display: inline-block; vertical-align: middle;">
        <path fill-rule="evenodd" clip-rule="evenodd" d="M4 4.75C4 3.23122 5.23122 2 6.75 2H17.75C19.2688 2 20.5 3.23122 20.5 4.75V21.75C20.5 22.0135 20.3618 22.2576 20.1359 22.3931C19.91 22.5287 19.6295 22.5357 19.3971 22.4118L12.25 18.6L5.10294 22.4118C4.87049 22.5357 4.59003 22.5287 4.36413 22.3931C4.13822 22.2576 4 22.0135 4 21.75V4.75Z" fill="${color}"/>
      </svg>`;
    } else {
      return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" style="display: inline-block; vertical-align: middle;">
        <path d="M12 17.5L19.5 21.5V4.5C19.5 3.39543 18.6046 2.5 17.5 2.5H6.5C5.39543 2.5 4.5 3.39543 4.5 4.5V21.5L12 17.5Z" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`;
    }
  }
}
