import BasePanel from '../../core/BasePanel.js';
import { cardClass } from '../../utils/ClassNames.js';
import { ANNOTATION_COLORS, DEFAULT_ANNOTATION_COLOR } from './AnnotationRange.js';

export default class AnnotationQuickPanel extends BasePanel {
  constructor({ onNavigate, onDelete }) {
    super({
      id: 'claude-annotations-panel',
      title: 'Annotations',
      width: '320px',
      height: '500px',
      position: { right: '80px', top: '60px' },
      outsideClickIgnoreSelectors: ['#claude-annotations-fixed-btn'],
    });

    this.onNavigate = onNavigate;
    this.onDelete = onDelete;
    this.states = [];
  }

  updateAnnotations(states = []) {
    this.states = [...states].sort((a, b) => {
      return Date.parse(b.annotation.createdAt || '') - Date.parse(a.annotation.createdAt || '');
    });

    if (this.header) {
      const title = this.header.querySelector('h3');
      if (title) {
        title.textContent = `Annotations${this.states.length ? ` (${this.states.length})` : ''}`;
      }
    }

    super.updateContent(this.states, state => this.createItem(state));
  }

  createItem(state) {
    const annotation = state.annotation;
    const color =
      ANNOTATION_COLORS[annotation.color] || ANNOTATION_COLORS[DEFAULT_ANNOTATION_COLOR];
    const item = document.createElement('div');
    item.className = cardClass(false, state.status === 'resolved' ? '' : 'opacity-80');

    const header = document.createElement('div');
    header.className = 'mb-2 flex items-center justify-between gap-2';

    const meta = document.createElement('div');
    meta.className = 'flex min-w-0 items-center gap-2 text-xs text-text-400';

    const dot = document.createElement('span');
    dot.className = 'size-2.5 shrink-0 rounded-full';
    dot.style.background = color.swatch;

    const sender = document.createElement('span');
    sender.className = 'truncate capitalize';
    sender.textContent = annotation.messageSender || 'message';

    meta.appendChild(dot);
    meta.appendChild(sender);

    if (state.status !== 'resolved') {
      const badge = document.createElement('span');
      badge.className = 'rounded-full bg-bg-200 px-2 py-0.5 text-[10px] uppercase text-text-400';
      badge.textContent = 'Unresolved';
      meta.appendChild(badge);
    }

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'text-sm leading-none text-text-400 hover:text-red-500';
    deleteButton.textContent = '×';
    deleteButton.setAttribute('aria-label', 'Delete annotation');
    deleteButton.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      this.onDelete?.(annotation.id, 'quick_panel');
    });

    header.appendChild(meta);
    header.appendChild(deleteButton);

    const text = document.createElement('div');
    text.className = 'line-clamp-2 text-sm text-text-000';
    text.textContent = annotation.selectedText || '';

    const note = document.createElement('div');
    note.className = 'mt-1 line-clamp-2 text-xs text-text-400';
    note.textContent = annotation.note || annotation.messagePreview || '';

    item.appendChild(header);
    item.appendChild(text);
    item.appendChild(note);

    if (state.status === 'resolved') {
      item.addEventListener('click', () => {
        this.onNavigate?.(annotation.id, { openEditor: true, source: 'quick_panel' });
      });
    }

    return item;
  }

  getEmptyStateMessage() {
    return 'No annotations in this conversation yet';
  }

  generateSignature(items) {
    if (!items || items.length === 0) {
      return 'empty';
    }
    return items
      .map(state => {
        const annotation = state.annotation;
        return [
          annotation.id,
          annotation.updatedAt,
          annotation.color,
          annotation.note,
          state.status,
        ].join(':');
      })
      .join('|');
  }

  toggle() {
    super.toggle();
    return this.isVisible;
  }
}
