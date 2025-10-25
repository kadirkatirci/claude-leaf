/**
 * EditUI - UI bileşenleri (header button, highlights)
 */
import DOMUtils from '../../utils/DOMUtils.js';

class EditUI {
  constructor(getTheme, onButtonClick, onCollapseAllClick) {
    this.getTheme = getTheme;
    this.onButtonClick = onButtonClick;
    this.onCollapseAllClick = onCollapseAllClick;
    this.headerButton = null;
    this.collapseAllButton = null;
    this.isAllCollapsed = false;
    this.lastEditCount = -1; // Track last count to avoid unnecessary updates
    this.lastHighlightedElements = new Set(); // Track highlighted elements
  }

  /**
   * Header button oluştur
   */
  createHeaderButton() {
    const chatTitleButton = document.querySelector('[data-testid="chat-title-button"]');
    if (!chatTitleButton) {
      console.warn('[EditUI] Chat title button bulunamadı, tekrar denenecek...');
      setTimeout(() => this.createHeaderButton(), 1000);
      return;
    }

    if (document.querySelector('#claude-edit-header-btn')) {
      return;
    }

    const titleContainer = chatTitleButton.parentElement;
    if (!titleContainer) {
      console.warn('[EditUI] Title container bulunamadı');
      return;
    }

    const theme = this.getTheme();

    const button = DOMUtils.createElement('button', {
      id: 'claude-edit-header-btn',
      type: 'button',
      style: {
        display: 'none',
        marginLeft: '8px',
        padding: '4px 12px',
        borderRadius: '8px',
        background: theme.gradient,
        color: 'white',
        fontSize: '12px',
        fontWeight: '600',
        border: 'none',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
      }
    });

    button.innerHTML = '✏️ <span id="claude-edit-header-label" style="margin-left: 4px;">0 Edits</span>';

    // Hover
    button.addEventListener('mouseenter', () => {
      button.style.transform = 'scale(1.05)';
      button.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.25)';
    });

    button.addEventListener('mouseleave', () => {
      button.style.transform = 'scale(1)';
      button.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.15)';
    });

    // Click
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onButtonClick();
    });

    titleContainer.appendChild(button);
    this.headerButton = button;

    // Tümünü Daralt butonu
    this.createCollapseAllButton(titleContainer, theme);

    console.log('[EditUI] ✅ Header button eklendi');
  }

  /**
   * Header button'u güncelle
   * Only updates DOM if count actually changed
   */
  updateHeaderButton(editCount) {
    if (!this.headerButton) return;

    // Skip if count hasn't changed
    if (this.lastEditCount === editCount) {
      return;
    }

    this.lastEditCount = editCount;

    const label = this.headerButton.querySelector('#claude-edit-header-label');
    if (!label) return;

    if (editCount > 0) {
      this.headerButton.style.display = 'inline-flex';
      label.textContent = `${editCount} Edit${editCount > 1 ? 's' : ''}`;
    } else {
      this.headerButton.style.display = 'none';
    }
  }

  /**
   * Highlight'ları güncelle
   * Only updates DOM if highlighted elements actually changed
   */
  updateHighlights(editedPrompts, shouldHighlight) {
    if (!shouldHighlight) {
      // Remove all highlights if disabled
      if (this.lastHighlightedElements.size > 0) {
        this.lastHighlightedElements.forEach(el => {
          el.classList.remove('claude-edit-highlighted');
        });
        this.lastHighlightedElements.clear();
      }
      return;
    }

    const currentElements = new Set(editedPrompts.map(e => e.element));

    // Check if highlighted elements changed
    const elementsChanged =
      currentElements.size !== this.lastHighlightedElements.size ||
      [...currentElements].some(el => !this.lastHighlightedElements.has(el));

    if (!elementsChanged) {
      return; // Nothing changed, skip DOM updates
    }

    // Remove highlights from elements that are no longer edited
    this.lastHighlightedElements.forEach(el => {
      if (!currentElements.has(el)) {
        el.classList.remove('claude-edit-highlighted');
      }
    });

    // Add highlights to new edited elements
    currentElements.forEach(el => {
      if (!this.lastHighlightedElements.has(el)) {
        el.classList.add('claude-edit-highlighted');
      }
    });

    this.lastHighlightedElements = currentElements;
  }

  /**
   * Tümünü Daralt/Genişlet butonu oluştur
   */
  createCollapseAllButton(titleContainer, theme) {
    if (document.querySelector('#claude-collapse-all-btn')) {
      return;
    }

    const button = DOMUtils.createElement('button', {
      id: 'claude-collapse-all-btn',
      type: 'button',
      style: {
        display: 'none',
        marginLeft: '8px',
        padding: '4px 12px',
        borderRadius: '8px',
        background: theme.gradient,
        color: 'white',
        fontSize: '12px',
        fontWeight: '600',
        border: 'none',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
      }
    });

    button.innerHTML = '📦 <span id="claude-collapse-all-label" style="margin-left: 4px;">Tümünü Daralt</span>';

    // Hover
    button.addEventListener('mouseenter', () => {
      button.style.transform = 'scale(1.05)';
      button.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.25)';
    });

    button.addEventListener('mouseleave', () => {
      button.style.transform = 'scale(1)';
      button.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.15)';
    });

    // Click
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      this.isAllCollapsed = !this.isAllCollapsed;
      
      const label = button.querySelector('#claude-collapse-all-label');
      if (this.isAllCollapsed) {
        label.textContent = 'Tümünü Genişlet';
      } else {
        label.textContent = 'Tümünü Daralt';
      }
      
      this.onCollapseAllClick(this.isAllCollapsed);
    });

    titleContainer.appendChild(button);
    this.collapseAllButton = button;

    console.log('[EditUI] ✅ Tümünü Daralt butonu eklendi');
  }

  /**
   * Tümünü Daralt buttonunu göster/gizle
   */
  showCollapseAllButton(show) {
    if (this.collapseAllButton) {
      this.collapseAllButton.style.display = show ? 'inline-flex' : 'none';
    }
  }

  /**
   * Tümünü Daralt buttonunun state'ini sıfırla
   */
  resetCollapseAllButton() {
    if (this.collapseAllButton) {
      this.isAllCollapsed = false;
      const label = this.collapseAllButton.querySelector('#claude-collapse-all-label');
      if (label) {
        label.textContent = 'Tümünü Daralt';
      }
    }
  }

  /**
   * Tümünü Daralt buttonunun state'ini ayarla
   * @param {boolean} isCollapsed - true ise mesajlar daraltılı, "Genişlet" göster
   */
  setCollapsedState(isCollapsed) {
    this.isAllCollapsed = isCollapsed;
    
    if (this.collapseAllButton) {
      const label = this.collapseAllButton.querySelector('#claude-collapse-all-label');
      if (label) {
        label.textContent = isCollapsed ? 'Tümünü Genişlet' : 'Tümünü Daralt';
      }
    }
  }

  /**
   * Header button'u kaldır
   */
  removeHeaderButton() {
    if (this.headerButton) {
      this.headerButton.remove();
      this.headerButton = null;
    }
    if (this.collapseAllButton) {
      this.collapseAllButton.remove();
      this.collapseAllButton = null;
    }
  }
}

export default EditUI;
