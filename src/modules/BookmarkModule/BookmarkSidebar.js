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

    // Find sidebar nav first (more stable selector)
    const sidebarNav = document.querySelector('nav[aria-label="Sidebar"]');
    if (!sidebarNav) {
      if (retryCount < maxRetries) {
        setTimeout(() => this.inject(retryCount + 1), 1000);
      }
      return false;
    }

    // Find the container that holds Chats, Projects, etc.
    // Try multiple selectors for robustness against UI changes
    let container =
      sidebarNav.querySelector('.flex.flex-col.px-2.gap-px.pt-px') ||
      sidebarNav.querySelector('.flex.flex-col.px-2.gap-px') ||
      sidebarNav.querySelector('.flex.flex-col.px-2');

    // Fallback: find container by looking for nav items (Chats, Projects links)
    if (!container) {
      const navLinks = sidebarNav.querySelectorAll('a[data-dd-action-name="sidebar-nav-item"]');
      if (navLinks.length > 0) {
        // Get the parent container of the first nav link
        const firstLink = navLinks[0];
        container = firstLink.closest('.flex.flex-col') || firstLink.parentElement?.parentElement;
      }
    }

    if (!container) {
      if (retryCount < maxRetries) {
        setTimeout(() => this.inject(retryCount + 1), 1000);
      }
      return false;
    }

    // Create the bookmark item matching native structure
    const bookmarkItem = this.dom.createElement('div', {
      className: 'relative group',
      'data-state': 'closed',
    });

    // Create the link
    const link = this.dom.createElement('a', {
      className: `inline-flex
  items-center
  justify-center
  relative
  shrink-0
  can-focus
  select-none
  disabled:pointer-events-none
  disabled:opacity-50
  disabled:shadow-none
  disabled:drop-shadow-none border-transparent
          transition
          font-base
          duration-300
          ease-[cubic-bezier(0.165,0.85,0.45,1)] h-8 rounded-md px-3 min-w-[4rem] active:scale-[0.985] whitespace-nowrap !text-xs w-full overflow-hidden !min-w-0 group py-1.5 rounded-lg px-4 !duration-75 active:bg-bg-300 active:scale-[1.0] Button_ghost__BUAoh`,
      'aria-label': 'Bookmarks',
      'data-dd-action-name': 'sidebar-nav-item',
    });

    // Create inner content wrapper
    const contentWrapper = this.dom.createElement('div', {
      className: '-translate-x-2 w-full flex flex-row items-center justify-start gap-3',
    });

    // Create icon container
    const iconOuterContainer = this.dom.createElement('div', {
      className: 'flex items-center justify-center text-text-100',
    });

    const iconInnerContainer = this.dom.createElement('div', {
      className: 'flex items-center justify-center group',
      style: {
        width: '16px',
        height: '16px',
      },
    });

    // Insert the bookmark icon
    iconInnerContainer.innerHTML = IconLibrary.bookmark(false, 'currentColor', 16);
    iconOuterContainer.appendChild(iconInnerContainer);

    // Create text container
    const textContainer = this.dom.createElement('span', {
      className: 'truncate text-sm whitespace-nowrap flex-1',
    });

    const textInner = this.dom.createElement('div', {
      className: 'transition-all duration-200',
    });
    textInner.textContent = 'Bookmarks';

    textContainer.appendChild(textInner);

    // Assemble the content
    contentWrapper.appendChild(iconOuterContainer);
    contentWrapper.appendChild(textContainer);
    link.appendChild(contentWrapper);

    // Add click handler
    link.addEventListener('click', e => {
      e.preventDefault();
      // Open in-app modal
      import('./BookmarkManagerModal.js').then(({ BookmarkManagerModal }) => {
        new BookmarkManagerModal().show({ source: 'sidebar' });
      });
    });

    // Create the empty hover container (for consistency with native items)
    const hoverContainer = this.dom.createElement('div', {
      className:
        'absolute right-0 top-1/2 -translate-y-1/2 transition-opacity duration-150 hidden group-hover:block group-focus-within:block opacity-0 group-hover:opacity-100 group-focus-within:opacity-100',
    });

    // Assemble the bookmark item
    bookmarkItem.appendChild(link);
    bookmarkItem.appendChild(hoverContainer);

    // Insert at the end of the container
    container.appendChild(bookmarkItem);

    this.elements = { section: bookmarkItem };
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
