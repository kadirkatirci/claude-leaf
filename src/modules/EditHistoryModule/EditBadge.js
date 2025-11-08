/**
 * EditBadge - Edit badge yönetimi
 */
import MessageBadge from '../../components/primitives/MessageBadge.js';

class EditBadge {
  constructor(getTheme, onBadgeClick) {
    this.getTheme = getTheme;
    this.onBadgeClick = onBadgeClick;

    // Use MessageBadge base class
    this.badge = new MessageBadge(getTheme, (badge, element, data) => {
      this.onBadgeClick(element, data);
    });
  }

  /**
   * Badge'leri güncelle
   */
  updateAll(editedPrompts, showBadges) {
    if (!showBadges) {
      this.removeAll();
      return;
    }

    // Use MessageBadge's updateAll
    const elementsSet = new Set(editedPrompts.map(e => e.element));
    const editMap = new Map(editedPrompts.map(e => [e.element, e.versionInfo]));

    this.badge.updateAll(
      editedPrompts.map(e => e.element),
      (element) => this.getBadgeOptions(element, editMap.get(element)),
      (element) => elementsSet.has(element)
    );
  }

  /**
   * Get badge options for an element
   */
  getBadgeOptions(element, versionInfo) {
    const theme = this.getTheme();

    return {
      className: 'claude-edit-badge',
      content: `✏️ ${versionInfo}`,
      title: 'Click to see edit history',
      position: { top: '-35px', right: '8px' },
      style: {
        background: theme.useNativeClasses ? 'var(--claude-productivity-neutral)' : (theme.primary || theme.accentColor || '#CC785C'),
        color: 'white',
        padding: '4px 10px',
        borderRadius: '12px',
        fontSize: '11px',
        fontWeight: '600',
        gap: '4px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
      },
      data: versionInfo,
      setParentPosition: true
    };
  }

  /**
   * Tek bir badge ekle veya güncelle
   */
  add(messageElement, versionInfo = '') {
    const options = this.getBadgeOptions(messageElement, versionInfo);
    this.badge.create(messageElement, options);
  }

  /**
   * Tüm badge'leri kaldır
   */
  removeAll() {
    this.badge.removeAll('.claude-edit-badge');
  }
}

export default EditBadge;
