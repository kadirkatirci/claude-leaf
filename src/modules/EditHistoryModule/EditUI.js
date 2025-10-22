/**
 * EditUI - UI bileşenleri (header button, highlights)
 */
import DOMUtils from '../../utils/DOMUtils.js';

class EditUI {
  constructor(getTheme, onButtonClick) {
    this.getTheme = getTheme;
    this.onButtonClick = onButtonClick;
    this.headerButton = null;
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

    console.log('[EditUI] ✅ Header button eklendi');
  }

  /**
   * Header button'u güncelle
   */
  updateHeaderButton(editCount) {
    if (!this.headerButton) return;

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
   */
  updateHighlights(editedPrompts, shouldHighlight) {
    // Önce hepsini kaldır
    document.querySelectorAll('.claude-edit-highlighted').forEach(el => {
      el.classList.remove('claude-edit-highlighted');
    });
    
    // Gerekiyorsa ekle
    if (shouldHighlight) {
      editedPrompts.forEach(editInfo => {
        editInfo.element.classList.add('claude-edit-highlighted');
      });
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
  }
}

export default EditUI;
