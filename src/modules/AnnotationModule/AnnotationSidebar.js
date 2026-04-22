import IconLibrary from '../../components/primitives/IconLibrary.js';

const FALLBACK_SIDEBAR_ITEM_CLASS = 'relative group';
const FALLBACK_SIDEBAR_TRIGGER_CLASS = `inline-flex items-center justify-center relative isolate shrink-0 can-focus select-none disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none disabled:drop-shadow-none border-transparent transition font-base duration-300 ease-[cubic-bezier(0.165,0.85,0.45,1)] h-8 rounded-md px-3 min-w-[4rem] whitespace-nowrap !text-xs w-full !min-w-0 group py-1.5 rounded-lg px-4 !duration-75 overflow-hidden active:bg-bg-300 active:scale-[1.0]`;
const FALLBACK_CONTENT_WRAPPER_CLASS =
  '-translate-x-2 w-full flex flex-row items-center justify-start gap-3';
const FALLBACK_ICON_OUTER_CLASS = 'flex items-center justify-center text-text-100';
const FALLBACK_ICON_INNER_CLASS = 'group';
const FALLBACK_TEXT_CONTAINER_CLASS = 'truncate text-sm whitespace-nowrap flex-1';
const FALLBACK_TEXT_INNER_CLASS = 'opacity-100 transition-opacity ease-out duration-150';
const ANNOTATIONS_SIDEBAR_ITEM_SELECTOR = '[data-clp-sidebar-annotations-item="true"]';

function isSvgElement(element) {
  return element?.tagName?.toLowerCase() === 'svg';
}

function normalizeTextInnerClass(className) {
  const normalizedClassName = className || FALLBACK_TEXT_INNER_CLASS;
  if (/\bopacity-0\b/.test(normalizedClassName)) {
    return normalizedClassName.replace(/\bopacity-0\b/g, 'opacity-100');
  }
  if (!/\bopacity-100\b/.test(normalizedClassName)) {
    return `${normalizedClassName} opacity-100`.trim();
  }
  return normalizedClassName;
}

export class AnnotationSidebar {
  constructor(domUtils) {
    this.dom = domUtils;
    this.elements = {};
  }

  inject(retryCount = 0) {
    const maxRetries = 10;
    if (this.elements.section && document.body.contains(this.elements.section)) {
      return true;
    }

    const existingItem = document.querySelector(ANNOTATIONS_SIDEBAR_ITEM_SELECTOR);
    if (existingItem) {
      this.elements = {
        section: existingItem,
        trigger: existingItem.querySelector('[data-dd-action-name="sidebar-nav-item"]'),
      };
      return true;
    }

    const sidebarNav = document.querySelector('nav[aria-label="Sidebar"]');
    if (!sidebarNav) {
      if (retryCount < maxRetries) {
        setTimeout(() => this.inject(retryCount + 1), 1000);
      }
      return false;
    }

    let container =
      sidebarNav.querySelector('.flex.flex-col.px-2.pt-4.gap-px') ||
      sidebarNav.querySelector('.flex.flex-col.px-2.gap-px.pt-px') ||
      sidebarNav.querySelector('.flex.flex-col.px-2.gap-px') ||
      sidebarNav.querySelector('.flex.flex-col.px-2');

    if (!container) {
      const templateTrigger = this.getTemplateTrigger(sidebarNav);
      if (templateTrigger) {
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
    const { item, trigger } = templateTrigger
      ? this.cloneTemplateItem(templateTrigger)
      : this.createFallbackItem();

    trigger.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      import('./AnnotationManagerModal.js').then(({ AnnotationManagerModal }) => {
        AnnotationManagerModal.showSingleton({ source: 'sidebar' });
      });
    });

    container.appendChild(item);
    this.elements = { section: item, trigger };
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
    const item = templateItem.cloneNode(true);
    const trigger = item.matches('[data-dd-action-name="sidebar-nav-item"]')
      ? item
      : item.querySelector('[data-dd-action-name="sidebar-nav-item"]');

    item.setAttribute('data-clp-sidebar-annotations-item', 'true');
    this.populateTrigger(trigger);
    return { item, trigger };
  }

  createFallbackItem() {
    const item = this.dom.createElement('div', {
      className: FALLBACK_SIDEBAR_ITEM_CLASS,
      'data-state': 'closed',
      'data-clp-sidebar-annotations-item': 'true',
    });

    const trigger = this.dom.createElement('a', {
      href: '#annotations',
      className: FALLBACK_SIDEBAR_TRIGGER_CLASS,
      'aria-label': 'Annotations',
      'aria-haspopup': 'dialog',
      'data-dd-action-name': 'sidebar-nav-item',
    });

    const contentWrapper = this.dom.createElement('div', {
      className: FALLBACK_CONTENT_WRAPPER_CLASS,
    });
    const iconOuter = this.dom.createElement('div', { className: FALLBACK_ICON_OUTER_CLASS });
    const iconInner = this.dom.createElement('div', {
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

    iconOuter.appendChild(iconInner);
    textContainer.appendChild(textInner);
    contentWrapper.appendChild(iconOuter);
    contentWrapper.appendChild(textContainer);
    trigger.appendChild(contentWrapper);
    item.appendChild(trigger);
    this.populateTrigger(trigger);

    return { item, trigger };
  }

  populateTrigger(trigger) {
    if (!trigger) {
      return;
    }

    trigger.setAttribute('href', '#annotations');
    trigger.setAttribute('aria-label', 'Annotations');
    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.removeAttribute('target');
    trigger.removeAttribute('aria-current');

    let contentWrapper = trigger.firstElementChild;
    if (!contentWrapper) {
      contentWrapper = this.dom.createElement('div', {
        className: FALLBACK_CONTENT_WRAPPER_CLASS,
      });
      trigger.appendChild(contentWrapper);
    }

    let iconOuter = contentWrapper.children?.[0];
    if (!iconOuter || isSvgElement(iconOuter)) {
      const previousIcon = isSvgElement(iconOuter) ? iconOuter : null;
      iconOuter = this.dom.createElement('div', { className: FALLBACK_ICON_OUTER_CLASS });
      if (previousIcon) {
        contentWrapper.replaceChild(iconOuter, previousIcon);
      } else {
        contentWrapper.appendChild(iconOuter);
      }
    }

    let iconInner = iconOuter.firstElementChild;
    if (!iconInner || isSvgElement(iconInner)) {
      const previousIcon = isSvgElement(iconInner) ? iconInner : null;
      iconInner = this.dom.createElement('div', {
        className: FALLBACK_ICON_INNER_CLASS,
        style: {
          width: '16px',
          height: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        },
      });
      if (previousIcon) {
        iconOuter.replaceChild(iconInner, previousIcon);
      } else {
        iconOuter.appendChild(iconInner);
      }
    }

    let textContainer =
      Array.from(contentWrapper.children || []).find(child => {
        return child !== iconOuter && /\btruncate\b|\bflex-1\b/.test(child.className || '');
      }) || contentWrapper.children?.[1];
    const previousTextInner = textContainer?.firstElementChild;

    if (!textContainer || textContainer === iconOuter) {
      textContainer = this.dom.createElement('span', {
        className: FALLBACK_TEXT_CONTAINER_CLASS,
      });
      contentWrapper.appendChild(textContainer);
    }

    iconInner.innerHTML = IconLibrary.edit('currentColor', 16);

    textContainer.innerHTML = '';
    const textInner = this.dom.createElement('div', {
      className: normalizeTextInnerClass(previousTextInner?.className),
    });
    const label = this.dom.createElement('span', { textContent: 'Annotations' });
    textInner.appendChild(label);
    textContainer.appendChild(textInner);
  }

  destroy() {
    this.elements.section?.remove();
    this.elements = {};
  }
}

export default AnnotationSidebar;
