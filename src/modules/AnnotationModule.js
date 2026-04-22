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
const QUICK_UPDATE_EVENT = 'cl-annotation-quick-update';

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
    this.hoverPreview = new AnnotationEditorPopover({
      readOnly: true,
      className: 'cl-annotation-hover-preview',
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
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleQuickUpdate = this.handleQuickUpdate.bind(this);
    this.hoverTimer = null;
    this.activeHoverId = null;
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
    window.addEventListener(QUICK_UPDATE_EVENT, this.handleQuickUpdate);

    await this.updateUI();
    this.checkUrlParam();

    trackEvent('perf_init', {
      module: 'annotations',
      init_ms: Math.round(performance.now() - initStart),
    });
  }

  checkUrlParam() {
    const params = new URLSearchParams(window.location.search);
    const annotationId = params.get('cl_annotation');
    if (annotationId) {
      debugLog('annotations', `Found cl_annotation param: ${annotationId}`);
      // Clear param without reload
      const url = new URL(window.location.href);
      url.searchParams.delete('cl_annotation');
      window.history.replaceState({}, '', url.toString());

      // Wait for content to stabilize then navigate
      this.waitForMessagesAndNavigate(annotationId);
    }
  }

  waitForMessagesAndNavigate(annotationId, retryCount = 0) {
    const messages = this.dom.findMessages();
    if (messages.length > 0) {
      // Small delay to ensure highlights are rendered
      setTimeout(() => {
        const success = this.navigateToAnnotation(annotationId, {
          source: 'url',
          openEditor: false,
        });
        if (!success && retryCount < 5) {
          setTimeout(() => this.waitForMessagesAndNavigate(annotationId, retryCount + 1), 500);
        }
      }, 500);
      return;
    }

    if (retryCount < 10) {
      setTimeout(() => this.waitForMessagesAndNavigate(annotationId, retryCount + 1), 500);
    }
  }

  setupSelectionListeners() {
    document.addEventListener('mousedown', event => {
      if (!isInjectedAnnotationSurface(event.target)) {
        this.bubble.hide();
      }
    });
    document.addEventListener('mouseup', event => this.handleSelectionEvent(event));
    document.addEventListener('keyup', event => this.handleSelectionEvent(event));
    document.addEventListener('click', this.handleDocumentClick, true);
    document.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('scroll', this.handleViewportChange, true);
    window.addEventListener('resize', this.handleViewportChange);
  }

  clearUIElements() {
    this.annotationStates = [];
    this.registry.clear();
    this.panel.updateAnnotations([]);
    this.updateButtonCounter(0);
    this.hoverPreview.hide();
  }

  async reinitializeUI() {
    if (!this.enabled) {
      return;
    }

    this.bubble.hide();
    this.editor.hide();
    this.hoverPreview.hide();
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

  handleSelectionEvent(event) {
    if (isInjectedAnnotationSurface(event?.target)) {
      return;
    }
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

    const id = crypto.randomUUID();
    await annotationStore.add({
      id,
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

    // Open Quick Panel instead of Popover for new annotations
    setTimeout(() => {
      this.focusAnnotationInPanel(id);
    }, 100);
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

  handleMouseMove(event) {
    if (!this.supportsHighlightRendering || isInjectedAnnotationSurface(event.target)) {
      return;
    }

    clearTimeout(this.hoverTimer);
    this.hoverTimer = setTimeout(() => {
      const annotation = findAnnotationAtPoint(event.clientX, event.clientY, this.annotationStates);

      if (annotation) {
        if (this.activeHoverId !== annotation.id && !this.panel.isVisible) {
          this.activeHoverId = annotation.id;
          const state = this.annotationStates.find(s => s.annotation.id === annotation.id);
          // Show hover preview only if there is a note
          if (state && state.annotation.note) {
            const anchorRect = getRangeRect(state.range, { x: event.clientX, y: event.clientY });
            this.hoverPreview.show({ annotation: state.annotation, anchorRect });
          }
        }
      } else {
        this.activeHoverId = null;
        this.hoverPreview.hide();
      }
    }, 150);
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
    this.hoverPreview.hide();

    // Open Quick Panel on click instead of Popover
    this.focusAnnotationInPanel(annotation.id);
  }

  focusAnnotationInPanel(annotationId) {
    if (!this.panel.isVisible) {
      this.togglePanel('click_highlight');
    }

    // Give some time for panel to render if it was just opened
    setTimeout(() => {
      const panelElement = document.getElementById('claude-annotations-panel');
      if (panelElement) {
        const item = panelElement.querySelector(`[data-annotation-id="${annotationId}"]`);
        if (item) {
          item.scrollIntoView({ behavior: 'smooth', block: 'center' });

          // Force expand the note if it's not already
          if (this.panel.expandedNotes) {
            this.panel.expandedNotes.add(annotationId);
            this.panel.updateAnnotations(this.annotationStates);
          }

          setTimeout(() => {
            const textarea = item.querySelector('textarea');
            if (textarea) {
              textarea.focus();
              // Highlight the item temporarily
              item.classList.add('ring-2', 'ring-accent-main-100');
              setTimeout(() => item.classList.remove('ring-2', 'ring-accent-main-100'), 1500);
            }
          }, 100);
        }
      }
    }, 200);
  }
  async handleQuickUpdate(event) {
    const { id, updates } = event.detail || {};
    if (id && updates) {
      await this.updateAnnotation(id, updates, 'quick_panel');
    }
  }

  openEditor(annotationId, options = {}) {
    // Keep this for backward compatibility or direct calls if needed,
    // but primary UI is now Panel
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

    // If source is panel, we don't want to re-focus the panel necessarily,
    // but if requested (like from Sidebar/Manager), we can
    if (openEditor) {
      setTimeout(() => this.focusAnnotationInPanel(annotationId), 220);
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
    this.hoverPreview.hide();
  }

  handleManagerNavigate(event) {
    const { annotationId, openEditor, source } = event.detail || {};
    if (annotationId) {
      this.navigateToAnnotation(annotationId, {
        openEditor: openEditor !== undefined ? openEditor : true,
        source,
      });
    }
  }

  destroy() {
    clearTimeout(this.selectionCheckTimer);
    clearTimeout(this.hoverTimer);
    document.removeEventListener('mouseup', this.handleSelectionEvent);
    document.removeEventListener('keyup', this.handleSelectionEvent);
    document.removeEventListener('selectionchange', this.handleSelectionEvent);
    document.removeEventListener('click', this.handleDocumentClick, true);
    document.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('scroll', this.handleViewportChange, true);
    window.removeEventListener('resize', this.handleViewportChange);
    window.removeEventListener(NAVIGATE_EVENT, this.handleManagerNavigate);
    window.removeEventListener(QUICK_UPDATE_EVENT, this.handleQuickUpdate);

    this.registry.destroy();
    this.bubble.destroy();
    this.editor.destroy();
    this.hoverPreview.destroy();
    this.panel.destroy();
    this.sidebar.destroy();
    this.destroyFixedButton?.();
    super.destroy();
  }
}
