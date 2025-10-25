/**
 * BookmarkSidebar - Manages bookmark list in Claude's sidebar
 */
export class BookmarkSidebar {
  constructor(domUtils, getTheme) {
    this.dom = domUtils;
    this.getTheme = getTheme;
    this.elements = {};
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
      textContent: '🔖 Bookmarks',
      className: 'text-text-300 pb-2 mt-1 text-xs select-none pl-2 sticky top-0 z-10 bg-gradient-to-b from-bg-200 from-50% to-bg-200/40 cursor-pointer hover:text-text-100',
      'aria-hidden': 'true',
      style: {
        pointerEvents: 'auto',
        transition: 'color 0.2s ease',
      }
    });

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
   */
  update(bookmarks, onNavigate) {
    // Update header to be clickable
    this.updateHeaderLink();

    const list = this.elements.list;
    if (!list) return;

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
      innerHTML: '🔖',
      style: {
        fontSize: '14px',
      }
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
}
