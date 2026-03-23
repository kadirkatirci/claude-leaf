/**
 * BookmarkSidebar - Adds clickable Bookmarks header to Claude's sidebar
 */
import IconLibrary from '../../components/primitives/IconLibrary.js';

const FALLBACK_SIDEBAR_ITEM_CLASS = 'relative group';
const FALLBACK_SIDEBAR_TRIGGER_CLASS = `inline-flex items-center justify-center relative isolate shrink-0 can-focus select-none disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none disabled:drop-shadow-none border-transparent transition font-base duration-300 ease-[cubic-bezier(0.165,0.85,0.45,1)] h-8 rounded-md px-3 min-w-[4rem] whitespace-nowrap !text-xs w-full !min-w-0 group py-1.5 rounded-lg px-4 !duration-75 overflow-hidden active:bg-bg-300 active:scale-[1.0]`;
const FALLBACK_CONTENT_WRAPPER_CLASS =
  '-translate-x-2 w-full flex flex-row items-center justify-start gap-3';
const FALLBACK_ICON_OUTER_CLASS = 'flex items-center justify-center text-text-100';
const FALLBACK_ICON_INNER_CLASS = 'group';
const FALLBACK_TEXT_CONTAINER_CLASS = 'truncate text-sm whitespace-nowrap flex-1';
const FALLBACK_TEXT_INNER_CLASS = 'opacity-100 transition-opacity ease-out duration-150';
const BOOKMARKS_SIDEBAR_ITEM_SELECTOR = '[data-clp-sidebar-bookmarks-item="true"]';

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
    const existingItem = document.querySelector(BOOKMARKS_SIDEBAR_ITEM_SELECTOR);
    if (existingItem) {
      this.elements = {
        section: existingItem,
        trigger: existingItem.querySelector('[data-dd-action-name="sidebar-nav-item"]'),
      };
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
      sidebarNav.querySelector('.flex.flex-col.px-2.pt-4.gap-px') ||
      sidebarNav.querySelector('.flex.flex-col.px-2.gap-px.pt-px') ||
      sidebarNav.querySelector('.flex.flex-col.px-2.gap-px') ||
      sidebarNav.querySelector('.flex.flex-col.px-2');

    // Fallback: find container by looking for nav items (Chats, Projects links)
    if (!container) {
      const templateTrigger = this.getTemplateTrigger(sidebarNav);
      if (templateTrigger) {
        // Get the parent container of the first nav link
        container =
          templateTrigger.closest('.flex.flex-col') || templateTrigger.parentElement?.parentElement;
      }
    }

    if (!container) {
      if (retryCount < maxRetries) {
        setTimeout(() => this.inject(retryCount + 1), 1000);
      }
      return false;
    }

    const templateTrigger = this.getTemplateTrigger(sidebarNav);
    const { item: bookmarkItem, trigger: link } = templateTrigger
      ? this.cloneTemplateItem(templateTrigger)
      : this.createFallbackItem();

    // Add click handler
    link.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      // Open in-app modal
      import('./BookmarkManagerModal.js').then(({ BookmarkManagerModal }) => {
        BookmarkManagerModal.showSingleton({ source: 'sidebar' });
      });
    });

    // Insert at the end of the container
    container.appendChild(bookmarkItem);

    this.elements = { section: bookmarkItem, trigger: link };
    return true;
  }

  getTemplateTrigger(sidebarNav) {
    return (
      sidebarNav.querySelector(
        'a[data-dd-action-name="sidebar-nav-item"][href^="/"]:not([target]):not([aria-current="page"])'
      ) ||
      sidebarNav.querySelector(
        'a[data-dd-action-name="sidebar-nav-item"][href^="/"]:not([target])'
      ) ||
      sidebarNav.querySelector('a[data-dd-action-name="sidebar-nav-item"]:not([target])') ||
      sidebarNav.querySelector('a[data-dd-action-name="sidebar-nav-item"]')
    );
  }

  cloneTemplateItem(templateTrigger) {
    const templateItem =
      templateTrigger.parentElement?.closest('.relative.group') ||
      templateTrigger.parentElement ||
      templateTrigger;
    const bookmarkItem = templateItem.cloneNode(true);
    const trigger = bookmarkItem.matches('[data-dd-action-name="sidebar-nav-item"]')
      ? bookmarkItem
      : bookmarkItem.querySelector('[data-dd-action-name="sidebar-nav-item"]');

    bookmarkItem.setAttribute('data-clp-sidebar-bookmarks-item', 'true');
    this.populateBookmarkTrigger(trigger);

    return { item: bookmarkItem, trigger };
  }

  createFallbackItem() {
    const bookmarkItem = this.dom.createElement('div', {
      className: FALLBACK_SIDEBAR_ITEM_CLASS,
      'data-state': 'closed',
      'data-clp-sidebar-bookmarks-item': 'true',
    });

    const trigger = this.dom.createElement('a', {
      href: '#bookmarks',
      className: FALLBACK_SIDEBAR_TRIGGER_CLASS,
      'aria-label': 'Bookmarks',
      'aria-haspopup': 'dialog',
      'data-dd-action-name': 'sidebar-nav-item',
    });

    const contentWrapper = this.dom.createElement('div', {
      className: FALLBACK_CONTENT_WRAPPER_CLASS,
    });
    const iconOuterContainer = this.dom.createElement('div', {
      className: FALLBACK_ICON_OUTER_CLASS,
    });
    const iconInnerContainer = this.dom.createElement('div', {
      className: FALLBACK_ICON_INNER_CLASS,
      style: {
        width: '16px',
        height: '16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      },
    });
    const textContainer = this.dom.createElement('span', {
      className: FALLBACK_TEXT_CONTAINER_CLASS,
    });
    const textInner = this.dom.createElement('div', {
      className: FALLBACK_TEXT_INNER_CLASS,
    });

    iconOuterContainer.appendChild(iconInnerContainer);
    textContainer.appendChild(textInner);
    contentWrapper.appendChild(iconOuterContainer);
    contentWrapper.appendChild(textContainer);
    trigger.appendChild(contentWrapper);
    bookmarkItem.appendChild(trigger);

    this.populateBookmarkTrigger(trigger);

    return { item: bookmarkItem, trigger };
  }

  populateBookmarkTrigger(trigger) {
    if (!trigger) {
      return;
    }

    trigger.setAttribute('href', '#bookmarks');
    trigger.setAttribute('aria-label', 'Bookmarks');
    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.removeAttribute('target');
    trigger.removeAttribute('aria-current');

    const contentWrapper = trigger.firstElementChild;
    const iconOuter = contentWrapper?.children?.[0];
    const iconInner = iconOuter?.firstElementChild;
    const textContainer = contentWrapper?.children?.[1];
    const textInner = textContainer?.firstElementChild;

    if (iconInner) {
      iconInner.innerHTML = IconLibrary.bookmark(false, 'currentColor', 20);
    }

    if (textContainer) {
      textContainer.innerHTML = '';
      const newTextInner = this.dom.createElement('div', {
        className: textInner?.className || FALLBACK_TEXT_INNER_CLASS,
      });
      const textLabel = this.dom.createElement('span', {
        textContent: 'Bookmarks',
      });
      newTextInner.appendChild(textLabel);
      textContainer.appendChild(newTextInner);
    }
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
