import BaseModule from './BaseModule.js';
import FixedButtonMixin from '../core/FixedButtonMixin.js';
import IconLibrary from '../components/primitives/IconLibrary.js';
import { Events } from '../utils/EventBus.js';
import { debugLog } from '../config/debug.js';
import { trackEvent } from '../analytics/Analytics.js';
import { annotationStore } from '../stores/index.js';
import AnnotationHighlightRegistry from './AnnotationModule/AnnotationHighlightRegistry.js';
import AnnotationSelectionBubble from './AnnotationModule/AnnotationSelectionBubble.js';
import AnnotationEditorPopover from './AnnotationModule/AnnotationEditorPopover.js';
import AnnotationQuickPanel from './AnnotationModule/AnnotationQuickPanel.js';
import AnnotationSidebar from './AnnotationModule/AnnotationSidebar.js';
import {
  DEFAULT_ANNOTATION_COLOR,
  findAnnotationAtPoint,
  restoreAnnotation,
  serializeSelection,
} from './AnnotationModule/AnnotationRange.js';

const NAVIGATE_EVENT = 'cl-annotations-navigate';

function getRangeRect(range, fallbackPoint = null) {
  const rect = range?.getBoundingClientRect?.();
  if (rect && (rect.width || rect.height)) {
    return rect;
  }

  const firstRect = range?.getClientRects?.()?.[0];
  if (firstRect) {
    return firstRect;
  }

  return {
    left: fallbackPoint?.x || window.innerWidth / 2,
    top: fallbackPoint?.y || window.innerHeight / 2,
    width: 1,
    height: 1,
  };
}

function isInjectedAnnotationSurface(target) {
  return Boolean(
    target?.closest?.(
      '.cl-annotation-bubble, .cl-annotation-editor, .cl-annotation-panel, .cl-annotation-manager-modal, .cl-annotation-quick-panel, #claude-annotations-panel, #claude-annotations-fixed-btn, [data-clp-sidebar-annotations-item="true"]'
    )
  );
}

export default class AnnotationModule extends BaseModule {
  constructor() {
    super('annotations');
    this.registry = new AnnotationHighlightRegistry();
    this.bubble = new AnnotationSelectionBubble({
      onColorSelect: (color, selectionData) => this.createAnnotation(color, selectionData),
    });
    this.editor = new AnnotationEditorPopover({
      onSave: (id, updates, source) => this.updateAnnotation(id, updates, source),
      onDelete: (id, source) => this.deleteAnnotation(id, source),
    });
    this.panel = new AnnotationQuickPanel({
      onNavigate: (id, options) => this.navigateToAnnotation(id, options),
      onDelete: (id, source) => this.deleteAnnotation(id, source),
    });
    this.sidebar = new AnnotationSidebar(this.dom);
    this.annotationStates = [];
    this.selectionCheckTimer = null;
    this.supportsHighlightRendering = false;

    this.handleDocumentClick = this.handleDocumentClick.bind(this);
    this.handleSelectionEvent = this.handleSelectionEvent.bind(this);
    this.handleViewportChange = this.handleViewportChange.bind(this);
    this.handleManagerNavigate = this.handleManagerNavigate.bind(this);
  }

  async init() {
    const initStart = performance.now();
    await super.init();
    if (!this.enabled) {
      return;
    }

    debugLog('annotations', 'Initializing annotations');
    FixedButtonMixin.enhance(this);
    this.supportsHighlightRendering = this.registry.isSupported();

    this.panel.create();
    this.panel.panel?.classList.add('cl-annotation-panel');
    this.sidebar.inject();

    await this.createFixedButton({
      id: 'claude-annotations-fixed-btn',
      icon: IconLibrary.highlight('currentColor', 20),
      tooltip: 'Annotations',
      position: { right: '30px', transform: 'translateY(-280px)' },
      onClick: () => this.togglePanel('button'),
      showCounter: true,
    });
    this.setupVisibilityListener();

    if (this.supportsHighlightRendering) {
      this.setupSelectionListeners();
    }

    this.subscribe(Events.HUB_CONTENT_CHANGED, async () => {
      await this.updateUI();
    });
    window.addEventListener(NAVIGATE_EVENT, this.handleManagerNavigate);

    await this.updateUI();
    trackEvent('perf_init', {
      module: 'annotations',
      init_ms: Math.round(performance.now() - initStart),
    });
  }

  setupSelectionListeners() {
    document.addEventListener('mouseup', this.handleSelectionEvent);
    document.addEventListener('keyup', this.handleSelectionEvent);
    document.addEventListener('selectionchange', this.handleSelectionEvent);
    document.addEventListener('click', this.handleDocumentClick, true);
    window.addEventListener('scroll', this.handleViewportChange, true);
    window.addEventListener('resize', this.handleViewportChange);
  }

  clearUIElements() {
    this.annotationStates = [];
    this.registry.clear();
    this.panel.updateAnnotations([]);
    this.updateButtonCounter(0);
  }

  async reinitializeUI() {
    if (!this.enabled) {
      return;
    }

    this.bubble.hide();
    this.editor.hide();
    this.sidebar.inject();
    await this.updateUI();
  }

  async updateUI() {
    if (!this.enabled) {
      return;
    }

    if (!this.dom.isOnConversationPage()) {
      this.clearUIElements();
      return;
    }

    const conversationUrl = window.location.pathname;
    const annotations = await annotationStore.getByConversation(conversationUrl);
    if (!this.enabled) {
      return;
    }
    const messages = this.dom.findMessages();
    this.annotationStates = annotations.map(annotation => restoreAnnotation(annotation, messages));

    if (this.supportsHighlightRendering) {
      this.registry.render(this.annotationStates);
    }

    this.updateButtonCounter(annotations.length);
    this.panel.updateAnnotations(this.annotationStates);
  }

  async waitAndUpdateUI() {
    let retries = 0;
    while (this.dom.findMessages().length === 0 && retries < 5) {
      await new Promise(resolve => {
        setTimeout(resolve, 200 * Math.pow(1.5, retries));
      });
      retries++;
    }
    await this.updateUI();
  }

  handleSelectionEvent() {
    clearTimeout(this.selectionCheckTimer);
    this.selectionCheckTimer = setTimeout(() => this.evaluateSelection(), 80);
  }

  evaluateSelection() {
    if (!this.supportsHighlightRendering || !this.dom.isOnConversationPage()) {
      this.bubble.hide();
      return;
    }

    const selection = window.getSelection?.();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      this.bubble.hide();
      return;
    }

    const messages = this.dom.findMessages();
    const selectionData = serializeSelection(selection, messages);
    if (!selectionData) {
      this.bubble.hide();
      return;
    }

    const rect = getRangeRect(selection.getRangeAt(0));
    this.bubble.show({ rect, selectionData });
  }

  async createAnnotation(color = DEFAULT_ANNOTATION_COLOR, selectionData) {
    if (!selectionData) {
      return;
    }

    await annotationStore.add({
      conversationUrl: window.location.pathname,
      messageIndex: selectionData.messageIndex,
      messageSender: selectionData.messageSender,
      contentSignature: selectionData.contentSignature,
      messagePreview: selectionData.messagePreview,
      selectedText: selectionData.selectedText,
      note: '',
      color,
      range: selectionData.range,
      context: selectionData.context,
    });

    window.getSelection?.()?.removeAllRanges?.();
    this.bubble.hide();
    trackEvent('annotation_create', {
      module: 'annotations',
      method: 'selection_bubble',
      color,
      message_index: selectionData.messageIndex,
    });
    await this.updateUI();
  }

  async updateAnnotation(annotationId, updates, source = 'popover') {
    const existing = await annotationStore.getById(annotationId);
    if (!existing) {
      return;
    }

    await annotationStore.update(annotationId, updates);

    if (updates.note !== undefined && updates.note !== existing.note) {
      trackEvent('annotation_note_update', {
        module: 'annotations',
        method: source,
      });
    }
    if (updates.color && updates.color !== existing.color) {
      trackEvent('annotation_color_change', {
        module: 'annotations',
        method: source,
        color: updates.color,
      });
    }

    await this.updateUI();
  }

  async deleteAnnotation(annotationId, source = 'popover') {
    await annotationStore.remove(annotationId);
    this.editor.hide();
    trackEvent('annotation_delete', {
      module: 'annotations',
      method: source,
    });
    await this.updateUI();
  }

  handleDocumentClick(event) {
    if (!this.supportsHighlightRendering || isInjectedAnnotationSurface(event.target)) {
      return;
    }

    const annotation = findAnnotationAtPoint(event.clientX, event.clientY, this.annotationStates);
    if (!annotation) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    this.openEditor(annotation.id, {
      point: { x: event.clientX, y: event.clientY },
    });
  }

  openEditor(annotationId, options = {}) {
    const state = this.annotationStates.find(item => item.annotation.id === annotationId);
    if (!state || state.status !== 'resolved') {
      return false;
    }

    const anchorRect = getRangeRect(state.range, options.point);
    this.editor.show({
      annotation: state.annotation,
      anchorRect,
    });
    return true;
  }

  navigateToAnnotation(annotationId, { openEditor = false, source = 'panel' } = {}) {
    const state = this.annotationStates.find(item => item.annotation.id === annotationId);
    if (!state || state.status !== 'resolved') {
      return false;
    }

    this.dom.scrollToElement(state.messageElement, 'center');
    trackEvent('annotation_navigate', {
      module: 'annotations',
      method: source,
    });

    if (openEditor) {
      setTimeout(() => this.openEditor(annotationId), 220);
    }
    return true;
  }

  togglePanel(method = 'button') {
    const isVisible = this.panel.toggle();
    trackEvent('annotation_quick_panel_toggle', {
      module: 'annotations',
      method,
      state: isVisible ? 'open' : 'close',
      annotation_count: this.annotationStates.length,
    });
    if (isVisible) {
      void this.updateUI();
    }
  }

  handleViewportChange() {
    this.bubble.hide();
  }

  handleManagerNavigate(event) {
    const { annotationId, openEditor, source } = event.detail || {};
    if (annotationId) {
      this.navigateToAnnotation(annotationId, { openEditor, source });
    }
  }

  destroy() {
    clearTimeout(this.selectionCheckTimer);
    document.removeEventListener('mouseup', this.handleSelectionEvent);
    document.removeEventListener('keyup', this.handleSelectionEvent);
    document.removeEventListener('selectionchange', this.handleSelectionEvent);
    document.removeEventListener('click', this.handleDocumentClick, true);
    window.removeEventListener('scroll', this.handleViewportChange, true);
    window.removeEventListener('resize', this.handleViewportChange);
    window.removeEventListener(NAVIGATE_EVENT, this.handleManagerNavigate);

    this.registry.destroy();
    this.bubble.destroy();
    this.editor.destroy();
    this.panel.destroy();
    this.sidebar.destroy();
    this.destroyFixedButton?.();
    super.destroy();
  }
}
