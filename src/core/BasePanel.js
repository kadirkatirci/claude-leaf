/**
 * BasePanel - Abstract base class for floating panel components
 * Provides common panel functionality and standardized UI
 * Uses ONLY Claude native classes for automatic dark/light mode adaptation
 */

import { cn, textClass } from '../utils/ClassNames.js';

export default class BasePanel {
  constructor(options = {}) {
    this.id = options.id || 'base-panel';
    this.title = options.title || 'Panel';
    this.width = options.width || '400px';
    this.height = options.height || '500px';
    this.position = options.position || { right: '90px', top: '20px' };
    this.outsideClickIgnoreSelectors = Array.isArray(options.outsideClickIgnoreSelectors)
      ? options.outsideClickIgnoreSelectors
      : [];

    this.panel = null;
    this.header = null;
    this.content = null;
    this.footer = null;
    this.isVisible = false;
    this.lastContentSignature = null;

    // Bind methods
    this.toggle = this.toggle.bind(this);
    this.show = this.show.bind(this);
    this.hide = this.hide.bind(this);
    this.destroy = this.destroy.bind(this);
  }

  /**
   * Create the panel UI
   * @param {Object} _theme - Theme configuration (unused, kept for compatibility)
   */
  create(_theme) {
    // Remove existing panel
    if (this.panel) {
      this.destroy();
    }

    // Create main panel container
    this.panel = document.createElement('div');
    this.panel.id = this.id;
    this.panel.className = cn(
      'claude-productivity-panel',
      'fixed flex flex-col rounded-xl bg-bg-000 shadow-xl'
    );

    // Only apply positioning and size as inline styles
    this.panel.style.right = this.position.right;
    this.panel.style.top = this.position.top;
    this.panel.style.width = this.width;
    this.panel.style.height = this.height;
    this.panel.style.display = 'none';
    this.panel.style.zIndex = '10000';

    // Create header
    this.header = this.createHeader();
    this.panel.appendChild(this.header);

    // Create content area
    this.content = this.createContent();
    this.panel.appendChild(this.content);

    // Create footer if needed
    if (this.hasFooter()) {
      this.footer = this.createFooter();
      this.panel.appendChild(this.footer);
    }

    // Append to body
    document.body.appendChild(this.panel);

    // Setup event listeners
    this.setupEventListeners();

    return this.panel;
  }

  /**
   * Create panel header (solid color, no gradient)
   */
  createHeader() {
    const header = document.createElement('div');
    header.className = cn(
      'panel-header',
      'flex items-center justify-between px-5 py-4',
      'border-b border-border-300 rounded-t-xl bg-bg-100'
    );

    // Title
    const title = document.createElement('h3');
    title.textContent = this.title;
    title.className = textClass({ size: 'base', weight: 'semibold' });
    title.style.margin = '0';
    header.appendChild(title);

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.className = cn(
      'size-7 rounded-full',
      'bg-bg-200 hover:bg-bg-300',
      'text-text-500 hover:text-text-000',
      'flex items-center justify-center',
      'transition-colors cursor-pointer',
      'border-0'
    );
    closeBtn.style.fontSize = '24px';

    closeBtn.addEventListener('click', () => this.hide());
    header.appendChild(closeBtn);

    return header;
  }

  /**
   * Create content area
   */
  createContent() {
    const content = document.createElement('div');
    content.className = cn(
      'panel-content',
      'flex-1 p-4',
      'overflow-y-auto overflow-x-hidden',
      'relative bg-bg-000'
    );

    return content;
  }

  /**
   * Create footer (optional)
   */
  createFooter() {
    const footer = document.createElement('div');
    footer.className = cn('panel-footer', 'px-5 py-3', 'border-t border-border-300 bg-bg-100');

    return footer;
  }

  /**
   * Update panel content with smart diffing
   * @param {Array} items - Items to display
   * @param {Function} renderItem - Function to render each item
   */
  updateContent(items, renderItem) {
    if (!this.content) {
      return;
    }

    // Generate content signature for comparison
    const signature = this.generateSignature(items);

    // Skip update if content hasn't changed
    if (signature === this.lastContentSignature) {
      return;
    }

    this.lastContentSignature = signature;

    // Clear and rebuild content
    this.content.textContent = '';

    if (!items || items.length === 0) {
      this.showEmptyState();
      return;
    }

    // Render items
    const container = document.createElement('div');
    container.className = 'panel-items';

    items.forEach((item, index) => {
      const element = renderItem(item, index);
      if (element) {
        container.appendChild(element);
      }
    });

    this.content.appendChild(container);
  }

  /**
   * Show empty state
   */
  showEmptyState() {
    const emptyState = document.createElement('div');
    emptyState.className = cn(
      'empty-state',
      'py-10 px-5 text-center',
      textClass({ color: 'muted', size: 'sm' })
    );

    emptyState.textContent = this.getEmptyStateMessage();
    this.content.appendChild(emptyState);
  }

  /**
   * Generate content signature for change detection
   */
  generateSignature(items) {
    if (!items || items.length === 0) {
      return 'empty';
    }

    // Override in subclasses for custom signature generation
    return items
      .map(item => {
        if (typeof item === 'object') {
          return JSON.stringify(item);
        }
        return String(item);
      })
      .join('|');
  }

  /**
   * Setup panel event listeners
   */
  setupEventListeners() {
    // Close on Escape key
    const handleEscape = e => {
      if (e.key === 'Escape' && this.isVisible) {
        this.hide();
      }
    };

    const handleOutsideClick = e => {
      if (!this.isVisible || !this.panel) {
        return;
      }

      const target = e.target;
      if (!target || typeof target.closest !== 'function') {
        return;
      }

      if (this.panel.contains(target)) {
        return;
      }

      if (this.shouldIgnoreOutsideClick(target)) {
        return;
      }

      this.hide();
    };

    document.addEventListener('keydown', handleEscape);
    document.addEventListener('click', handleOutsideClick);

    // Store for cleanup
    this.eventListeners = {
      escape: { element: document, event: 'keydown', handler: handleEscape },
      outsideClick: { element: document, event: 'click', handler: handleOutsideClick },
    };
  }

  /**
   * Ignore outside-click close for known panel toggles.
   */
  shouldIgnoreOutsideClick(target) {
    return this.outsideClickIgnoreSelectors.some(selector => {
      try {
        return Boolean(target.closest(selector));
      } catch {
        return false;
      }
    });
  }

  /**
   * Toggle panel visibility
   */
  toggle() {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  /**
   * Show the panel
   */
  show() {
    if (!this.panel) {
      return;
    }

    this.panel.style.display = 'flex';
    this.isVisible = true;
    this.onShow();
  }

  /**
   * Hide the panel
   */
  hide() {
    if (!this.panel) {
      return;
    }

    this.panel.style.display = 'none';
    this.isVisible = false;
    this.onHide();
  }

  /**
   * Destroy the panel
   */
  destroy() {
    // Remove event listeners
    if (this.eventListeners) {
      Object.values(this.eventListeners).forEach(({ element, event, handler }) => {
        element.removeEventListener(event, handler);
      });
      this.eventListeners = null;
    }

    // Remove panel
    if (this.panel) {
      this.panel.remove();
      this.panel = null;
      this.header = null;
      this.content = null;
      this.footer = null;
    }

    this.isVisible = false;
    this.lastContentSignature = null;
  }

  // Abstract methods to override in subclasses
  hasFooter() {
    return false;
  }
  getEmptyStateMessage() {
    return 'No items to display';
  }
  onShow() {
    /* Override in subclass */
  }
  onHide() {
    /* Override in subclass */
  }
}
