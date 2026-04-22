import {
  ANNOTATION_COLOR_KEYS,
  ANNOTATION_COLORS,
  DEFAULT_ANNOTATION_COLOR,
  clampRectToViewport,
} from './AnnotationRange.js';

export default class AnnotationEditorPopover {
  constructor({ onSave, onDelete }) {
    this.onSave = onSave;
    this.onDelete = onDelete;
    this.element = null;
    this.annotation = null;
    this.selectedColor = DEFAULT_ANNOTATION_COLOR;
    this.focusTimer = null;
    this.outsideClickHandler = this.handleOutsideClick.bind(this);
    this.escapeHandler = this.handleEscape.bind(this);
  }

  show({ annotation, anchorRect }) {
    this.hide();
    this.annotation = annotation;
    this.selectedColor = annotation.color || DEFAULT_ANNOTATION_COLOR;

    const popover = document.createElement('div');
    popover.className =
      'cl-annotation-editor fixed z-[2147483647] w-[280px] rounded-xl border border-border-300 bg-bg-000 p-3 shadow-2xl';

    const preview = document.createElement('div');
    preview.className = 'mb-2 line-clamp-2 text-xs text-text-400';
    preview.textContent = annotation.selectedText || '';

    const textarea = document.createElement('textarea');
    textarea.className =
      'min-h-[84px] w-full resize-none rounded-lg border border-border-300 bg-bg-100 px-3 py-2 text-sm text-text-000 outline-none focus:border-accent-main-100';
    textarea.placeholder = 'Add a note...';
    textarea.value = annotation.note || '';

    const colorRow = document.createElement('div');
    colorRow.className = 'mt-2 flex items-center gap-1';
    ANNOTATION_COLOR_KEYS.forEach(colorKey => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className =
        'size-6 rounded-full border transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-1';
      button.style.background = ANNOTATION_COLORS[colorKey].swatch;
      button.style.borderColor =
        colorKey === this.selectedColor ? 'var(--clp-accent-bg)' : 'hsl(var(--border-300))';
      button.setAttribute('aria-label', `Change to ${ANNOTATION_COLORS[colorKey].label}`);
      button.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        this.selectedColor = colorKey;
        this.onSave?.(annotation.id, { color: colorKey, note: textarea.value }, 'color');
        this.show({
          annotation: { ...annotation, color: colorKey, note: textarea.value },
          anchorRect,
        });
      });
      colorRow.appendChild(button);
    });

    const actions = document.createElement('div');
    actions.className = 'mt-3 flex items-center justify-between gap-2';

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className =
      'rounded-lg px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20';
    deleteButton.textContent = 'Delete';
    deleteButton.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      this.onDelete?.(annotation.id, 'popover');
      this.hide();
    });

    const saveButton = document.createElement('button');
    saveButton.type = 'button';
    saveButton.className = 'rounded-lg clp-button-primary px-3 py-1.5 text-xs font-medium';
    saveButton.textContent = 'Save note';
    saveButton.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      this.onSave?.(annotation.id, { note: textarea.value, color: this.selectedColor }, 'note');
      this.hide();
    });

    actions.appendChild(deleteButton);
    actions.appendChild(saveButton);
    popover.appendChild(preview);
    popover.appendChild(textarea);
    popover.appendChild(colorRow);
    popover.appendChild(actions);

    const position = clampRectToViewport(anchorRect, 280, 190);
    popover.style.left = `${position.left}px`;
    popover.style.top = `${position.top}px`;

    document.body.appendChild(popover);
    document.addEventListener('click', this.outsideClickHandler, true);
    document.addEventListener('keydown', this.escapeHandler);
    this.element = popover;

    this.focusTimer = setTimeout(() => {
      if (textarea.isConnected) {
        textarea.focus();
      }
    }, 0);
  }

  handleOutsideClick(event) {
    if (!this.element || this.element.contains(event.target)) {
      return;
    }
    this.hide();
  }

  handleEscape(event) {
    if (event.key === 'Escape') {
      this.hide();
    }
  }

  hide() {
    if (this.focusTimer) {
      clearTimeout(this.focusTimer);
      this.focusTimer = null;
    }
    document.removeEventListener('click', this.outsideClickHandler, true);
    document.removeEventListener('keydown', this.escapeHandler);
    this.element?.remove();
    this.element = null;
    this.annotation = null;
  }

  destroy() {
    this.hide();
  }
}
