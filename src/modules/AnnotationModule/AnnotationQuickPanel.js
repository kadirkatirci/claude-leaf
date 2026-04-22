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
    item.setAttribute('data-annotation-id', annotation.id);

    const header = document.createElement('div');
    header.className = 'mb-2 flex items-center justify-between gap-2';

    const meta = document.createElement('div');
    meta.className = 'flex min-w-0 items-center gap-2 text-xs text-text-400';

    const dot = document.createElement('span');
    dot.className =
      'size-2.5 shrink-0 rounded-full cursor-pointer hover:scale-125 transition-transform';
    dot.style.background = color.swatch;
    dot.title = 'Change color';
    dot.addEventListener('click', e => {
      e.stopPropagation();
      this.cycleColor(annotation);
    });

    const sender = document.createElement('span');
    sender.className = 'truncate capitalize cursor-default';
    sender.textContent = annotation.messageSender || 'message';

    meta.appendChild(dot);
    meta.appendChild(sender);

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'text-sm leading-none text-text-400 hover:text-red-500 p-1';
    deleteButton.textContent = '×';
    deleteButton.setAttribute('aria-label', 'Delete annotation');
    deleteButton.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      this.onDelete?.(annotation.id, 'quick_panel');
    });

    header.appendChild(meta);
    header.appendChild(deleteButton);

    const textPreview = document.createElement('div');
    textPreview.className =
      'text-sm text-text-000 border-l-2 pl-2 mb-2 italic cursor-pointer hover:text-accent-main-100 transition-colors';
    textPreview.style.borderLeftColor = color.swatch;
    textPreview.textContent = annotation.selectedText || '';
    textPreview.addEventListener('click', () => {
      this.onNavigate?.(annotation.id, { source: 'quick_panel' });
    });

    const noteInput = document.createElement('textarea');
    noteInput.className =
      'w-full min-h-[60px] bg-bg-100 border border-border-300 rounded-lg p-2 text-xs text-text-100 outline-none focus:border-accent-main-100 resize-none transition-all mb-2';
    noteInput.placeholder = 'Add your note here...';
    noteInput.value = annotation.note || '';

    // Save note on input with debounce
    let saveTimeout;
    noteInput.addEventListener('input', () => {
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent('cl-annotation-quick-update', {
            detail: { id: annotation.id, updates: { note: noteInput.value } },
          })
        );
      }, 400);
    });

    // Tags Section
    const tagsContainer = document.createElement('div');
    tagsContainer.className = 'flex flex-wrap gap-1 mb-2';

    const renderTags = () => {
      tagsContainer.innerHTML = '';
      const currentTags = annotation.tags || [];

      currentTags.forEach(tag => {
        const tagEl = document.createElement('span');
        tagEl.className =
          'bg-bg-200 text-text-300 px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1 group/tag';
        tagEl.textContent = tag;

        const removeBtn = document.createElement('span');
        removeBtn.className =
          'cursor-pointer hover:text-red-500 opacity-50 group-hover/tag:opacity-100';
        removeBtn.textContent = '×';
        removeBtn.onclick = e => {
          e.stopPropagation();
          const newTags = currentTags.filter(t => t !== tag);
          this.updateTags(annotation.id, newTags);
        };

        tagEl.appendChild(removeBtn);
        tagsContainer.appendChild(tagEl);
      });

      const addTagBtn = document.createElement('input');
      addTagBtn.className =
        'bg-transparent border-none outline-none text-[10px] text-text-400 w-16 placeholder:text-text-500';
      addTagBtn.placeholder = '+ add tag';
      addTagBtn.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          const val = addTagBtn.value.trim().toLowerCase();
          if (val && !(annotation.tags || []).includes(val)) {
            const newTags = [...(annotation.tags || []), val];
            this.updateTags(annotation.id, newTags);
          }
          addTagBtn.value = '';
        }
      });
      tagsContainer.appendChild(addTagBtn);
    };

    renderTags();

    item.appendChild(header);
    item.appendChild(textPreview);
    item.appendChild(noteInput);
    item.appendChild(tagsContainer);

    return item;
  }

  updateTags(id, tags) {
    window.dispatchEvent(
      new CustomEvent('cl-annotation-quick-update', {
        detail: { id, updates: { tags } },
      })
    );
  }

  cycleColor(annotation) {
    const colors = Object.keys(ANNOTATION_COLORS);
    const currentIndex = colors.indexOf(annotation.color || DEFAULT_ANNOTATION_COLOR);
    const nextColor = colors[(currentIndex + 1) % colors.length];

    window.dispatchEvent(
      new CustomEvent('cl-annotation-quick-update', {
        detail: { id: annotation.id, updates: { color: nextColor } },
      })
    );
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
          (annotation.tags || []).join(','),
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
