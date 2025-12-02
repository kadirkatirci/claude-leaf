/**
 * EditBadge - Edit badge yönetimi
 */
import MessageBadge from '../../components/primitives/MessageBadge.js';
import IconLibrary from '../../components/primitives/IconLibrary.js';
import { cn, ClaudeClasses } from '../../utils/ClassNames.js';

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
    const editMap = new Map(editedPrompts.map(e => [e.element, e]));

    this.badge.updateAll(
      editedPrompts.map(e => e.element),
      (element) => this.getBadgeOptions(element, editMap.get(element)),
      (element) => elementsSet.has(element)
    );
  }

  /**
   * Get badge options for an element
   */
  getBadgeOptions(element, editInfo) {
    const versionInfo = editInfo?.versionInfo || '';
    return {
      className: cn(
        'claude-edit-badge',
        ClaudeClasses.position.absolute,
        ClaudeClasses.layout.flex,
        ClaudeClasses.layout.itemsCenter,
        ClaudeClasses.layout.justifyCenter,
        ClaudeClasses.util.cursorPointer,
        ClaudeClasses.util.transition,
        'bg-bg-200',
        'text-text-000',
        'px-2.5',
        'py-1',
        'rounded-xl',
        'text-[11px]',
        'font-semibold',
        'gap-1',
        'shadow-md',
        'z-[100]'
      ),
      content: `${IconLibrary.edit('currentColor', 11)} ${versionInfo}`,
      title: 'Click to see edit history',
      position: { top: '-35px', right: '8px' },
      style: {},
      data: editInfo, // Pass full edit info object
      setParentPosition: true
    };
  }

  /**
   * Tek bir badge ekle veya güncelle
   */
  add(messageElement, versionInfo = '') {
    // Legacy support or simple usage
    const options = this.getBadgeOptions(messageElement, { versionInfo });
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
