/**
 * StarredCollapseModule - Makes the Starred section in sidebar collapsible
 * Helps users see recent conversations when they have many starred items
 */
import BaseModule from './BaseModule.js';
import DOMUtils from '../utils/DOMUtils.js';

class StarredCollapseModule extends BaseModule {
  constructor() {
    super('starredCollapse');

    this.starredSection = null;
    this.starredList = null;
    this.chevronButton = null;
    this.showMoreFooter = null;
    this.isCollapsed = false;
    this.storageKey = 'claude-starred-collapse-state';
  }

  async init() {
    try {
      await super.init();
      if (!this.enabled) return;

      this.log('Starred Collapse başlatılıyor...');

      // Load saved state
      this.loadState();

      // Inject into sidebar with retry mechanism
      this.injectIntoSidebar();

      this.log('✅ Starred Collapse aktif');
    } catch (error) {
      this.error('❌ Starred Collapse init failed:', error);
      throw error;
    }
  }

  /**
   * Inject into sidebar (with retry mechanism like BookmarkSidebar)
   */
  injectIntoSidebar(retryCount = 0) {
    const maxRetries = 10;
    const retryDelay = 1000;

    // Find sidebar
    const sidebar = document.querySelector('.flex.flex-col.overflow-y-auto.overflow-x-hidden.relative.px-2.mb-2');

    if (!sidebar) {
      if (retryCount < maxRetries) {
        this.log(`⏳ Sidebar bulunamadı, yeniden deneniyor (${retryCount + 1}/${maxRetries})...`);
        setTimeout(() => this.injectIntoSidebar(retryCount + 1), retryDelay);
      } else {
        this.warn('❌ Sidebar bulunamadı, maksimum deneme sayısı aşıldı');
      }
      return false;
    }

    // Find starred section
    this.starredSection = this.findStarredSection(sidebar);

    if (!this.starredSection) {
      if (retryCount < maxRetries) {
        this.log(`⏳ Starred section bulunamadı, yeniden deneniyor (${retryCount + 1}/${maxRetries})...`);
        setTimeout(() => this.injectIntoSidebar(retryCount + 1), retryDelay);
      } else {
        this.log('ℹ️ Starred section bulunamadı (henüz yıldızlanmış mesaj yok olabilir)');
      }
      return false;
    }

    // Find starred list
    this.starredList = this.starredSection.querySelector('ul.-mx-1\\.5.flex.flex-1.flex-col.px-1\\.5.gap-px');

    if (!this.starredList) {
      this.warn('❌ Starred list bulunamadı');
      return false;
    }

    // Inject chevron button
    this.injectChevronButton();

    // Apply initial state (default: collapsed)
    const defaultState = this.getSetting('defaultState') || 'collapsed';
    const rememberState = this.getSetting('rememberState');

    if (rememberState && this.isCollapsed !== null) {
      // Use saved state
      this.applyCollapseState();
    } else {
      // Use default state
      this.isCollapsed = defaultState === 'collapsed';
      this.applyCollapseState();
    }

    this.log('✅ Starred collapse injected successfully');
    return true;
  }

  /**
   * Find starred section in sidebar
   */
  findStarredSection(sidebar) {
    // Find all sections in sidebar
    const sections = sidebar.querySelectorAll('div.flex.flex-col.mb-6');

    // Find the one with "Starred" header
    for (const section of sections) {
      const header = section.querySelector('h3');
      if (header && header.textContent.trim() === 'Starred') {
        return section;
      }
    }

    return null;
  }

  /**
   * Inject chevron button into header
   */
  injectChevronButton() {
    if (!this.starredSection) return;

    const header = this.starredSection.querySelector('h3');
    if (!header) return;

    // Check if chevron already exists
    if (header.querySelector('.starred-collapse-chevron')) {
      this.chevronButton = header.querySelector('.starred-collapse-chevron');
      return;
    }

    // Create chevron button
    this.chevronButton = DOMUtils.createElement('span', {
      className: 'starred-collapse-chevron',
      innerHTML: this.isCollapsed ? '▶' : '▼',
      style: {
        cursor: 'pointer',
        marginLeft: '4px',
        fontSize: '10px',
        opacity: '0.7',
        transition: 'all 0.2s ease',
        userSelect: 'none',
        display: 'inline-block',
      }
    });

    // Hover effect
    this.chevronButton.addEventListener('mouseenter', () => {
      this.chevronButton.style.opacity = '1';
      this.chevronButton.style.transform = 'scale(1.2)';
    });

    this.chevronButton.addEventListener('mouseleave', () => {
      this.chevronButton.style.opacity = '0.7';
      this.chevronButton.style.transform = 'scale(1)';
    });

    // Click handler
    this.chevronButton.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleCollapse();
    });

    // Make header clickable too
    header.style.cursor = 'pointer';
    header.style.userSelect = 'none';

    const headerClickHandler = (e) => {
      // Don't toggle if clicking on a link or button
      if (e.target.tagName === 'A' || e.target.tagName === 'BUTTON') return;
      this.toggleCollapse();
    };

    header.addEventListener('click', headerClickHandler);
    this.unsubscribers.push(() => header.removeEventListener('click', headerClickHandler));

    // Append chevron to header
    header.appendChild(this.chevronButton);

    this.log('✅ Chevron button injected');
  }

  /**
   * Toggle collapse/expand state
   */
  toggleCollapse() {
    this.isCollapsed = !this.isCollapsed;

    // Update chevron icon
    if (this.chevronButton) {
      this.chevronButton.innerHTML = this.isCollapsed ? '▶' : '▼';
    }

    // Apply state
    this.applyCollapseState();

    // Save state if remember is enabled
    if (this.getSetting('rememberState')) {
      this.saveState();
    }

    this.log(`Starred section ${this.isCollapsed ? 'collapsed' : 'expanded'}`);
  }

  /**
   * Apply collapse state (show/hide items)
   */
  applyCollapseState() {
    if (!this.starredList) return;

    const maxItems = this.getSetting('maxItemsWhenCollapsed') || 5;
    const items = Array.from(this.starredList.querySelectorAll('li'));

    if (this.isCollapsed) {
      // Hide items beyond maxItems
      items.forEach((item, index) => {
        if (index >= maxItems) {
          item.style.display = 'none';
        } else {
          item.style.display = '';
        }
      });

      // Add "Show X more" footer
      if (items.length > maxItems) {
        this.addShowMoreFooter(items.length - maxItems);
      } else {
        this.removeShowMoreFooter();
      }
    } else {
      // Show all items
      items.forEach(item => {
        item.style.display = '';
      });

      // Remove footer
      this.removeShowMoreFooter();
    }
  }

  /**
   * Add "Show X more starred" footer
   */
  addShowMoreFooter(hiddenCount) {
    // Remove existing footer if any
    this.removeShowMoreFooter();

    if (!this.starredSection) return;

    const theme = this.getTheme();

    this.showMoreFooter = DOMUtils.createElement('div', {
      className: 'starred-show-more',
      style: {
        padding: '8px 12px',
        cursor: 'pointer',
        fontSize: '12px',
        color: theme.isDark ? '#a0a0a0' : '#666',
        textAlign: 'center',
        borderTop: `1px solid ${theme.isDark ? '#3d3d3d' : '#e5e5e5'}`,
        marginTop: '4px',
        transition: 'all 0.2s ease',
        userSelect: 'none',
      },
      innerHTML: `Show ${hiddenCount} more starred ▼`
    });

    // Hover effect
    this.showMoreFooter.addEventListener('mouseenter', () => {
      this.showMoreFooter.style.color = theme.isDark ? '#ffffff' : '#000000';
      this.showMoreFooter.style.backgroundColor = theme.isDark ? '#2d2d2d' : '#f5f5f5';
    });

    this.showMoreFooter.addEventListener('mouseleave', () => {
      this.showMoreFooter.style.color = theme.isDark ? '#a0a0a0' : '#666';
      this.showMoreFooter.style.backgroundColor = 'transparent';
    });

    // Click handler - expand
    this.showMoreFooter.addEventListener('click', () => {
      this.toggleCollapse();
    });

    // Insert after starred list
    this.starredList.after(this.showMoreFooter);
  }

  /**
   * Remove "Show more" footer
   */
  removeShowMoreFooter() {
    if (this.showMoreFooter) {
      this.showMoreFooter.remove();
      this.showMoreFooter = null;
    }
  }

  /**
   * Load state from localStorage
   */
  loadState() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved !== null) {
        this.isCollapsed = saved === 'true';
        this.log(`State loaded from localStorage: ${this.isCollapsed ? 'collapsed' : 'expanded'}`);
      } else {
        // Use default state from settings
        const defaultState = this.getSetting('defaultState') || 'collapsed';
        this.isCollapsed = defaultState === 'collapsed';
        this.log(`Using default state: ${this.isCollapsed ? 'collapsed' : 'expanded'}`);
      }
    } catch (error) {
      this.error('Failed to load state from localStorage:', error);
      this.isCollapsed = true; // Default to collapsed on error
    }
  }

  /**
   * Save state to localStorage
   */
  saveState() {
    try {
      localStorage.setItem(this.storageKey, this.isCollapsed.toString());
      this.log(`State saved to localStorage: ${this.isCollapsed ? 'collapsed' : 'expanded'}`);
    } catch (error) {
      this.error('Failed to save state to localStorage:', error);
    }
  }

  /**
   * Settings değiştiğinde
   */
  onSettingsChanged() {
    this.log('⚙️ Settings değişti');

    if (!this.enabled) {
      // Module disabled, clean up
      this.cleanupUI();
      return;
    }

    // Module enabled or settings changed, reinject
    this.cleanupUI();
    setTimeout(() => this.injectIntoSidebar(), 500);
  }

  /**
   * Clean up UI elements
   */
  cleanupUI() {
    // Remove chevron button
    if (this.chevronButton) {
      this.chevronButton.remove();
      this.chevronButton = null;
    }

    // Remove show more footer
    this.removeShowMoreFooter();

    // Show all items
    if (this.starredList) {
      const items = this.starredList.querySelectorAll('li');
      items.forEach(item => {
        item.style.display = '';
      });
    }

    // Reset references
    this.starredSection = null;
    this.starredList = null;
  }

  /**
   * Modülü durdur
   */
  destroy() {
    this.log('🛑 Starred Collapse durduruluyor...');

    this.cleanupUI();

    super.destroy();
  }
}

export default StarredCollapseModule;
