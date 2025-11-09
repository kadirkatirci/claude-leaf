/**
 * SidebarCollapseModule - Makes Starred and Recent sections in sidebar collapsible
 * Adds chevron icons to section headers for simple expand/collapse
 */
import BaseModule from './BaseModule.js';
import DOMUtils from '../utils/DOMUtils.js';

class SidebarCollapseModule extends BaseModule {
  constructor() {
    super('sidebarCollapse');

    this.sections = new Map(); // Store section data: { element, list, chevron, isCollapsed }
    this.storageKey = 'claude-sidebar-collapse-state';
    this.sectionStates = {}; // { starred: boolean, recent: boolean }
  }

  async init() {
    try {
      await super.init();
      if (!this.enabled) return;

      this.log('Sidebar Collapse başlatılıyor...');

      // Load saved states
      this.loadStates();

      // Inject into sidebar with retry mechanism
      this.injectIntoSidebar();

      this.log('✅ Sidebar Collapse aktif');
    } catch (error) {
      this.error('❌ Sidebar Collapse init failed:', error);
      throw error;
    }
  }

  /**
   * Inject into sidebar (with retry mechanism)
   */
  async injectIntoSidebar(retryCount = 0) {
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

    // Find Starred section
    const starredSection = this.findSectionByTitle(sidebar, 'Starred');
    if (starredSection) {
      await this.injectChevronToSection('starred', starredSection);
    }

    // Find Recent section
    const recentSection = this.findSectionByTitle(sidebar, 'Recents');
    if (recentSection) {
      await this.injectChevronToSection('recent', recentSection);
    }

    if (!starredSection && !recentSection) {
      if (retryCount < maxRetries) {
        this.log(`⏳ Sections bulunamadı, yeniden deneniyor (${retryCount + 1}/${maxRetries})...`);
        setTimeout(() => this.injectIntoSidebar(retryCount + 1), retryDelay);
      } else {
        this.log('ℹ️ Sidebar sections bulunamadı');
      }
      return false;
    }

    this.log(`✅ Chevron injected to ${this.sections.size} section(s)`);
    return true;
  }

  /**
   * Find section by header title
   */
  findSectionByTitle(sidebar, title) {
    const sections = sidebar.querySelectorAll('div.flex.flex-col');

    for (const section of sections) {
      const header = section.querySelector('h3');
      if (header && header.textContent.trim() === title) {
        return section;
      }
    }

    return null;
  }

  /**
   * Inject chevron button into section header
   */
  async injectChevronToSection(sectionKey, sectionElement) {
    const header = sectionElement.querySelector('h3');
    if (!header) return;

    // Check if chevron already exists
    if (header.querySelector('.sidebar-collapse-chevron')) {
      return;
    }

    // Find the list
    const list = sectionElement.querySelector('ul');
    if (!list) return;

    // Get saved state or default to expanded
    const defaultState = await this.getSetting('defaultState') || 'expanded';
    const rememberState = await this.getSetting('rememberState');

    let isCollapsed;
    if (rememberState && this.sectionStates[sectionKey] !== undefined) {
      isCollapsed = this.sectionStates[sectionKey];
    } else {
      isCollapsed = defaultState === 'collapsed';
    }

    // Create chevron button
    const chevron = DOMUtils.createElement('span', {
      className: 'sidebar-collapse-chevron',
      innerHTML: isCollapsed ? '▶' : '▼',
      style: {
        cursor: 'pointer',
        marginLeft: '6px',
        fontSize: '10px',
        opacity: '0.6',
        transition: 'all 0.2s ease',
        userSelect: 'none',
        display: 'inline-block',
      }
    });

    // Hover effect
    chevron.addEventListener('mouseenter', () => {
      chevron.style.opacity = '1';
      chevron.style.transform = 'scale(1.2)';
    });

    chevron.addEventListener('mouseleave', () => {
      chevron.style.opacity = '0.6';
      chevron.style.transform = 'scale(1)';
    });

    // Click handler
    chevron.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleSection(sectionKey);
    });

    // Make header clickable too
    header.style.cursor = 'pointer';
    header.style.userSelect = 'none';

    const headerClickHandler = (e) => {
      // Don't toggle if clicking on a link or button
      if (e.target.tagName === 'A' || e.target.tagName === 'BUTTON') return;
      // Don't toggle if clicking chevron (it has its own handler)
      if (e.target === chevron) return;
      this.toggleSection(sectionKey);
    };

    header.addEventListener('click', headerClickHandler);
    this.unsubscribers.push(() => header.removeEventListener('click', headerClickHandler));

    // Append chevron to header
    header.appendChild(chevron);

    // Store section data
    this.sections.set(sectionKey, {
      element: sectionElement,
      list,
      chevron,
      isCollapsed,
    });

    // Apply initial state
    this.applyCollapseState(sectionKey);

    this.log(`✅ Chevron injected to ${sectionKey} section`);
  }

  /**
   * Toggle section collapse/expand
   */
  async toggleSection(sectionKey) {
    const section = this.sections.get(sectionKey);
    if (!section) return;

    section.isCollapsed = !section.isCollapsed;

    // Update chevron icon
    if (section.chevron) {
      section.chevron.innerHTML = section.isCollapsed ? '▶' : '▼';
    }

    // Apply state
    this.applyCollapseState(sectionKey);

    // Save state if remember is enabled
    if (await this.getSetting('rememberState')) {
      this.saveStates();
    }

    this.log(`${sectionKey} section ${section.isCollapsed ? 'collapsed' : 'expanded'}`);
  }

  /**
   * Apply collapse state to section
   */
  applyCollapseState(sectionKey) {
    const section = this.sections.get(sectionKey);
    if (!section) return;

    if (section.isCollapsed) {
      // Hide the list
      section.list.style.display = 'none';
    } else {
      // Show the list
      section.list.style.display = '';
    }
  }

  /**
   * Load states from localStorage
   */
  loadStates() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved !== null) {
        this.sectionStates = JSON.parse(saved);
        this.log('States loaded from localStorage:', this.sectionStates);
      }
    } catch (error) {
      this.error('Failed to load states from localStorage:', error);
      this.sectionStates = {};
    }
  }

  /**
   * Save states to localStorage
   */
  saveStates() {
    try {
      // Collect current states
      const states = {};
      this.sections.forEach((section, key) => {
        states[key] = section.isCollapsed;
      });

      localStorage.setItem(this.storageKey, JSON.stringify(states));
      this.log('States saved to localStorage:', states);
    } catch (error) {
      this.error('Failed to save states to localStorage:', error);
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
    // Remove chevrons and restore list visibility
    this.sections.forEach((section, key) => {
      if (section.chevron) {
        section.chevron.remove();
      }
      if (section.list) {
        section.list.style.display = '';
      }
    });

    // Clear sections map
    this.sections.clear();
  }

  /**
   * Modülü durdur
   */
  destroy() {
    this.log('🛑 Sidebar Collapse durduruluyor...');

    this.cleanupUI();

    super.destroy();
  }
}

export default SidebarCollapseModule;
