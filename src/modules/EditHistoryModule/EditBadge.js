/**
 * EditBadge - Edit badge yönetimi
 */
import DOMUtils from '../../utils/DOMUtils.js';

class EditBadge {
  constructor(getTheme, onBadgeClick) {
    this.getTheme = getTheme;
    this.onBadgeClick = onBadgeClick;
  }

  /**
   * Badge'leri güncelle
   */
  updateAll(editedPrompts, showBadges) {
    if (!showBadges) {
      this.removeAll();
      return;
    }

    const currentElements = new Set(editedPrompts.map(e => e.element));

    // Eski badge'leri temizle
    document.querySelectorAll('.claude-edit-badge').forEach(badge => {
      const parent = badge.parentElement;
      if (parent && !currentElements.has(parent)) {
        badge.remove();
      }
    });

    // Yeni badge'leri ekle
    editedPrompts.forEach(editInfo => {
      this.add(editInfo.element, editInfo.versionInfo);
    });
  }

  /**
   * Tek bir badge ekle veya güncelle
   */
  add(messageElement, versionInfo = '') {
    // Check if badge already exists
    const existingBadge = messageElement.querySelector('.claude-edit-badge');
    if (existingBadge) {
      // Only update if text changed
      const newText = `✏️ ${versionInfo}`;
      if (existingBadge.innerHTML !== newText) {
        existingBadge.innerHTML = newText;
      }
      return;
    }

    const theme = this.getTheme();

    const badge = DOMUtils.createElement('div', {
      className: 'claude-edit-badge',
      innerHTML: `✏️ ${versionInfo}`,
      style: {
        position: 'absolute',
        top: '-35px',
        right: '8px',
        background: theme.gradient,
        color: 'white',
        padding: '4px 10px',
        borderRadius: '12px',
        fontSize: '11px',
        fontWeight: '600',
        cursor: 'pointer',
        zIndex: '100',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
        transition: 'all 0.2s ease',
      }
    });

    // Hover effects
    badge.addEventListener('mouseenter', () => {
      badge.style.transform = 'scale(1.05)';
      badge.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.25)';
    });

    badge.addEventListener('mouseleave', () => {
      badge.style.transform = 'scale(1)';
      badge.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.15)';
    });

    // Click handler
    badge.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onBadgeClick(messageElement, versionInfo);
    });

    // Parent position ayarla
    const position = window.getComputedStyle(messageElement).position;
    if (position === 'static') {
      messageElement.style.position = 'relative';
    }

    messageElement.appendChild(badge);
  }

  /**
   * Tüm badge'leri kaldır
   */
  removeAll() {
    document.querySelectorAll('.claude-edit-badge').forEach(b => b.remove());
  }
}

export default EditBadge;
