import DOMUtils from '../../utils/DOMUtils.js';
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
      statusFilter: 'all',
    };
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
        'cl-annotation-manager-modal fixed inset-0 z-[2147483647] flex items-center justify-center bg-black/60 backdrop-blur-md opacity-0 transition-opacity duration-200',
    });

    const content = DOMUtils.createElement('div', {
      className:
        'flex h-[78vh] w-full max-w-[980px] translate-y-5 flex-col overflow-hidden rounded-xl bg-bg-000 opacity-0 shadow-2xl transition-all duration-300',
    });

    const header = this.createHeader();
    const toolbar = this.createToolbar();
    const list = DOMUtils.createElement('div', {
      className: 'cl-annotation-manager-list flex-1 overflow-y-auto p-5',
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
      className: 'm-0 text-lg font-semibold text-text-000',
      textContent: 'Annotations',
    });
    const subtitle = DOMUtils.createElement('p', {
      className: 'mt-1 text-xs text-text-400',
      textContent: 'Current conversation highlights and notes',
    });
    titleWrap.appendChild(title);
    titleWrap.appendChild(subtitle);

    const close = DOMUtils.createElement('button', {
      className: 'rounded-lg px-3 py-2 text-text-400 hover:bg-bg-100 hover:text-text-000',
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
      className:
        'grid grid-cols-1 gap-3 border-b border-border-100 bg-bg-50 px-6 py-4 md:grid-cols-[1fr_160px_180px]',
    });

    const search = DOMUtils.createElement('input', {
      className:
        'rounded-lg border border-border-300 bg-bg-000 px-3 py-2 text-sm text-text-000 outline-none focus:border-accent-main-100',
      placeholder: 'Search selected text, note, or message preview',
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
    color.addEventListener('change', event => {
      this.state.colorFilter = event.target.value;
      trackEvent('annotation_manager_filter', {
        module: 'annotations',
        method: 'color',
        filter: this.state.colorFilter,
      });
      this.renderList();
    });

    const status = this.createSelect('State', [
      ['all', 'All states'],
      ['resolved', 'Resolved'],
      ['unresolved', 'Unresolved'],
    ]);
    status.addEventListener('change', event => {
      this.state.statusFilter = event.target.value;
      trackEvent('annotation_manager_filter', {
        module: 'annotations',
        method: 'status',
        filter: this.state.statusFilter,
      });
      this.renderList();
    });

    toolbar.appendChild(search);
    toolbar.appendChild(color);
    toolbar.appendChild(status);
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
    const annotations = await annotationStore.getByConversation(window.location.pathname);
    const messages = DOMUtils.findMessages();
    this.state.states = annotations.map(annotation => restoreAnnotation(annotation, messages));
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
        if (this.state.statusFilter !== 'all' && state.status !== this.state.statusFilter) {
          return false;
        }
        if (!query) {
          return true;
        }
        return [annotation.selectedText, annotation.note, annotation.messagePreview]
          .join(' ')
          .toLowerCase()
          .includes(query);
      })
      .sort((a, b) => {
        return Date.parse(b.annotation.createdAt || '') - Date.parse(a.annotation.createdAt || '');
      });
  }

  renderList() {
    if (!this.activeModal?.list) {
      return;
    }

    const list = this.activeModal.list;
    list.textContent = '';
    const states = this.getFilteredStates();

    if (states.length === 0) {
      const empty = DOMUtils.createElement('div', {
        className: 'py-12 text-center text-sm text-text-400',
        textContent: 'No annotations match this view.',
      });
      list.appendChild(empty);
      return;
    }

    const container = DOMUtils.createElement('div', { className: 'flex flex-col gap-3' });
    states.forEach(state => container.appendChild(this.createAnnotationCard(state)));
    list.appendChild(container);
  }

  createAnnotationCard(state) {
    const annotation = state.annotation;
    const color =
      ANNOTATION_COLORS[annotation.color] || ANNOTATION_COLORS[DEFAULT_ANNOTATION_COLOR];
    const card = DOMUtils.createElement('div', {
      className: 'rounded-xl border border-border-200 bg-bg-000 p-4 shadow-sm',
    });

    const header = DOMUtils.createElement('div', {
      className: 'mb-3 flex items-center justify-between gap-3',
    });
    const meta = DOMUtils.createElement('div', {
      className: 'flex min-w-0 items-center gap-2 text-xs text-text-400',
    });
    const dot = DOMUtils.createElement('span', { className: 'size-2.5 shrink-0 rounded-full' });
    dot.style.background = color.swatch;
    const sender = DOMUtils.createElement('span', {
      className: 'capitalize',
      textContent: annotation.messageSender || 'message',
    });
    const status = DOMUtils.createElement('span', {
      className:
        state.status === 'resolved'
          ? 'rounded-full bg-green-100 px-2 py-0.5 text-[10px] uppercase text-green-700'
          : 'rounded-full bg-bg-200 px-2 py-0.5 text-[10px] uppercase text-text-400',
      textContent: state.status,
    });
    meta.appendChild(dot);
    meta.appendChild(sender);
    meta.appendChild(status);

    const navigate = DOMUtils.createElement('button', {
      className:
        state.status === 'resolved'
          ? 'rounded-lg px-2 py-1 text-xs text-accent-main-100 hover:bg-bg-100'
          : 'rounded-lg px-2 py-1 text-xs text-text-400 opacity-60',
      textContent: 'Navigate',
      type: 'button',
    });
    navigate.disabled = state.status !== 'resolved';
    navigate.addEventListener('click', () => this.navigate(annotation.id));

    header.appendChild(meta);
    header.appendChild(navigate);

    const text = DOMUtils.createElement('div', {
      className: 'mb-3 rounded-lg bg-bg-100 px-3 py-2 text-sm text-text-000',
      textContent: annotation.selectedText || '',
    });

    const note = DOMUtils.createElement('textarea', {
      className:
        'min-h-[78px] w-full resize-none rounded-lg border border-border-300 bg-bg-100 px-3 py-2 text-sm text-text-000 outline-none focus:border-accent-main-100',
      placeholder: 'Add a note...',
    });
    note.value = annotation.note || '';

    const footer = DOMUtils.createElement('div', {
      className: 'mt-3 flex flex-wrap items-center justify-between gap-2',
    });

    const colorSelect = this.createSelect(
      'Annotation color',
      ANNOTATION_COLOR_KEYS.map(key => [key, ANNOTATION_COLORS[key].label])
    );
    colorSelect.value = annotation.color || DEFAULT_ANNOTATION_COLOR;
    colorSelect.addEventListener('change', event => {
      this.updateColor(annotation.id, event.target.value);
    });

    const actions = DOMUtils.createElement('div', {
      className: 'ml-auto flex items-center gap-2',
    });
    const deleteButton = DOMUtils.createElement('button', {
      className: 'rounded-lg px-3 py-1.5 text-xs text-red-600 hover:bg-red-50',
      textContent: 'Delete',
      type: 'button',
    });
    deleteButton.addEventListener('click', () => this.delete(annotation.id));

    const save = DOMUtils.createElement('button', {
      className: 'rounded-lg clp-button-primary px-3 py-1.5 text-xs font-medium',
      textContent: 'Save note',
      type: 'button',
    });
    save.addEventListener('click', () => this.updateNote(annotation.id, note.value));

    actions.appendChild(deleteButton);
    actions.appendChild(save);
    footer.appendChild(colorSelect);
    footer.appendChild(actions);

    card.appendChild(header);
    card.appendChild(text);
    card.appendChild(note);
    card.appendChild(footer);
    return card;
  }

  async updateNote(annotationId, note) {
    await annotationStore.update(annotationId, { note });
    trackEvent('annotation_note_update', {
      module: 'annotations',
      method: 'manager',
    });
    await this.refreshData();
  }

  async updateColor(annotationId, color) {
    await annotationStore.update(annotationId, { color });
    trackEvent('annotation_color_change', {
      module: 'annotations',
      method: 'manager',
      color,
    });
    await this.refreshData();
  }

  async delete(annotationId) {
    await annotationStore.remove(annotationId);
    trackEvent('annotation_delete', {
      module: 'annotations',
      method: 'manager',
    });
    await this.refreshData();
  }

  navigate(annotationId) {
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
    clearTimeout(this.searchDebounceTimer);
    element.classList.remove('opacity-100');
    element.classList.add('opacity-0');
    content.classList.remove('opacity-100', 'translate-y-0');
    content.classList.add('opacity-0', 'translate-y-5');

    setTimeout(() => {
      element.remove();
      document.removeEventListener('keydown', escHandler);
      this.activeModal = null;
      if (activeAnnotationManagerModal === this) {
        activeAnnotationManagerModal = null;
      }
    }, 200);
    void reason;
  }
}

export default AnnotationManagerModal;
