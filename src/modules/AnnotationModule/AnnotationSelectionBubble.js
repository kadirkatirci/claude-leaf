import {
  ANNOTATION_COLOR_KEYS,
  ANNOTATION_COLORS,
  clampRectToViewport,
} from './AnnotationRange.js';

export default class AnnotationSelectionBubble {
  constructor({ onColorSelect }) {
    this.onColorSelect = onColorSelect;
    this.element = null;
    this.activeSelection = null;
  }

  create() {
    if (this.element?.isConnected) {
      return this.element;
    }

    const bubble = document.createElement('div');
    bubble.className =
      'cl-annotation-bubble fixed z-[2147483647] flex items-center gap-1 rounded-full border border-border-300 bg-bg-000/95 px-2 py-1 shadow-xl backdrop-blur';
    bubble.style.display = 'none';

    ANNOTATION_COLOR_KEYS.forEach(colorKey => {
      const color = ANNOTATION_COLORS[colorKey];
      const button = document.createElement('button');
      button.type = 'button';
      button.className =
        'size-6 rounded-full border border-border-300 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-1';
      button.style.background = color.swatch;
      button.setAttribute('aria-label', `Highlight ${color.label}`);
      button.dataset.annotationColor = colorKey;
      button.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        this.onColorSelect?.(colorKey, this.activeSelection);
      });
      bubble.appendChild(button);
    });

    document.body.appendChild(bubble);
    this.element = bubble;
    return bubble;
  }

  show({ rect, selectionData }) {
    const bubble = this.create();
    this.activeSelection = selectionData;

    // Positioning: Right-aligned relative to selection
    const bubbleWidth = 136;
    const bubbleHeight = 36;
    const margin = 8;

    const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

    let left = rect.right - bubbleWidth;
    let top = rect.bottom + 8; // Default to below

    // Boundary checks
    if (left < margin) {
      left = margin;
    }
    if (left + bubbleWidth > viewportWidth - margin) {
      left = viewportWidth - bubbleWidth - margin;
    }

    // Flip to top if no space below
    if (top + bubbleHeight > viewportHeight - margin) {
      top = rect.top - bubbleHeight - 8;
    }

    bubble.style.left = `${left}px`;
    bubble.style.top = `${top}px`;
    bubble.style.display = 'flex';
  }

  hide() {
    if (this.element) {
      this.element.style.display = 'none';
    }
    this.activeSelection = null;
  }

  destroy() {
    this.element?.remove();
    this.element = null;
    this.activeSelection = null;
  }
}
