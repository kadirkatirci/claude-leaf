/**
 * ExpandButton - Expand/Collapse button UI
 * Refactored to use only Claude native classes
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
    // Buton container (edit butonunun yanına eklenecek)
    const container = DOMUtils.createElement('div');
    container.className = 'claude-expand-button-container inline-flex gap-2';

    const button = DOMUtils.createElement('button');
    button.textContent = isCollapsed ? '+ Daha fazla göster' : '− Daralt';

    // Claude's native button classes
    button.className = 'claude-expand-btn px-3 py-1 rounded-md bg-accent-main-100 hover:bg-accent-main-200 text-white text-xs font-semibold cursor-pointer transition-all shadow-sm hover:shadow-md hover:scale-105';

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
    const footer = DOMUtils.createElement('div');
    footer.className = 'claude-expand-footer mt-3 flex justify-start pl-2';
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
