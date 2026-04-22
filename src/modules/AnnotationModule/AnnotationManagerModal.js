import DOMUtils from '../../utils/DOMUtils.js';
import IconLibrary from '../../components/primitives/IconLibrary.js';
import { annotationStore } from '../../stores/index.js';
import { trackEvent } from '../../analytics/Analytics.js';
import {
  ANNOTATION_COLOR_KEYS,
  ANNOTATION_COLORS,
  DEFAULT_ANNOTATION_COLOR,
  restoreAnnotation,
} from './AnnotationRange.js';

let activeAnnotationManagerModal = null;

export class AnnotationManagerModal {
  static getActiveInstance() {
    if (activeAnnotationManagerModal?.activeModal?.element?.isConnected) {
      return activeAnnotationManagerModal;
    }
    activeAnnotationManagerModal = null;
    return null;
  }

  static async showSingleton(options = {}) {
    const activeInstance = AnnotationManagerModal.getActiveInstance();
    if (activeInstance) {
      await activeInstance.refreshData();
      return activeInstance;
    }

    const modal = new AnnotationManagerModal();
    await modal.show(options);
    return modal;
  }

  constructor() {
    this.activeModal = null;
    this.searchDebounceTimer = null;
    this.state = {
      states: [],
      searchQuery: '',
      colorFilter: 'all',
      senderFilter: 'all',
      tagFilter: 'all',
      allTags: [],
    };
    this.editingNotes = new Set(); // Track notes being edited in modal
  }

  async show({ source = 'unknown' } = {}) {
    const activeInstance = AnnotationManagerModal.getActiveInstance();
    if (activeInstance && activeInstance !== this) {
      await activeInstance.refreshData();
      return activeInstance;
    }

    await this.loadData();
    trackEvent('annotation_manager_open', {
      module: 'annotations',
      method: source,
      annotation_count: this.state.states.length,
    });

    const modal = DOMUtils.createElement('div', {
      className:
        'cl-annotation-manager-modal fixed inset-0 z-[2147483647] flex items-center justify-center bg-black/60 backdrop-blur-md opacity-0 transition-opacity duration-200 p-4 sm:p-6',
    });

    const content = DOMUtils.createElement('div', {
      className:
        'flex max-h-full w-full max-w-[1200px] translate-y-5 flex-col overflow-hidden rounded-2xl bg-bg-000 opacity-0 shadow-2xl transition-all duration-300',
    });

    const header = this.createHeader();
    const toolbar = this.createToolbar();
    const list = DOMUtils.createElement('div', {
      className: 'cl-annotation-manager-list flex-1 min-h-0 overflow-y-auto p-6 bg-bg-100/20',
    });

    content.appendChild(header);
    content.appendChild(toolbar);
    content.appendChild(list);
    modal.appendChild(content);

    modal.addEventListener('click', event => {
      if (event.target === modal) {
        this.close('backdrop');
      }
    });

    const escHandler = event => {
      if (event.key === 'Escape') {
        this.close('escape');
      }
    };
    document.addEventListener('keydown', escHandler);

    this.activeModal = { element: modal, content, list, escHandler };
    activeAnnotationManagerModal = this;
    document.body.appendChild(modal);

    requestAnimationFrame(() => {
      modal.classList.remove('opacity-0');
      modal.classList.add('opacity-100');
      content.classList.remove('opacity-0', 'translate-y-5');
      content.classList.add('opacity-100', 'translate-y-0');
    });

    this.renderList();
    return this;
  }

  createHeader() {
    const header = DOMUtils.createElement('div', {
      className: 'flex items-center justify-between border-b border-border-200 px-6 py-4',
    });

    const titleWrap = DOMUtils.createElement('div', { className: 'min-w-0' });
    const title = DOMUtils.createElement('h2', {
      className: 'm-0 text-lg font-bold text-text-000',
      textContent: 'Annotations',
    });
    const subtitle = DOMUtils.createElement('p', {
      className: 'mt-0.5 text-xs text-text-400',
      textContent: 'Manage and navigate all your conversation highlights',
    });
    titleWrap.appendChild(title);
    titleWrap.appendChild(subtitle);

    const close = DOMUtils.createElement('button', {
      className:
        'rounded-lg px-3 py-1.5 text-sm font-medium text-text-400 hover:bg-bg-100 hover:text-text-000 transition-colors',
      textContent: 'Close',
      type: 'button',
    });
    close.addEventListener('click', () => this.close('button'));

    header.appendChild(titleWrap);
    header.appendChild(close);
    return header;
  }

  createToolbar() {
    const toolbar = DOMUtils.createElement('div', {
      className: 'flex items-center gap-3 border-b border-border-100 bg-bg-50 px-6 py-3',
    });

    const search = DOMUtils.createElement('input', {
      className:
        'flex-1 min-w-0 rounded-lg border border-border-300 bg-bg-000 px-3 py-2 text-sm text-text-000 outline-none transition-all focus:border-accent-main-100 focus:ring-1 focus:ring-accent-main-100/20',
      placeholder: 'Search keywords in selected text or notes...',
      type: 'search',
    });
    search.addEventListener('input', event => {
      this.state.searchQuery = event.target.value;
      clearTimeout(this.searchDebounceTimer);
      this.searchDebounceTimer = setTimeout(() => {
        trackEvent('annotation_manager_search', {
          module: 'annotations',
          method: 'manager',
          query_length: this.state.searchQuery.length,
        });
      }, 250);
      this.renderList();
    });

    const color = this.createSelect('Color', [
      ['all', 'All colors'],
      ...ANNOTATION_COLOR_KEYS.map(key => [key, ANNOTATION_COLORS[key].label]),
    ]);
    color.className =
      'w-[130px] rounded-lg border border-border-300 bg-bg-000 px-3 py-2 text-sm text-text-000 outline-none focus:border-accent-main-100';
    color.addEventListener('change', event => {
      this.state.colorFilter = event.target.value;
      this.renderList();
    });

    const sender = this.createSelect('Sender', [
      ['all', 'All senders'],
      ['user', 'User'],
      ['claude', 'Claude'],
    ]);
    sender.className =
      'w-[130px] rounded-lg border border-border-300 bg-bg-000 px-3 py-2 text-sm text-text-000 outline-none focus:border-accent-main-100';
    sender.addEventListener('change', event => {
      this.state.senderFilter = event.target.value;
      this.renderList();
    });

    const tagFilter = this.createSelect('Tag', [
      ['all', 'All tags'],
      ...this.state.allTags.map(tag => [tag, `#${tag}`]),
    ]);
    tagFilter.className =
      'w-[130px] rounded-lg border border-border-300 bg-bg-000 px-3 py-2 text-sm text-text-000 outline-none focus:border-accent-main-100';
    tagFilter.addEventListener('change', event => {
      this.state.tagFilter = event.target.value;
      this.renderList();
    });

    toolbar.appendChild(search);
    toolbar.appendChild(color);
    toolbar.appendChild(sender);
    toolbar.appendChild(tagFilter);
    return toolbar;
  }

  createSelect(label, options) {
    const select = DOMUtils.createElement('select', {
      className:
        'rounded-lg border border-border-300 bg-bg-000 px-3 py-2 text-sm text-text-000 outline-none focus:border-accent-main-100',
      'aria-label': label,
    });
    options.forEach(([value, text]) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = text;
      select.appendChild(option);
    });
    return select;
  }

  async loadData() {
    const annotations = await annotationStore.getAll();
    const currentPath = window.location.pathname;
    const messages = DOMUtils.findMessages();
    const tagsSet = new Set();
    annotations.forEach(a => (a.tags || []).forEach(t => tagsSet.add(t)));
    this.state.allTags = Array.from(tagsSet).sort();
    this.state.states = annotations.map(annotation => {
      if (annotation.conversationUrl === currentPath) {
        return restoreAnnotation(annotation, messages);
      }
      return { status: 'unresolved', annotation };
    });
  }

  async refreshData() {
    await this.loadData();
    this.renderList();
  }

  getFilteredStates() {
    const query = this.state.searchQuery.trim().toLowerCase();
    return this.state.states
      .filter(state => {
        const annotation = state.annotation;
        if (this.state.colorFilter !== 'all' && annotation.color !== this.state.colorFilter) {
          return false;
        }
        if (
          this.state.senderFilter !== 'all' &&
          annotation.messageSender !== this.state.senderFilter
        ) {
          return false;
        }
        if (
          this.state.tagFilter !== 'all' &&
          !(annotation.tags || []).includes(this.state.tagFilter)
        ) {
          return false;
        }
        if (!query) {
          return true;
        }
        return [
          annotation.selectedText,
          annotation.note,
          annotation.messagePreview,
          ...(annotation.tags || []),
        ]
          .join(' ')
          .toLowerCase()
          .includes(query);
      })
      .sort(
        (a, b) =>
          Date.parse(b.annotation.createdAt || '') - Date.parse(a.annotation.createdAt || '')
      );
  }

  renderList() {
    if (!this.activeModal?.list) {
      return;
    }
    const list = this.activeModal.list;
    list.textContent = '';
    const states = this.getFilteredStates();

    if (states.length === 0) {
      const empty = DOMUtils.createElement('div', { className: 'py-20 text-center' });
      empty.innerHTML = `<p class="text-sm text-text-400 font-medium">No annotations found</p>`;
      list.appendChild(empty);
      return;
    }

    const container = DOMUtils.createElement('div', {
      className: 'grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 min-h-0',
    });
    states.forEach(state => container.appendChild(this.createAnnotationCard(state)));
    list.appendChild(container);
  }

  createAnnotationCard(state) {
    const annotation = state.annotation;
    const color =
      ANNOTATION_COLORS[annotation.color] || ANNOTATION_COLORS[DEFAULT_ANNOTATION_COLOR];
    const isEditing = this.editingNotes.has(annotation.id);

    const card = DOMUtils.createElement('div', {
      className:
        'flex flex-col rounded-xl border border-border-200 bg-bg-000 shadow-sm transition-all hover:shadow-md h-fit',
    });

    const topBar = DOMUtils.createElement('div', {
      className:
        'flex items-center justify-between border-b border-border-100 px-4 py-2.5 bg-bg-50/50 rounded-t-xl',
    });

    const meta = DOMUtils.createElement('div', {
      className: 'flex min-w-0 flex-1 items-center gap-2',
    });
    const dot = DOMUtils.createElement('span', { className: 'size-2 shrink-0 rounded-full' });
    dot.style.background = color.swatch;
    const contextInfo = DOMUtils.createElement('div', { className: 'flex min-w-0 flex-col' });
    contextInfo.innerHTML = `<span class="truncate text-[9px] font-bold uppercase tracking-wider text-text-400">${annotation.messageSender || 'message'}</span>
                             <span class="truncate text-[10px] text-text-500 font-medium">${annotation.messagePreview || 'Untitled Chat'}</span>`;
    meta.appendChild(dot);
    meta.appendChild(contextInfo);

    const navigate = DOMUtils.createElement('button', {
      className:
        'flex h-8 w-8 items-center justify-center rounded-lg text-accent-main-100 hover:bg-accent-main-100/10 transition-colors',
      title: 'Go to Message',
      innerHTML: IconLibrary.openInNew('currentColor', 16),
    });
    navigate.onclick = () => this.navigate(annotation.id);

    topBar.appendChild(meta);
    topBar.appendChild(navigate);

    const body = DOMUtils.createElement('div', { className: 'flex flex-col p-4' });
    const text = DOMUtils.createElement('div', {
      className:
        'relative mb-3 max-h-[100px] overflow-y-auto rounded-lg border-l-2 bg-bg-100/50 px-3 py-2 text-sm italic text-text-100 line-clamp-3 hover:line-clamp-none transition-all',
      textContent: annotation.selectedText || '',
    });
    text.style.borderLeftColor = color.swatch;

    const noteLabel = DOMUtils.createElement('label', {
      className: 'mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-text-500',
      textContent: 'Note',
    });

    if (isEditing) {
      const noteInput = DOMUtils.createElement('textarea', {
        className:
          'min-h-[100px] w-full resize-none rounded-lg border border-border-300 bg-bg-100/30 px-3 py-2 text-sm text-text-000 outline-none transition-all focus:border-accent-main-100 focus:bg-bg-000 focus:ring-1 focus:ring-accent-main-100/20 mb-3',
        placeholder: 'Add a note...',
      });
      noteInput.value = annotation.note || '';

      const saveBtn = DOMUtils.createElement('button', {
        className: 'clp-button-primary rounded-lg px-3 py-1.5 text-xs font-bold uppercase mb-3',
        textContent: 'Save Note',
      });
      saveBtn.onclick = () => {
        this.editingNotes.delete(annotation.id);
        this.updateNote(annotation.id, noteInput.value);
      };

      body.appendChild(text);
      body.appendChild(noteLabel);
      body.appendChild(noteInput);
      body.appendChild(saveBtn);
    } else {
      const noteDisplay = DOMUtils.createElement('div', {
        className:
          'text-sm text-text-200 bg-bg-50/50 rounded-lg p-3 cursor-pointer hover:bg-bg-100 transition-colors border border-transparent hover:border-border-200 mb-3 min-h-[40px] flex items-center',
        textContent: annotation.note || 'No note added. Click to edit...',
      });
      if (!annotation.note) {
        noteDisplay.classList.add('italic', 'opacity-50');
      }
      noteDisplay.onclick = () => {
        this.editingNotes.add(annotation.id);
        this.renderList();
      };
      body.appendChild(text);
      body.appendChild(noteLabel);
      body.appendChild(noteDisplay);
    }

    const tagsContainer = DOMUtils.createElement('div', {
      className: 'flex flex-wrap gap-1 items-center mt-auto',
    });
    (annotation.tags || []).forEach(tag => {
      const tagEl = DOMUtils.createElement('span', {
        className:
          'bg-bg-100 text-text-300 px-2 py-0.5 rounded text-[10px] flex items-center gap-1 group/tag border border-border-200',
        textContent: tag,
      });
      const remove = DOMUtils.createElement('span', {
        className: 'cursor-pointer hover:text-red-500 opacity-50 group-hover/tag:opacity-100',
        textContent: '×',
      });
      remove.onclick = () =>
        this.updateAnnotation(annotation.id, {
          tags: (annotation.tags || []).filter(t => t !== tag),
        });
      tagEl.appendChild(remove);
      tagsContainer.appendChild(tagEl);
    });

    const addInput = DOMUtils.createElement('input', {
      className:
        'bg-transparent border-none outline-none text-[10px] text-text-400 w-20 ml-1 placeholder:text-text-500',
      placeholder: '+ add tag',
    });
    addInput.onkeydown = e => {
      if (e.key === 'Enter') {
        const val = addInput.value.trim().toLowerCase();
        if (val && !annotation.tags?.includes(val)) {
          this.updateAnnotation(annotation.id, { tags: [...(annotation.tags || []), val] });
        }
        addInput.value = '';
      }
    };
    tagsContainer.appendChild(addInput);
    body.appendChild(tagsContainer);

    const footer = DOMUtils.createElement('div', {
      className:
        'mt-auto flex items-center justify-between gap-3 border-t border-border-100 bg-bg-50/30 px-4 py-3 rounded-b-xl',
    });
    const colorSelect = this.createSelect(
      'Color',
      ANNOTATION_COLOR_KEYS.map(key => [key, ANNOTATION_COLORS[key].label])
    );
    colorSelect.value = annotation.color || DEFAULT_ANNOTATION_COLOR;
    colorSelect.className =
      'h-8 rounded-lg border border-border-300 bg-bg-000 px-2 text-xs text-text-200 outline-none';
    colorSelect.onchange = e => this.updateColor(annotation.id, e.target.value);

    const deleteBtn = DOMUtils.createElement('button', {
      className:
        'flex h-8 w-8 items-center justify-center rounded-lg text-text-400 hover:bg-red-50 hover:text-red-600 transition-colors',
      innerHTML: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6"/></svg>`,
    });
    deleteBtn.onclick = () => confirm('Delete annotation?') && this.delete(annotation.id);

    footer.appendChild(colorSelect);
    footer.appendChild(deleteBtn);
    card.appendChild(topBar);
    card.appendChild(body);
    card.appendChild(footer);
    return card;
  }

  async updateNote(annotationId, note) {
    await annotationStore.update(annotationId, { note });
    this.showToast('Note saved');
    await this.refreshData();
  }

  async updateAnnotation(annotationId, updates) {
    await annotationStore.update(annotationId, updates);
    await this.refreshData();
  }

  showToast(message, type = 'success') {
    const toast = DOMUtils.createElement('div', {
      className: `fixed bottom-6 left-1/2 z-[2147483647] -translate-x-1/2 rounded-full px-4 py-2 text-xs font-bold text-white shadow-2xl transition-all duration-300 translate-y-10 opacity-0`,
      textContent: message,
    });
    toast.style.backgroundColor = type === 'success' ? '#10b981' : '#ef4444';
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.remove('translate-y-10', 'opacity-0'));
    setTimeout(() => {
      toast.classList.add('translate-y-10', 'opacity-0');
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }

  async updateColor(annotationId, color) {
    await annotationStore.update(annotationId, { color });
    this.showToast('Color updated');
    await this.refreshData();
  }

  async delete(annotationId) {
    await annotationStore.remove(annotationId);
    this.showToast('Deleted', 'error');
    await this.refreshData();
  }

  navigate(annotationId) {
    const state = this.state.states.find(s => s.annotation.id === annotationId);
    if (!state) {
      return;
    }
    const annotation = state.annotation;
    if (annotation.conversationUrl && annotation.conversationUrl !== window.location.pathname) {
      const url = new URL(annotation.conversationUrl, window.location.origin);
      url.searchParams.set('cl_annotation', annotation.id);
      window.location.href = url.toString();
      this.close('navigate_external');
      return;
    }
    window.dispatchEvent(
      new CustomEvent('cl-annotations-navigate', {
        detail: { annotationId, source: 'manager', openEditor: true },
      })
    );
  }

  close(reason = 'unknown') {
    if (!this.activeModal) {
      return;
    }
    const { element, content, escHandler } = this.activeModal;
    element.classList.remove('opacity-100');
    content.classList.add('opacity-0', 'translate-y-5');
    setTimeout(() => {
      element.remove();
      document.removeEventListener('keydown', escHandler);
      this.activeModal = null;
      if (activeAnnotationManagerModal === this) {
        activeAnnotationManagerModal = null;
      }
    }, 200);
  }
}

export default AnnotationManagerModal;
