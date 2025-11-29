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
      return true;
    }

    // Strategy 1: Find by "Starred" header
    // This is the most reliable way as we want to insert right before it
    const headers = Array.from(document.querySelectorAll('h3'));
    const starredHeader = headers.find(h => h.textContent.trim() === 'Starred');

    let targetContainer = null;
    let insertBeforeElement = null;

    if (starredHeader) {
      // Found Starred header, get its container (the section)
      const starredSection = starredHeader.closest('.flex.flex-col');
      if (starredSection) {
        targetContainer = starredSection.parentElement;
        insertBeforeElement = starredSection;
      }
    }

    // Strategy 2: Fallback to finding the main sidebar container if Starred not found
    if (!targetContainer) {
      const sidebarNav = document.querySelector('nav[aria-label="Sidebar"]');
      if (sidebarNav) {
        // Try to find the inner scrollable container
        // Based on recent HTML: .px-2.mt-4 seems to be the wrapper for sections
        // But let's look for a generic container inside
        const potentialContainers = sidebarNav.querySelectorAll('.flex.flex-col');
        // The one we want usually has other sections
        for (const container of potentialContainers) {
          if (container.querySelector('h3')) {
            targetContainer = container;
            insertBeforeElement = container.firstChild;
            break;
          }
        }
      }
    }

    if (!targetContainer) {
      if (retryCount < maxRetries) {
        setTimeout(() => this.inject(retryCount + 1), 1000);
      }
      return false;
    }

    // Create bookmark section with only header
    const section = this.dom.createElement('div', {
      className: 'flex flex-col mb-4', // Updated to match new Claude style (mb-4 instead of mb-6)
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

    // Insert into DOM
    if (insertBeforeElement && insertBeforeElement.parentNode === targetContainer) {
      targetContainer.insertBefore(section, insertBeforeElement);
    } else {
      targetContainer.appendChild(section);
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
