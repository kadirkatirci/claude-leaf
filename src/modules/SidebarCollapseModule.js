/**
 * SidebarCollapseModule - Makes Starred and Recent sections in sidebar collapsible
 * Adds chevron icons to section headers for simple expand/collapse
 */
import BaseModule from './BaseModule.js';
import { Events } from '../utils/EventBus.js';
import DOMUtils from '../utils/DOMUtils.js';
import IconLibrary from '../components/primitives/IconLibrary.js';
import { conversationStateStore } from '../stores/index.js';
import { MODULE_CONSTANTS } from '../config/ModuleConstants.js';

const SIDEBAR_CONFIG = MODULE_CONSTANTS.sidebarCollapse;

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

    // Find sidebar nav to scope our search
    const sidebarNav = document.querySelector('nav[aria-label="Sidebar"]');

    if (!sidebarNav) {
      if (retryCount < maxRetries) {
        this.log(`⏳ Sidebar bulunamadı, yeniden deneniyor (${retryCount + 1}/${maxRetries})...`);
        setTimeout(() => this.injectIntoSidebar(retryCount + 1), retryDelay);
      } else {
        this.warn('❌ Sidebar bulunamadı, maksimum deneme sayısı aşıldı');
      }
      return false;
    }

    // Find all headers in the sidebar
    const headers = Array.from(sidebarNav.querySelectorAll('h3'));
    let foundAny = false;

    // Find Starred section
    const starredHeader = headers.find(h => h.textContent.trim() === 'Starred');
    if (starredHeader) {
      const starredSection = starredHeader.closest('.flex.flex-col');
      if (starredSection) {
        await this.injectChevronToSection('starred', starredSection);
        foundAny = true;
      }
    }

    // Find Recent section
    // Recents header might have a "Hide" span inside, so use includes or startsWith
    const recentHeader = headers.find(h => h.textContent.trim().startsWith('Recents'));
    if (recentHeader) {
      // Recents section is usually the one with flex-grow
      const recentSection = recentHeader.closest('.flex.flex-col');
      if (recentSection) {
        // Check if list exists, if not, it might be natively collapsed
        let list = recentSection.querySelector('ul');

        if (!list && recentHeader.getAttribute('aria-expanded') === 'false') {
          this.log('ℹ️ Recents section natively collapsed, expanding...');
          recentHeader.click();

          // Wait for list to appear
          await new Promise(resolve => setTimeout(resolve, 100));
          list = recentSection.querySelector('ul');

          if (!list) {
            // Try one more time with longer delay
            await new Promise(resolve => setTimeout(resolve, 300));
            list = recentSection.querySelector('ul');
          }
        }

        if (list) {
          await this.injectChevronToSection('recent', recentSection);
          foundAny = true;
        } else {
          this.warn('⚠️ Recents list not found even after expansion attempt');
        }
      }
    }

    if (!foundAny) {
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
   * Find section by header title - Deprecated but kept for compatibility if needed
   */
  findSectionByTitle(sidebar, title) {
    // This method is no longer used by the main logic but kept as utility
    const headers = Array.from(sidebar.querySelectorAll('h3'));
    const header = headers.find(h => h.textContent.trim().startsWith(title));
    return header ? header.closest('.flex.flex-col') : null;
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

    // Special handling for Recents section: Hide the native "Show/Hide" text
    // and observe header for dynamic re-inserts of the native toggle.
    let headerObserver = null;
    if (sectionKey === 'recent') {
      const hideToggleIfMatches = (el) => {
        if (!el || !el.textContent) return;
        const txt = el.textContent.trim();
        // Match common native toggle labels (case-insensitive). If needed,
        // expand this regex to include localized words.
        if (/\b(hide|show)\b/i.test(txt)) {
          try {
            el.style.display = 'none';
            el.setAttribute('aria-hidden', 'true');
          } catch (e) {
            // ignore style mutation errors
          }
        }
      };

      // Hide any existing candidates (spans/buttons) inside the header
      header.querySelectorAll('span,button').forEach(hideToggleIfMatches);

      // Also watch for dynamic re-rendering that may re-insert the native toggle.
      headerObserver = new MutationObserver((mutations) => {
        mutations.forEach((m) => {
          m.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              hideToggleIfMatches(node);
              if (node.querySelectorAll) node.querySelectorAll('span,button').forEach(hideToggleIfMatches);
            }
          });
        });
      });
      headerObserver.observe(header, { childList: true, subtree: true });

      // Fix layout to match Starred (remove justify-between spacing)
      header.style.justifyContent = 'flex-start';
      header.style.gap = '4px';
    }

    // Get saved state or default to expanded
    const defaultState = SIDEBAR_CONFIG.defaultState;
    const rememberState = SIDEBAR_CONFIG.rememberState;

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
      observer: headerObserver,
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
      section.chevron.textContent = section.isCollapsed ? '▶' : '▼';
    }

    // Apply state
    this.applyCollapseState(sectionKey);

    // Save state if remember is enabled
    if (SIDEBAR_CONFIG.rememberState) {
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
      // Disconnect any observer watching the header for native toggles
      if (section.observer) {
        try {
          section.observer.disconnect();
        } catch (e) {
          // ignore
        }
      }
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
