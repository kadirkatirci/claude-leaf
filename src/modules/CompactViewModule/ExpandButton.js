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
    const container = DOMUtils.createElement('div');

    if (theme.useNativeClasses) {
      container.className = 'claude-expand-button-container inline-flex gap-2';
    } else {
      container.className = 'claude-expand-button-container';
      Object.assign(container.style, {
        display: 'inline-flex',
        gap: '8px',
      });
    }

    const button = DOMUtils.createElement('button');
    button.innerHTML = isCollapsed ? '+ Daha fazla göster' : '− Daralt';

    if (theme.useNativeClasses) {
      // Claude's native button classes
      button.className = 'claude-expand-btn px-3 py-1 rounded-md bg-accent-main-100 hover:bg-accent-main-200 text-white text-xs font-semibold cursor-pointer transition-all shadow-sm hover:shadow-md hover:scale-105';
    } else {
      button.className = 'claude-expand-btn';

      const buttonBg = theme.primary || theme.accentColor || '#CC785C';

      Object.assign(button.style, {
        padding: '4px 12px',
        borderRadius: '6px',
        background: buttonBg,
        color: 'white',
        border: 'none',
        fontSize: '12px',
        fontWeight: '600',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
      });
    }

    // Hover effect (only for custom theme)
    if (!theme.useNativeClasses) {
      button.addEventListener('mouseenter', () => {
        button.style.transform = 'scale(1.05)';
        button.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.15)';
      });

      button.addEventListener('mouseleave', () => {
        button.style.transform = 'scale(1)';
        button.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
      });
    }

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
   * Expand butonunu mesajın altına ekle
   */
  insertNextToEditButton(messageElement, expandButton) {
    // Önce mevcut butonu kaldır (varsa)
    this.remove(messageElement);
    
    // Mesajın hedef container'ını bul
    let targetContainer = messageElement;
    
    // Eğer mesaj wrapper içindeyse, wrapper'ı kullan
    if (messageElement.parentElement?.classList.contains('claude-message-collapsed')) {
      targetContainer = messageElement.parentElement;
    }
    
    // Tüm mesajlar için ayrı footer oluştur (tutarlı görünüm)
    const footer = DOMUtils.createElement('div', {
      className: 'claude-expand-footer',
      style: {
        marginTop: '12px',
        display: 'flex',
        justifyContent: 'flex-start',
        paddingLeft: '8px',
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

  /**
   * Butonu kaldır
   */
  remove(messageElement) {
    // Mesaj container'ını bul
    let current = messageElement;
    if (messageElement.parentElement?.classList.contains('claude-message-collapsed')) {
      current = messageElement.parentElement;
    }
    
    // Footer'ı bul ve kaldır
    const nextSibling = current.nextElementSibling;
    if (nextSibling?.classList.contains('claude-expand-footer')) {
      nextSibling.remove();
    }
  }
}

export default ExpandButton;
