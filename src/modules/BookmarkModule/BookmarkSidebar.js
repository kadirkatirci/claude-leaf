/**
 * BookmarkSidebar - Adds clickable Bookmarks header to Claude's sidebar
 */
export class BookmarkSidebar {
  constructor(domUtils, getTheme) {
    this.dom = domUtils;
    this.getTheme = getTheme;
    this.elements = {};
  }

  /**
   * Inject bookmarks header into sidebar
   */
  inject(retryCount = 0) {
    const maxRetries = 10;

    // Don't inject if already exists
    if (this.elements.section && document.body.contains(this.elements.section)) {
      console.log('[BookmarkSidebar] Section already exists in DOM');
      return true;
    }

    const sidebar = document.querySelector('.flex.flex-col.overflow-y-auto.overflow-x-hidden.relative.px-2.mb-2');
    if (!sidebar) {
      if (retryCount < maxRetries) {
        console.log(`[BookmarkSidebar] Sidebar not found, retry ${retryCount + 1}/${maxRetries}...`);
        setTimeout(() => this.inject(retryCount + 1), 1000);
      } else {
        console.error('[BookmarkSidebar] Sidebar not found after max retries');
      }
      return false;
    }

    // Create bookmark section with only header
    const section = this.dom.createElement('div', {
      className: 'flex flex-col mb-6',
      style: {
        position: 'relative',
      }
    });

    // Header - make it clickable to open bookmarks page
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

    section.appendChild(header);

    // Insert before starred section
    const starredSection = sidebar.querySelector('.flex.flex-col.mb-6');
    if (starredSection && starredSection.parentNode === sidebar) {
      // Verify starredSection is actually a child of sidebar
      sidebar.insertBefore(section, starredSection);
    } else if (sidebar.firstChild) {
      // Insert before first child if it exists
      sidebar.insertBefore(section, sidebar.firstChild);
    } else {
      // Fallback: just append
      sidebar.appendChild(section);
    }

    this.elements = { section };
    console.log('[BookmarkSidebar] ✅ Sidebar header injected');
    return true;
  }

  /**
   * Update method kept for compatibility but does nothing
   */
  update() {
    // No-op: We only show the clickable header
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
