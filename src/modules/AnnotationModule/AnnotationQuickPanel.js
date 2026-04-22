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
      outsideClickIgnoreSelectors: ['#claude-annotations-fixed-btn', '.cl-annotation-editor'],
    });

    this.onNavigate = onNavigate;
    this.onDelete = onDelete;
    this.states = [];
    this.editingId = null;
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

    this.renderList();
  }

  renderList() {
    this.lastContentSignature = null;
    super.updateContent(this.states, state => this.createItem(state));
  }

  createItem(state) {
    const annotation = state.annotation;
    const color =
      ANNOTATION_COLORS[annotation.color] || ANNOTATION_COLORS[DEFAULT_ANNOTATION_COLOR];
    const isEditing = this.editingId === annotation.id;

    const item = document.createElement('div');
    item.className = cardClass(false, state.status === 'resolved' ? '' : 'opacity-80');
    item.setAttribute('data-annotation-id', annotation.id);
    item.onclick = e => e.stopPropagation();

    // 1. Header
    const header = document.createElement('div');
    header.className = 'mb-2 flex items-center justify-between gap-2';
    const meta = document.createElement('div');
    meta.className = 'flex min-w-0 items-center gap-2 text-xs text-text-400';
    const dot = document.createElement('span');
    dot.className =
      'size-2.5 shrink-0 rounded-full cursor-pointer hover:scale-125 transition-transform';
    dot.style.background = color.swatch;
    dot.onclick = e => {
      e.stopPropagation();
      this.cycleColor(annotation);
    };
    const sender = document.createElement('span');
    sender.className = 'truncate capitalize text-[10px] font-bold opacity-60';
    sender.textContent = annotation.messageSender || 'message';
    meta.appendChild(dot);
    meta.appendChild(sender);
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'text-xs text-text-500 hover:text-red-500 opacity-40 hover:opacity-100';
    deleteBtn.innerHTML = '×';
    deleteBtn.onclick = () =>
      confirm('Delete annotation?') && this.onDelete?.(annotation.id, 'quick_panel');
    header.appendChild(meta);
    header.appendChild(deleteBtn);

    // 2. Text Preview
    const textPreview = document.createElement('div');
    textPreview.className =
      'text-sm text-text-100 border-l-2 pl-2 mb-3 italic cursor-pointer hover:text-accent-main-100 line-clamp-2';
    textPreview.style.borderLeftColor = color.swatch;
    textPreview.textContent = annotation.selectedText || '';
    textPreview.onclick = () => this.onNavigate?.(annotation.id, { source: 'quick_panel' });

    // 3. Note Area
    const noteContainer = document.createElement('div');
    if (isEditing) {
      const textarea = document.createElement('textarea');
      textarea.className =
        'w-full min-h-[80px] bg-bg-100 border border-border-300 rounded-lg p-2 text-xs text-text-000 outline-none focus:border-accent-main-100 resize-none mb-2';
      textarea.placeholder = 'Add a note...';
      textarea.value = annotation.note || '';
      const saveBtn = document.createElement('button');
      saveBtn.className =
        'clp-button-primary rounded px-2 py-1 text-[10px] font-bold uppercase w-full mb-2';
      saveBtn.textContent = 'Save Note';
      saveBtn.onclick = e => {
        e.stopPropagation();
        this.editingId = null;
        window.dispatchEvent(
          new CustomEvent('cl-annotation-quick-update', {
            detail: { id: annotation.id, updates: { note: textarea.value } },
          })
        );
      };
      noteContainer.appendChild(textarea);
      noteContainer.appendChild(saveBtn);
      setTimeout(() => textarea.focus(), 50);
    } else {
      const noteDisplay = document.createElement('div');
      noteDisplay.className =
        'text-xs text-text-300 bg-bg-50/50 rounded-lg p-2 cursor-pointer hover:bg-bg-100 border border-transparent hover:border-border-200 mb-2 min-h-[30px] flex items-center';
      noteDisplay.textContent = annotation.note || 'No note added. Click to edit...';
      if (!annotation.note) {
        noteDisplay.classList.add('italic', 'opacity-50');
      }
      noteDisplay.onclick = e => {
        e.stopPropagation();
        this.editingId = annotation.id;
        this.renderList();
      };
      noteContainer.appendChild(noteDisplay);
    }

    // 4. Tags Area
    const tagsContainer = document.createElement('div');
    tagsContainer.className = 'flex flex-wrap gap-1 items-center';
    (annotation.tags || []).forEach(tag => {
      const tagEl = document.createElement('span');
      tagEl.className =
        'bg-bg-200 text-text-400 px-1.5 py-0.5 rounded text-[9px] flex items-center gap-1 border border-border-100';
      tagEl.textContent = tag;
      const remove = document.createElement('span');
      remove.className = 'cursor-pointer hover:text-red-500 opacity-50';
      remove.textContent = '×';
      remove.onclick = e => {
        e.stopPropagation();
        this.updateTags(
          annotation.id,
          annotation.tags.filter(t => t !== tag)
        );
      };
      tagEl.appendChild(remove);
      tagsContainer.appendChild(tagEl);
    });

    const addInput = document.createElement('input');
    addInput.className =
      'bg-transparent border-none outline-none text-[10px] text-text-500 w-16 ml-1';
    addInput.placeholder = '+ tag';
    addInput.onkeydown = e => {
      if (e.key === 'Enter') {
        e.stopPropagation();
        const val = addInput.value.trim().toLowerCase();
        if (val && !annotation.tags?.includes(val)) {
          this.updateTags(annotation.id, [...(annotation.tags || []), val]);
        }
        addInput.value = '';
      }
    };
    tagsContainer.appendChild(addInput);

    // Final Assembly
    item.appendChild(header);
    item.appendChild(textPreview);
    item.appendChild(noteContainer);
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
    const next =
      colors[(colors.indexOf(annotation.color || DEFAULT_ANNOTATION_COLOR) + 1) % colors.length];
    window.dispatchEvent(
      new CustomEvent('cl-annotation-quick-update', {
        detail: { id: annotation.id, updates: { color: next } },
      })
    );
  }

  generateSignature(items) {
    if (!items || items.length === 0) {
      return 'empty';
    }
    const base = items
      .map(s => {
        const a = s.annotation;
        return `${a.id}:${a.updatedAt}:${a.color}:${a.note}:${(a.tags || []).join(',')}:${s.status}`;
      })
      .join('|');
    return `${base}#editing:${this.editingId}`;
  }

  toggle() {
    super.toggle();
    return this.isVisible;
  }
}
