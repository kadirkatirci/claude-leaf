import {
  generatePreview,
  generateSignature,
  getUserMessageText,
  isUserMessage,
  resolveMarkerIndex,
} from '../../utils/MarkerUtils.js';

export const ANNOTATION_COLORS = {
  yellow: {
    label: 'Yellow',
    background: 'rgba(245, 158, 11, 0.32)',
    swatch: '#f59e0b',
  },
  blue: {
    label: 'Blue',
    background: 'rgba(14, 165, 233, 0.28)',
    swatch: '#0ea5e9',
  },
  green: {
    label: 'Green',
    background: 'rgba(34, 197, 94, 0.28)',
    swatch: '#22c55e',
  },
  red: {
    label: 'Red',
    background: 'rgba(239, 68, 68, 0.28)',
    swatch: '#ef4444',
  },
};

export const DEFAULT_ANNOTATION_COLOR = 'yellow';
export const ANNOTATION_COLOR_KEYS = Object.keys(ANNOTATION_COLORS);

const TEXT_NODE = 3;
const SHOW_TEXT = 4;
const FILTER_ACCEPT = 1;
const FILTER_REJECT = 2;
const CONTEXT_LENGTH = 32;
const MESSAGE_PREVIEW_LENGTH = 160;
const USER_MESSAGE_PREVIEW_LENGTH = 300;

const CONTENT_ROOT_SELECTORS = [
  '[data-testid="user-message"]',
  '.font-claude-message',
  '[data-testid="assistant-message"]',
  '[data-message-author="assistant"]',
].join(',');

const IGNORED_SELECTION_SURFACE_SELECTOR = [
  '[data-testid="chat-input"]',
  '[data-testid="prompt-input"]',
  '[data-chat-input-container="true"]',
  '[contenteditable="true"][role="textbox"]',
  'nav[aria-label="Sidebar"]',
  '[aria-label="Sidebar"]',
  '.cl-annotation-bubble',
  '.cl-annotation-editor',
  '.cl-annotation-panel',
  '.cl-annotation-manager-modal',
  '.cl-annotation-quick-panel',
  '[data-clp-sidebar-annotations-item="true"]',
  '#claude-annotations-fixed-btn',
  'button',
  'input',
  'textarea',
  'select',
].join(',');

const IGNORED_TEXT_NODE_SELECTOR = [
  '.cl-annotation-bubble',
  '.cl-annotation-editor',
  '.cl-annotation-panel',
  '.cl-annotation-manager-modal',
  '.cl-annotation-quick-panel',
  '.emoji-marker-btn',
  '.emoji-marker-badge',
  '.claude-bookmark-btn',
  '.bookmark-badge',
  'script',
  'style',
  'button',
  'input',
  'textarea',
  'select',
].join(',');

function getElementFromNode(node) {
  if (!node) {
    return null;
  }
  return node.nodeType === TEXT_NODE ? node.parentElement : node;
}

function containsBoundary(root, node) {
  const element = getElementFromNode(node);
  return Boolean(root && element && (element === root || root.contains(element)));
}

function isIgnoredSelectionNode(node) {
  const element = getElementFromNode(node);
  return Boolean(element?.closest?.(IGNORED_SELECTION_SURFACE_SELECTOR));
}

function isIgnoredTextNode(node) {
  const element = getElementFromNode(node);
  return Boolean(element?.closest?.(IGNORED_TEXT_NODE_SELECTOR));
}

function parseTimestamp(value) {
  const ms = Date.parse(value || '');
  return Number.isFinite(ms) ? ms : 0;
}

function uniqueElements(elements) {
  return elements.filter((element, index) => element && elements.indexOf(element) === index);
}

export function getMessageContentRoot(messageEl) {
  if (!messageEl) {
    return null;
  }
  return messageEl.matches?.(CONTENT_ROOT_SELECTORS)
    ? messageEl
    : messageEl.querySelector(CONTENT_ROOT_SELECTORS) || messageEl;
}

export function getMessageSender(messageEl) {
  return isUserMessage(messageEl) ? 'user' : 'claude';
}

function getUserMessagePreview(messageEl, messages = [], messageIndex = -1) {
  const userText = getUserMessageText(messageEl, messages, messageIndex);
  return userText.substring(0, USER_MESSAGE_PREVIEW_LENGTH).trim();
}

function normalizePreviewText(text, maxLength = USER_MESSAGE_PREVIEW_LENGTH) {
  return (text || '').toLowerCase().trim().substring(0, maxLength);
}

function buildMarkerResolutionShape(annotation) {
  return {
    id: annotation.id,
    index: annotation.messageIndex,
    contentSignature: annotation.contentSignature,
    messagePreview: annotation.messagePreview || '',
    userMessagePreview: annotation.userMessagePreview || '',
    isClaudeResponse:
      annotation.isClaudeResponse !== undefined
        ? annotation.isClaudeResponse
        : annotation.messageSender === 'claude',
  };
}

function buildResolvedSyncUpdates(
  annotation,
  messageEl,
  messageIndex,
  restoredRange,
  messages = []
) {
  const updates = {};
  const nextSignature = generateSignature(messageEl);
  const nextPreview = generatePreview(messageEl, MESSAGE_PREVIEW_LENGTH);
  const nextSender = getMessageSender(messageEl);
  const nextIsClaudeResponse = nextSender === 'claude';
  const nextUserMessagePreview = getUserMessagePreview(messageEl, messages, messageIndex);

  if (annotation.messageIndex !== messageIndex) {
    updates.messageIndex = messageIndex;
  }
  if (annotation.contentSignature !== nextSignature) {
    updates.contentSignature = nextSignature;
  }
  if ((annotation.messagePreview || '') !== nextPreview) {
    updates.messagePreview = nextPreview;
  }
  if ((annotation.userMessagePreview || '') !== nextUserMessagePreview) {
    updates.userMessagePreview = nextUserMessagePreview;
  }
  if ((annotation.messageSender || '') !== nextSender) {
    updates.messageSender = nextSender;
  }
  if (
    (annotation.isClaudeResponse ?? annotation.messageSender === 'claude') !== nextIsClaudeResponse
  ) {
    updates.isClaudeResponse = nextIsClaudeResponse;
  }
  if (
    annotation.range?.start !== restoredRange.start ||
    annotation.range?.end !== restoredRange.end
  ) {
    updates.range = restoredRange;
  }

  return updates;
}

function findClaudeResponseCandidateByUserPreview(annotation, messages = []) {
  const isClaudeResponse =
    annotation.isClaudeResponse !== undefined
      ? annotation.isClaudeResponse
      : annotation.messageSender === 'claude';
  const normalizedUserPreview = normalizePreviewText(annotation.userMessagePreview);
  if (!isClaudeResponse || !normalizedUserPreview) {
    return null;
  }

  const candidates = messages
    .map((messageElement, messageIndex) => ({ messageElement, messageIndex }))
    .filter(({ messageElement }) => !isUserMessage(messageElement))
    .filter(
      ({ messageElement, messageIndex }) =>
        normalizePreviewText(getUserMessagePreview(messageElement, messages, messageIndex)) ===
        normalizedUserPreview
    )
    .sort(
      (left, right) =>
        Math.abs(left.messageIndex - (annotation.messageIndex || 0)) -
        Math.abs(right.messageIndex - (annotation.messageIndex || 0))
    );

  return candidates[0]?.messageElement || null;
}

export function getMessageForNode(node, messages = []) {
  const element = getElementFromNode(node);
  if (!element) {
    return null;
  }
  return messages.find(message => message === element || message.contains(element)) || null;
}

export function collectTextNodes(root) {
  if (!root) {
    return [];
  }

  const nodes = [];
  const walker = document.createTreeWalker(root, SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue || isIgnoredTextNode(node)) {
        return FILTER_REJECT;
      }
      return FILTER_ACCEPT;
    },
  });

  let node = walker.nextNode();
  while (node) {
    nodes.push(node);
    node = walker.nextNode();
  }
  return nodes;
}

export function getTextContent(root) {
  return collectTextNodes(root)
    .map(node => node.nodeValue || '')
    .join('');
}

export function getBoundaryOffset(root, container, offset) {
  if (!root || !container || !containsBoundary(root, container)) {
    return null;
  }

  if (container.nodeType === TEXT_NODE) {
    let position = 0;
    for (const node of collectTextNodes(root)) {
      if (node === container) {
        return position + offset;
      }
      position += (node.nodeValue || '').length;
    }
    return null;
  }

  const boundaryRange = document.createRange();
  try {
    boundaryRange.setStart(container, offset);
    boundaryRange.collapse(true);
  } catch {
    return null;
  }

  let position = 0;
  const RangeCtor = globalThis.Range || globalThis.window?.Range;
  for (const node of collectTextNodes(root)) {
    const nodeRange = document.createRange();
    nodeRange.selectNodeContents(node);
    if (nodeRange.compareBoundaryPoints(RangeCtor.END_TO_START, boundaryRange) <= 0) {
      position += (node.nodeValue || '').length;
      continue;
    }
    break;
  }

  return position;
}

export function createRangeFromOffsets(root, start, end) {
  if (!root || !Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start) {
    return null;
  }

  const textNodes = collectTextNodes(root);
  let position = 0;
  let startSet = false;
  let endSet = false;
  const range = document.createRange();

  for (const node of textNodes) {
    const text = node.nodeValue || '';
    const nextPosition = position + text.length;

    if (!startSet && start <= nextPosition) {
      range.setStart(node, Math.max(0, start - position));
      startSet = true;
    }

    if (!endSet && end <= nextPosition) {
      range.setEnd(node, Math.max(0, end - position));
      endSet = true;
      break;
    }

    position = nextPosition;
  }

  return startSet && endSet ? range : null;
}

export function buildSelectionContext(root, start, end, contextLength = CONTEXT_LENGTH) {
  const text = getTextContent(root);
  return {
    prefix: text.slice(Math.max(0, start - contextLength), start),
    suffix: text.slice(end, end + contextLength),
  };
}

export function serializeSelection(selection, messages = []) {
  if (!selection || selection.rangeCount === 0) {
    return null;
  }

  const range = selection.getRangeAt(0);
  if (!range || range.collapsed) {
    return null;
  }

  if (
    isIgnoredSelectionNode(range.startContainer) ||
    isIgnoredSelectionNode(range.endContainer) ||
    isIgnoredSelectionNode(range.commonAncestorContainer)
  ) {
    return null;
  }

  const startMessage = getMessageForNode(range.startContainer, messages);
  const endMessage = getMessageForNode(range.endContainer, messages);
  if (!startMessage || startMessage !== endMessage) {
    return null;
  }

  const contentRoot = getMessageContentRoot(startMessage);
  if (
    !contentRoot ||
    !containsBoundary(contentRoot, range.startContainer) ||
    !containsBoundary(contentRoot, range.endContainer)
  ) {
    return null;
  }

  const selectedText = range.toString();
  if (!selectedText.trim()) {
    return null;
  }

  const start = getBoundaryOffset(contentRoot, range.startContainer, range.startOffset);
  const end = getBoundaryOffset(contentRoot, range.endContainer, range.endOffset);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return null;
  }

  const messageIndex = messages.indexOf(startMessage);
  return {
    messageElement: startMessage,
    contentRoot,
    messageIndex,
    messageSender: getMessageSender(startMessage),
    contentSignature: generateSignature(startMessage),
    messagePreview: generatePreview(startMessage, MESSAGE_PREVIEW_LENGTH),
    userMessagePreview: getUserMessagePreview(startMessage, messages, messageIndex),
    isClaudeResponse: !isUserMessage(startMessage),
    selectedText,
    range: { start, end },
    context: buildSelectionContext(contentRoot, start, end),
  };
}

function resolveAtExactOffset(annotation, messageEl, messageIndex, messages = []) {
  const contentRoot = getMessageContentRoot(messageEl);
  const range = createRangeFromOffsets(contentRoot, annotation.range?.start, annotation.range?.end);
  if (!range || range.toString() !== annotation.selectedText) {
    return null;
  }

  const restoredRange = {
    start: annotation.range.start,
    end: annotation.range.end,
  };

  return {
    status: 'resolved',
    annotation,
    messageElement: messageEl,
    messageIndex,
    contentRoot,
    range,
    restoredRange,
    syncUpdates: buildResolvedSyncUpdates(
      annotation,
      messageEl,
      messageIndex,
      restoredRange,
      messages
    ),
  };
}

function findWithContext(annotation, messageEl, messageIndex, messages = []) {
  if (!annotation.selectedText || !annotation.context) {
    return null;
  }

  const contentRoot = getMessageContentRoot(messageEl);
  const fullText = getTextContent(contentRoot);
  const prefix = annotation.context.prefix || '';
  const suffix = annotation.context.suffix || '';

  let start = fullText.indexOf(annotation.selectedText);
  while (start !== -1) {
    const end = start + annotation.selectedText.length;
    const currentPrefix = fullText.slice(Math.max(0, start - prefix.length), start);
    const currentSuffix = fullText.slice(end, end + suffix.length);

    if (currentPrefix === prefix && currentSuffix === suffix) {
      const range = createRangeFromOffsets(contentRoot, start, end);
      if (range) {
        return {
          status: 'resolved',
          annotation,
          messageElement: messageEl,
          messageIndex,
          contentRoot,
          range,
          restoredRange: { start, end },
          syncUpdates: buildResolvedSyncUpdates(
            annotation,
            messageEl,
            messageIndex,
            { start, end },
            messages
          ),
        };
      }
    }

    start = fullText.indexOf(annotation.selectedText, start + 1);
  }

  return null;
}

export function restoreAnnotation(annotation, messages = [], options = {}) {
  const { updateCallback = null } = options;
  if (!annotation || !Array.isArray(messages) || messages.length === 0) {
    return { status: 'unresolved', annotation };
  }

  const markerResolution = resolveMarkerIndex(buildMarkerResolutionShape(annotation), messages, {
    strictMode: false,
  });
  const markerCandidate =
    markerResolution.index !== null && markerResolution.index !== undefined
      ? messages[markerResolution.index]
      : null;
  const claudeResponseCandidate = findClaudeResponseCandidateByUserPreview(annotation, messages);

  const signatureMatches = messages
    .map((messageElement, messageIndex) => ({ messageElement, messageIndex }))
    .filter(
      ({ messageElement }) => generateSignature(messageElement) === annotation.contentSignature
    );

  const exactCandidates = uniqueElements([
    markerCandidate,
    claudeResponseCandidate,
    messages[annotation.messageIndex],
    ...signatureMatches.map(match => match.messageElement),
  ]);

  for (const messageElement of exactCandidates) {
    const messageIndex = messages.indexOf(messageElement);
    if (generateSignature(messageElement) !== annotation.contentSignature) {
      continue;
    }

    const resolved = resolveAtExactOffset(annotation, messageElement, messageIndex, messages);
    if (resolved) {
      if (updateCallback && Object.keys(resolved.syncUpdates || {}).length > 0) {
        updateCallback(annotation.id, resolved.syncUpdates);
      }
      return resolved;
    }
  }

  const fallbackCandidates = uniqueElements([
    markerCandidate,
    claudeResponseCandidate,
    messages[annotation.messageIndex],
    ...signatureMatches.map(match => match.messageElement),
  ]);

  for (const messageElement of fallbackCandidates) {
    const messageIndex = messages.indexOf(messageElement);
    const resolved = findWithContext(annotation, messageElement, messageIndex, messages);
    if (resolved) {
      if (updateCallback && Object.keys(resolved.syncUpdates || {}).length > 0) {
        updateCallback(annotation.id, resolved.syncUpdates);
      }
      return resolved;
    }
  }

  return { status: 'unresolved', annotation };
}

export function findAnnotationAtOffset(states = [], messageIndex, offset) {
  return states
    .filter(state => {
      const range = state.restoredRange || state.annotation?.range;
      return (
        state.status === 'resolved' &&
        state.messageIndex === messageIndex &&
        range &&
        offset >= range.start &&
        offset < range.end
      );
    })
    .sort((a, b) => {
      const aTime =
        parseTimestamp(a.annotation?.createdAt) || parseTimestamp(a.annotation?.updatedAt);
      const bTime =
        parseTimestamp(b.annotation?.createdAt) || parseTimestamp(b.annotation?.updatedAt);
      return bTime - aTime;
    })[0]?.annotation;
}

export function getCaretRangeFromPoint(x, y) {
  if (document.caretRangeFromPoint) {
    return document.caretRangeFromPoint(x, y);
  }

  if (document.caretPositionFromPoint) {
    const position = document.caretPositionFromPoint(x, y);
    if (!position?.offsetNode) {
      return null;
    }
    const range = document.createRange();
    range.setStart(position.offsetNode, position.offset);
    range.collapse(true);
    return range;
  }

  return null;
}

export function findAnnotationAtPoint(x, y, states = []) {
  const caretRange = getCaretRangeFromPoint(x, y);
  if (!caretRange) {
    return null;
  }

  const state = states.find(candidate => {
    return (
      candidate.status === 'resolved' &&
      containsBoundary(candidate.contentRoot, caretRange.startContainer)
    );
  });
  if (!state) {
    return null;
  }

  const offset = getBoundaryOffset(
    state.contentRoot,
    caretRange.startContainer,
    caretRange.startOffset
  );
  if (!Number.isFinite(offset)) {
    return null;
  }

  return findAnnotationAtOffset(states, state.messageIndex, offset);
}

export function clampRectToViewport(rect, width = 220, height = 42, margin = 8) {
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 1024;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 768;
  return {
    left: Math.min(
      Math.max(rect.left + rect.width / 2 - width / 2, margin),
      viewportWidth - width - margin
    ),
    top: Math.min(Math.max(rect.top - height - 8, margin), viewportHeight - height - margin),
  };
}
