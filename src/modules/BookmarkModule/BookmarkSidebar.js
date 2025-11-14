/**
 * BookmarkSidebar - Adds clickable Bookmarks header to Claude's sidebar
 */
import IconLibrary from '../../components/primitives/IconLibrary.js';

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
      // Already injected and in DOM
      return true;
    }

    const sidebar = document.querySelector('.flex.flex-col.overflow-y-auto.overflow-x-hidden.relative.px-2.mb-2');
    if (!sidebar) {
      if (retryCount < maxRetries) {
        // Retry silently (no console spam)
        setTimeout(() => this.inject(retryCount + 1), 1000);
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
    header.innerHTML = `${IconLibrary.bookmarkWithDarkMode()} <span>Bookmarks</span>`;

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

}
