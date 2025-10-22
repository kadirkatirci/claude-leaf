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
      // Not: Buton text'i onMessageStateChanged'de güncellenecek
    });

    container.appendChild(button);
    return container;
  }

  /**
   * Edit butonunu bul ve yanına ekle
   */
  insertNextToEditButton(messageElement, expandButton) {
    // Önce mevcut butonu kaldır (varsa)
    this.remove(messageElement);
    
    // Mesajın en üst parent container'ını bul
    // (wrapper içine alındığında bile erişilebilir olacak)
    let targetContainer = messageElement;
    
    // Eğer mesaj wrapper içindeyse, wrapper'ın parent'ını kullan
    if (messageElement.parentElement?.classList.contains('claude-message-collapsed')) {
      targetContainer = messageElement.parentElement;
    }
    
    // Claude'un edit butonlarını bul
    const editButtonContainer = targetContainer.querySelector('[data-testid="composer-parent"]')?.parentElement;
    
    if (editButtonContainer) {
      // Edit butonunun yanına ekle
      editButtonContainer.style.display = 'flex';
      editButtonContainer.style.alignItems = 'center';
      editButtonContainer.style.flexWrap = 'wrap';
      editButtonContainer.appendChild(expandButton);
    } else {
      // Edit buton yoksa mesajın altına ekle
      const footer = DOMUtils.createElement('div', {
        className: 'claude-expand-footer',
        style: {
          marginTop: '12px',
          display: 'flex',
          justifyContent: 'flex-end',
        }
      });
      footer.appendChild(expandButton);
      
      // Mesajın hemen sonrasına ekle (wrapper dışında)
      if (targetContainer.parentElement) {
        targetContainer.parentElement.insertBefore(footer, targetContainer.nextSibling);
      } else {
        targetContainer.appendChild(footer);
      }
    }
  }

  /**
   * Butonu kaldır
   */
  remove(messageElement) {
    // Mesaj içindeki butonu ara
    let button = messageElement.querySelector('.claude-expand-button-container');
    if (button) {
      button.remove();
    }
    
    // Wrapper içindeki butonu ara
    if (messageElement.parentElement?.classList.contains('claude-message-collapsed')) {
      button = messageElement.parentElement.querySelector('.claude-expand-button-container');
      if (button) {
        button.remove();
      }
    }
    
    // Footer'daki butonu ara ve footer'ı da kaldır
    let current = messageElement;
    if (messageElement.parentElement?.classList.contains('claude-message-collapsed')) {
      current = messageElement.parentElement;
    }
    
    const nextSibling = current.nextElementSibling;
    if (nextSibling?.classList.contains('claude-expand-footer')) {
      nextSibling.remove();
    }
  }
}

export default ExpandButton;
