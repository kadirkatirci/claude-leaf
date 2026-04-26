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
const DATA_CHANGED_EVENT = 'cl-annotations-data-changed';
const TEXT_NODE = 3;

function getElementFromNode(node) {
  if (!node) {
    return null;
  }
  return node.nodeType === TEXT_NODE ? node.parentElement : node;
}

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

function getRangeScrollRect(range) {
  const rect = range?.getBoundingClientRect?.();
  if (rect && (rect.width || rect.height)) {
    return rect;
  }

  const firstRect = Array.from(range?.getClientRects?.() || []).find(
    candidate => candidate?.width || candidate?.height
  );
  return firstRect || null;
}

function isScrollableElement(element) {
  if (!element || element === document.body || element === document.documentElement) {
    return false;
  }

  const style = window.getComputedStyle(element);
  const overflowY = style.overflowY || style.overflow;
  return /(auto|scroll|overlay)/.test(overflowY) && element.scrollHeight > element.clientHeight;
}

function findScrollContainer(element) {
  let current = element?.parentElement || null;
  while (current && current !== document.body && current !== document.documentElement) {
    if (isScrollableElement(current)) {
      return current;
    }
    current = current.parentElement;
  }

  return document.scrollingElement || document.documentElement;
}

function scrollElementTo(element, top) {
  const targetTop = Math.max(0, top);
  if (typeof element.scrollTo === 'function') {
    element.scrollTo({ top: targetTop, behavior: 'smooth' });
    return;
  }
  element.scrollTop = targetTop;
}

function scrollWindowTo(top) {
  const targetTop = Math.max(0, top);
  if (typeof window.scrollTo === 'function') {
    window.scrollTo({ top: targetTop, behavior: 'smooth' });
    return;
  }

  const scrollingElement = document.scrollingElement || document.documentElement;
  scrollingElement.scrollTop = targetTop;
}

function isInjectedAnnotationSurface(target) {
  return Boolean(
    target?.closest?.(
      '.cl-annotation-bubble, .cl-annotation-editor, .cl-annotation-panel, .cl-annotation-manager-modal, .cl-annotation-quick-panel, #claude-annotations-panel, #claude-annotations-fixed-btn, [data-clp-sidebar-annotations-item="true"]'
    )
  );
}

function areValuesEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
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
    this.managedTimers = new Set();
    this.supportsHighlightRendering = false;

    this.handleDocumentClick = this.handleDocumentClick.bind(this);
    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleSelectionEvent = this.handleSelectionEvent.bind(this);
    this.handleViewportChange = this.handleViewportChange.bind(this);
    this.handleManagerNavigate = this.handleManagerNavigate.bind(this);
    this.handleDataChanged = this.handleDataChanged.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleQuickUpdate = this.handleQuickUpdate.bind(this);
    this.hoverTimer = null;
    this.activeHoverId = null;
  }

  setManagedTimeout(callback, delay) {
    const timer = setTimeout(() => {
      this.managedTimers.delete(timer);
      if (!this.enabled) {
        return;
      }
      callback();
    }, delay);
    this.managedTimers.add(timer);
    return timer;
  }

  clearManagedTimers() {
    this.managedTimers.forEach(timer => clearTimeout(timer));
    this.managedTimers.clear();
    this.selectionCheckTimer = null;
    this.hoverTimer = null;
  }

  clearManagedTimer(timer) {
    if (!timer) {
      return;
    }
    clearTimeout(timer);
    this.managedTimers.delete(timer);
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
    this.subscribe(Events.HUB_VERSION_CHANGED, async () => {
      await this.waitAndUpdateUI();
    });
    window.addEventListener(NAVIGATE_EVENT, this.handleManagerNavigate);
    window.addEventListener(QUICK_UPDATE_EVENT, this.handleQuickUpdate);
    window.addEventListener(DATA_CHANGED_EVENT, this.handleDataChanged);

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
      this.setManagedTimeout(() => {
        const success = this.navigateToAnnotation(annotationId, {
          source: 'url',
          openEditor: false,
        });
        if (!success && retryCount < 5) {
          this.waitForMessagesAndNavigate(annotationId, retryCount + 1);
        }
      }, 500);
      return;
    }

    if (retryCount < 10) {
      this.setManagedTimeout(
        () => this.waitForMessagesAndNavigate(annotationId, retryCount + 1),
        500
      );
    }
  }

  setupSelectionListeners() {
    document.addEventListener('mousedown', this.handleMouseDown);
    document.addEventListener('mouseup', this.handleSelectionEvent);
    document.addEventListener('keyup', this.handleSelectionEvent);
    document.addEventListener('selectionchange', this.handleSelectionEvent);
    document.addEventListener('click', this.handleDocumentClick, true);
    document.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('scroll', this.handleViewportChange, true);
    window.addEventListener('resize', this.handleViewportChange);
  }

  handleMouseDown(event) {
    if (!isInjectedAnnotationSurface(event.target)) {
      this.bubble.hide();
    }
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

  getVisibleAnnotationStates(states = this.annotationStates) {
    return (states || []).filter(state => state?.status === 'resolved');
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
    const pendingSyncUpdates = new Map();
    this.annotationStates = annotations.map(annotation =>
      restoreAnnotation(annotation, messages, {
        updateCallback: (_annotationId, updates) => {
          if (!updates || Object.keys(updates).length === 0) {
            return;
          }
          pendingSyncUpdates.set(annotation.id, {
            ...(pendingSyncUpdates.get(annotation.id) || {}),
            ...updates,
          });
        },
      })
    );

    if (this.supportsHighlightRendering) {
      this.registry.render(this.annotationStates);
    }

    const visibleAnnotationStates = this.getVisibleAnnotationStates();
    this.updateButtonCounter(visibleAnnotationStates.length);
    this.panel.updateAnnotations(visibleAnnotationStates);

    if (pendingSyncUpdates.size > 0) {
      void this.syncResolvedAnnotationMetadata(annotations, pendingSyncUpdates);
    }
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
    if (!this.enabled) {
      return;
    }
    if (isInjectedAnnotationSurface(event?.target)) {
      return;
    }
    this.clearManagedTimer(this.selectionCheckTimer);
    this.selectionCheckTimer = this.setManagedTimeout(() => {
      this.selectionCheckTimer = null;
      this.evaluateSelection();
    }, 80);
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
      userMessagePreview: selectionData.userMessagePreview,
      isClaudeResponse: selectionData.isClaudeResponse,
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
    this.setManagedTimeout(() => {
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

  async syncResolvedAnnotationMetadata(annotations, pendingSyncUpdates) {
    const annotationsById = new Map(annotations.map(annotation => [annotation.id, annotation]));

    for (const [annotationId, updates] of pendingSyncUpdates.entries()) {
      const existing = annotationsById.get(annotationId);
      if (!existing) {
        continue;
      }

      const changedUpdates = Object.fromEntries(
        Object.entries(updates).filter(([key, value]) => !areValuesEqual(existing[key], value))
      );
      if (Object.keys(changedUpdates).length === 0) {
        continue;
      }

      await annotationStore.update(annotationId, changedUpdates);
    }
  }

  handleMouseMove(event) {
    if (!this.supportsHighlightRendering || isInjectedAnnotationSurface(event.target)) {
      return;
    }

    this.clearManagedTimer(this.hoverTimer);
    this.hoverTimer = this.setManagedTimeout(() => {
      this.hoverTimer = null;
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
    this.setManagedTimeout(() => {
      const panelElement = document.getElementById('claude-annotations-panel');
      if (panelElement) {
        const item = panelElement.querySelector(`[data-annotation-id="${annotationId}"]`);
        if (item) {
          item.scrollIntoView?.({ behavior: 'smooth', block: 'center' });

          // Force expand the note if it's not already
          if (this.panel.expandedNotes) {
            this.panel.expandedNotes.add(annotationId);
            this.panel.updateAnnotations(this.getVisibleAnnotationStates());
          }

          this.setManagedTimeout(() => {
            const textarea = item.querySelector('textarea');
            if (textarea) {
              textarea.focus();
              // Highlight the item temporarily
              item.classList.add('ring-2', 'ring-accent-main-100');
              this.setManagedTimeout(() => {
                if (item.isConnected) {
                  item.classList.remove('ring-2', 'ring-accent-main-100');
                }
              }, 1500);
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

  async handleDataChanged() {
    if (this.enabled) {
      await this.updateUI();
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

  scrollAnnotationRangeIntoView(state) {
    const rect = getRangeScrollRect(state?.range);
    const anchorElement = getElementFromNode(state?.range?.startContainer);
    if (!rect || !anchorElement) {
      return false;
    }

    const scrollContainer = findScrollContainer(anchorElement);
    if (
      scrollContainer === document.scrollingElement ||
      scrollContainer === document.documentElement ||
      scrollContainer === document.body
    ) {
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 800;
      const currentTop =
        window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
      const targetTop = currentTop + rect.top - (viewportHeight - rect.height) / 2;
      scrollWindowTo(targetTop);
      return true;
    }

    const containerRect = scrollContainer.getBoundingClientRect();
    const targetTop =
      scrollContainer.scrollTop +
      rect.top -
      containerRect.top -
      (scrollContainer.clientHeight - rect.height) / 2;
    scrollElementTo(scrollContainer, targetTop);
    return true;
  }

  navigateToAnnotation(annotationId, { openEditor = false, source = 'panel' } = {}) {
    const state = this.annotationStates.find(item => item.annotation.id === annotationId);
    if (!state || state.status !== 'resolved') {
      return false;
    }

    if (!this.scrollAnnotationRangeIntoView(state)) {
      this.dom.scrollToElement(state.messageElement, 'center');
    }
    trackEvent('annotation_navigate', {
      module: 'annotations',
      method: source,
    });

    // If source is panel, we don't want to re-focus the panel necessarily,
    // but if requested (like from Sidebar/Manager), we can
    if (openEditor) {
      this.setManagedTimeout(() => this.focusAnnotationInPanel(annotationId), 220);
    }
    return true;
  }

  togglePanel(method = 'button') {
    const isVisible = this.panel.toggle();
    trackEvent('annotation_quick_panel_toggle', {
      module: 'annotations',
      method,
      state: isVisible ? 'open' : 'close',
      annotation_count: this.getVisibleAnnotationStates().length,
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
    this.clearManagedTimer(this.selectionCheckTimer);
    this.clearManagedTimer(this.hoverTimer);
    this.clearManagedTimers();
    document.removeEventListener('mousedown', this.handleMouseDown);
    document.removeEventListener('mouseup', this.handleSelectionEvent);
    document.removeEventListener('keyup', this.handleSelectionEvent);
    document.removeEventListener('selectionchange', this.handleSelectionEvent);
    document.removeEventListener('click', this.handleDocumentClick, true);
    document.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('scroll', this.handleViewportChange, true);
    window.removeEventListener('resize', this.handleViewportChange);
    window.removeEventListener(NAVIGATE_EVENT, this.handleManagerNavigate);
    window.removeEventListener(QUICK_UPDATE_EVENT, this.handleQuickUpdate);
    window.removeEventListener(DATA_CHANGED_EVENT, this.handleDataChanged);

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
