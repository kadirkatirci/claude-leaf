/**
 * BasePanel - Abstract base class for floating panel components
 * Provides common panel functionality and standardized UI
 */

export default class BasePanel {
  constructor(options = {}) {
    this.id = options.id || 'base-panel';
    this.title = options.title || 'Panel';
    this.width = options.width || '400px';
    this.height = options.height || '500px';
    this.position = options.position || { right: '90px', top: '20px' };

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
   * @param {Object} theme - Theme configuration
   */
  create(theme) {
    // Remove existing panel
    if (this.panel) {
      this.destroy();
    }

    // Create main panel container
    this.panel = document.createElement('div');
    this.panel.id = this.id;
    this.panel.className = 'claude-productivity-panel';

    // Apply standardized panel styles
    Object.assign(this.panel.style, {
      position: 'fixed',
      right: this.position.right,
      top: this.position.top,
      width: this.width,
      height: this.height,
      backgroundColor: 'white',
      border: '1px solid rgba(0, 0, 0, 0.1)',
      borderRadius: '12px',
      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
      display: 'none',
      flexDirection: 'column',
      zIndex: '10000',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    });

    // Create header
    this.header = this.createHeader(theme);
    this.panel.appendChild(this.header);

    // Create content area
    this.content = this.createContent();
    this.panel.appendChild(this.content);

    // Create footer if needed
    if (this.hasFooter()) {
      this.footer = this.createFooter(theme);
      this.panel.appendChild(this.footer);
    }

    // Append to body
    document.body.appendChild(this.panel);

    // Setup event listeners
    this.setupEventListeners();

    return this.panel;
  }

  /**
   * Create panel header
   */
  createHeader(theme) {
    const header = document.createElement('div');
    header.className = 'panel-header';

    Object.assign(header.style, {
      padding: '16px 20px',
      borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
      background: theme?.gradient || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      borderRadius: '12px 12px 0 0',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    });

    // Title
    const title = document.createElement('h3');
    title.textContent = this.title;
    title.style.cssText = `
      margin: 0;
      fontSize: 16px;
      fontWeight: 600;
      color: white;
    `;
    header.appendChild(title);

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '×';
    closeBtn.style.cssText = `
      background: rgba(255, 255, 255, 0.2);
      border: none;
      color: white;
      fontSize: 24px;
      width: 28px;
      height: 28px;
      borderRadius: 50%;
      cursor: pointer;
      display: flex;
      alignItems: center;
      justifyContent: center;
      transition: background 0.2s;
    `;

    closeBtn.addEventListener('mouseenter', () => {
      closeBtn.style.background = 'rgba(255, 255, 255, 0.3)';
    });

    closeBtn.addEventListener('mouseleave', () => {
      closeBtn.style.background = 'rgba(255, 255, 255, 0.2)';
    });

    closeBtn.addEventListener('click', () => this.hide());
    header.appendChild(closeBtn);

    return header;
  }

  /**
   * Create content area
   */
  createContent() {
    const content = document.createElement('div');
    content.className = 'panel-content';

    Object.assign(content.style, {
      flex: '1',
      padding: '16px',
      overflowY: 'auto',
      overflowX: 'hidden',
      position: 'relative'
    });

    return content;
  }

  /**
   * Create footer (optional)
   */
  createFooter(theme) {
    const footer = document.createElement('div');
    footer.className = 'panel-footer';

    Object.assign(footer.style, {
      padding: '12px 20px',
      borderTop: '1px solid rgba(0, 0, 0, 0.1)',
      backgroundColor: 'rgba(0, 0, 0, 0.02)'
    });

    return footer;
  }

  /**
   * Update panel content with smart diffing
   * @param {Array} items - Items to display
   * @param {Function} renderItem - Function to render each item
   */
  updateContent(items, renderItem) {
    if (!this.content) return;

    // Generate content signature for comparison
    const signature = this.generateSignature(items);

    // Skip update if content hasn't changed
    if (signature === this.lastContentSignature) {
      return;
    }

    this.lastContentSignature = signature;

    // Clear and rebuild content
    this.content.innerHTML = '';

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
    emptyState.className = 'empty-state';
    emptyState.style.cssText = `
      padding: 40px 20px;
      textAlign: center;
      color: #666;
      fontSize: 14px;
    `;
    emptyState.textContent = this.getEmptyStateMessage();
    this.content.appendChild(emptyState);
  }

  /**
   * Generate content signature for change detection
   */
  generateSignature(items) {
    if (!items || items.length === 0) return 'empty';

    // Override in subclasses for custom signature generation
    return items.map(item => {
      if (typeof item === 'object') {
        return JSON.stringify(item);
      }
      return String(item);
    }).join('|');
  }

  /**
   * Setup panel event listeners
   */
  setupEventListeners() {
    // Close on Escape key
    const handleEscape = (e) => {
      if (e.key === 'Escape' && this.isVisible) {
        this.hide();
      }
    };

    document.addEventListener('keydown', handleEscape);

    // Store for cleanup
    this.eventListeners = {
      escape: { element: document, event: 'keydown', handler: handleEscape }
    };
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
    if (!this.panel) return;

    this.panel.style.display = 'flex';
    this.isVisible = true;
    this.onShow();
  }

  /**
   * Hide the panel
   */
  hide() {
    if (!this.panel) return;

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
  hasFooter() { return false; }
  getEmptyStateMessage() { return 'No items to display'; }
  onShow() { /* Override in subclass */ }
  onHide() { /* Override in subclass */ }
}