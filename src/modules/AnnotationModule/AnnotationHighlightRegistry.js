import { ANNOTATION_COLORS, DEFAULT_ANNOTATION_COLOR } from './AnnotationRange.js';

const STYLE_ID = 'cl-annotation-highlight-styles';
const HIGHLIGHT_PREFIX = 'cl-annotation';

function getHighlightRegistry() {
  return globalThis.CSS?.highlights || globalThis.window?.CSS?.highlights || null;
}

function getHighlightConstructor() {
  return globalThis.Highlight || globalThis.window?.Highlight || null;
}

function toHighlightName(annotationId) {
  return `${HIGHLIGHT_PREFIX}-${String(annotationId || '')
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/^-+/, '')}`;
}

export default class AnnotationHighlightRegistry {
  constructor() {
    this.names = new Set();
    this.styleElement = null;
  }

  isSupported() {
    return Boolean(getHighlightRegistry() && getHighlightConstructor());
  }

  render(states = []) {
    this.clear();
    if (!this.isSupported()) {
      return false;
    }

    const registry = getHighlightRegistry();
    const HighlightCtor = getHighlightConstructor();
    const cssRules = [];

    states
      .filter(state => state.status === 'resolved' && state.range && state.annotation?.id)
      .forEach(state => {
        const name = toHighlightName(state.annotation.id);
        const highlight = new HighlightCtor(state.range);
        const createdAt = Date.parse(state.annotation.createdAt || '') || Date.now();
        const color =
          ANNOTATION_COLORS[state.annotation.color] || ANNOTATION_COLORS[DEFAULT_ANNOTATION_COLOR];

        if ('priority' in highlight) {
          highlight.priority = createdAt;
        }

        registry.set(name, highlight);
        this.names.add(name);
        cssRules.push(`::highlight(${name}) { background-color: ${color.background}; }`);
      });

    this.ensureStyleElement();
    this.styleElement.textContent = cssRules.join('\n');
    return true;
  }

  ensureStyleElement() {
    if (this.styleElement?.isConnected) {
      return;
    }

    this.styleElement = document.getElementById(STYLE_ID);
    if (!this.styleElement) {
      this.styleElement = document.createElement('style');
      this.styleElement.id = STYLE_ID;
      document.head.appendChild(this.styleElement);
    }
  }

  clear() {
    const registry = getHighlightRegistry();
    if (registry) {
      for (const name of this.names) {
        registry.delete(name);
      }
    }
    this.names.clear();

    if (this.styleElement) {
      this.styleElement.textContent = '';
    }
  }

  destroy() {
    this.clear();
    this.styleElement?.remove();
    this.styleElement = null;
  }
}
