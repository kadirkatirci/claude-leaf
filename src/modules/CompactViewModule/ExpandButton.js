/**
 * ExpandButton - Expand/Collapse button UI
 */
import DOMUtils from '../../utils/DOMUtils.js';

class ExpandButton {
  constructor(getTheme, onToggle) {
    this.getTheme = getTheme;
    this.onToggle = onToggle;
  }

  /**
   * Expand butonu oluştur
   */
  create(messageElement, isCollapsed) {
    const theme = this.getTheme();
    
    // Buton container (edit butonunun yanına eklenecek)
    const container = DOMUtils.createElement('div', {
      className: 'claude-expand-button-container',
      style: {
        display: 'inline-flex',
        gap: '8px',
        marginLeft: '8px',
      }
    });

    const button = DOMUtils.createElement('button', {
      className: 'claude-expand-btn',
      innerHTML: isCollapsed ? '+ Daha fazla göster' : '− Daralt',
      style: {
        padding: '4px 12px',
        borderRadius: '6px',
        background: theme.gradient,
        color: 'white',
        border: 'none',
        fontSize: '12px',
        fontWeight: '600',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
      }
    });

    // Hover effect
    button.addEventListener('mouseenter', () => {
      button.style.transform = 'scale(1.05)';
      button.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.15)';
    });

    button.addEventListener('mouseleave', () => {
      button.style.transform = 'scale(1)';
      button.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
    });

    // Click handler
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onToggle(messageElement);
      
      // Buton text'ini güncelle
      const newState = !isCollapsed;
      button.innerHTML = newState ? '− Daralt' : '+ Daha fazla göster';
    });

    container.appendChild(button);
    return container;
  }

  /**
   * Edit butonunu bul ve yanına ekle
   */
  insertNextToEditButton(messageElement, expandButton) {
    // Claude'un edit butonlarını bul
    const editButtonContainer = messageElement.querySelector('[data-testid="composer-parent"]')?.parentElement;
    
    if (editButtonContainer) {
      // Edit butonunun yanına ekle
      editButtonContainer.style.display = 'flex';
      editButtonContainer.style.alignItems = 'center';
      editButtonContainer.appendChild(expandButton);
    } else {
      // Edit buton yoksa mesajın altına ekle
      const footer = DOMUtils.createElement('div', {
        style: {
          marginTop: '12px',
          display: 'flex',
          justifyContent: 'flex-end',
        }
      });
      footer.appendChild(expandButton);
      messageElement.appendChild(footer);
    }
  }

  /**
   * Butonu kaldır
   */
  remove(messageElement) {
    const button = messageElement.querySelector('.claude-expand-button-container');
    if (button) {
      button.remove();
    }
  }
}

export default ExpandButton;
