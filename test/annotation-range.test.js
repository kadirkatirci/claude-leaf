import test from 'node:test';
import assert from 'node:assert/strict';
import { setupDom } from '../test-support/dom.js';
import {
  findAnnotationAtOffset,
  restoreAnnotation,
  serializeSelection,
} from '../src/modules/AnnotationModule/AnnotationRange.js';

function setupMessages() {
  const cleanup = setupDom(`
    <main>
      <div data-test-render-count="1">
        <div data-testid="user-message"><p>Hello <strong>annotated</strong> text</p></div>
      </div>
      <div data-test-render-count="2">
        <div class="font-claude-message"><p>Claude response with <code>code sample</code> text.</p></div>
      </div>
      <div data-test-render-count="3">
        <div class="font-claude-message"><p>Alpha target omega</p></div>
      </div>
      <div data-chat-input-container="true">
        <div data-testid="chat-input" contenteditable="true">Composer text</div>
      </div>
    </main>
  `);
  return {
    cleanup,
    messages: Array.from(document.querySelectorAll('[data-test-render-count]')),
  };
}

function findTextNode(root, text) {
  const walker = document.createTreeWalker(root, 4);
  let node = walker.nextNode();
  while (node) {
    if (node.nodeValue.includes(text)) {
      return node;
    }
    node = walker.nextNode();
  }
  throw new Error(`Text node not found: ${text}`);
}

function selectText(root, text) {
  const node = findTextNode(root, text);
  const start = node.nodeValue.indexOf(text);
  const range = document.createRange();
  range.setStart(node, start);
  range.setEnd(node, start + text.length);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
  return selection;
}

test('annotation selection serializer accepts one message and code block selections', () => {
  const { cleanup, messages } = setupMessages();

  try {
    const userSelection = selectText(messages[0], 'annotated');
    const userResult = serializeSelection(userSelection, messages);

    assert.ok(userResult);
    assert.equal(userResult.messageIndex, 0);
    assert.equal(userResult.messageSender, 'user');
    assert.equal(userResult.userMessagePreview, 'Hello annotated text');
    assert.equal(userResult.isClaudeResponse, false);
    assert.equal(userResult.selectedText, 'annotated');
    assert.deepEqual(userResult.range, { start: 6, end: 15 });

    const codeSelection = selectText(messages[1], 'code sample');
    const codeResult = serializeSelection(codeSelection, messages);

    assert.ok(codeResult);
    assert.equal(codeResult.messageIndex, 1);
    assert.equal(codeResult.messageSender, 'claude');
    assert.equal(codeResult.userMessagePreview, 'Hello annotated text');
    assert.equal(codeResult.isClaudeResponse, true);
    assert.equal(codeResult.selectedText, 'code sample');

    const paragraph = messages[0].querySelector('p');
    const paragraphRange = document.createRange();
    paragraphRange.setStart(paragraph, 0);
    paragraphRange.setEnd(paragraph, paragraph.childNodes.length);
    const paragraphSelection = window.getSelection();
    paragraphSelection.removeAllRanges();
    paragraphSelection.addRange(paragraphRange);

    const paragraphResult = serializeSelection(paragraphSelection, messages);
    assert.ok(paragraphResult);
    assert.equal(paragraphResult.selectedText, 'Hello annotated text');
    assert.deepEqual(paragraphResult.range, { start: 0, end: 20 });
  } finally {
    cleanup();
  }
});

test('annotation selection serializer rejects cross-message and composer selections', () => {
  const { cleanup, messages } = setupMessages();

  try {
    const userNode = findTextNode(messages[0], 'annotated');
    const claudeNode = findTextNode(messages[1], 'Claude');
    const crossRange = document.createRange();
    crossRange.setStart(userNode, userNode.nodeValue.indexOf('annotated'));
    crossRange.setEnd(claudeNode, claudeNode.nodeValue.indexOf('Claude') + 'Claude'.length);
    const crossSelection = window.getSelection();
    crossSelection.removeAllRanges();
    crossSelection.addRange(crossRange);

    assert.equal(serializeSelection(crossSelection, messages), null);

    const composerSelection = selectText(
      document.querySelector('[data-chat-input-container]'),
      'Composer'
    );
    assert.equal(serializeSelection(composerSelection, messages), null);
  } finally {
    cleanup();
  }
});

test('annotation selection serializer rejects injected UI selections', () => {
  const { cleanup, messages } = setupMessages();

  try {
    const injected = document.createElement('span');
    injected.className = 'cl-annotation-bubble';
    injected.textContent = 'Injected';
    messages[0].appendChild(injected);

    const selection = selectText(injected, 'Injected');
    assert.equal(serializeSelection(selection, messages), null);
  } finally {
    cleanup();
  }
});

test('annotation restore uses exact offsets, context fallback, and unresolved retention', () => {
  const { cleanup, messages } = setupMessages();

  try {
    const selection = selectText(messages[2], 'target');
    const serialized = serializeSelection(selection, messages);
    const annotation = {
      ...serialized,
      id: 'annotation-1',
      conversationUrl: '/chat/test',
      note: '',
      color: 'yellow',
      createdAt: '2026-04-11T10:00:00.000Z',
      updatedAt: '2026-04-11T10:00:00.000Z',
    };

    const exact = restoreAnnotation(annotation, messages);
    assert.equal(exact.status, 'resolved');
    assert.equal(exact.range.toString(), 'target');

    messages[2].querySelector('p').textContent = 'Intro Alpha target omega';
    const fallback = restoreAnnotation(annotation, messages);
    assert.equal(fallback.status, 'resolved');
    assert.equal(fallback.range.toString(), 'target');
    assert.deepEqual(fallback.restoredRange, { start: 12, end: 18 });

    messages[2].querySelector('p').textContent = 'No matching selection here';
    const unresolved = restoreAnnotation(annotation, messages);
    assert.equal(unresolved.status, 'unresolved');
    assert.equal(unresolved.annotation.id, annotation.id);
  } finally {
    cleanup();
  }
});

test('annotation restore re-associates version-shifted claude responses via user message preview', () => {
  const cleanup = setupDom(`
    <main>
      <div data-test-render-count="1">
        <div data-testid="user-message"><p>Question anchor prompt</p></div>
      </div>
      <div data-test-render-count="2">
        <div class="font-claude-message"><p>Alpha target omega</p></div>
      </div>
      <div data-test-render-count="3">
        <div data-testid="user-message"><p>Trailing message</p></div>
      </div>
    </main>
  `);

  try {
    const messages = Array.from(document.querySelectorAll('[data-test-render-count]'));
    const selection = selectText(messages[1], 'target');
    const serialized = serializeSelection(selection, messages);
    const annotation = {
      ...serialized,
      id: 'annotation-version-aware',
      conversationUrl: '/chat/test',
      note: '',
      color: 'yellow',
      createdAt: '2026-04-11T10:00:00.000Z',
      updatedAt: '2026-04-11T10:00:00.000Z',
    };

    const inserted = document.createElement('div');
    inserted.setAttribute('data-test-render-count', '1.5');
    inserted.innerHTML = `<div data-testid="user-message"><p>Inserted drift message</p></div>`;
    messages[0].before(inserted);

    messages[1].querySelector('p').textContent = 'Intro Alpha target omega revised';
    const driftedMessages = [inserted, messages[0], messages[1], messages[2]];
    const syncCalls = [];

    const resolved = restoreAnnotation(annotation, driftedMessages, {
      updateCallback: (annotationId, updates) => syncCalls.push({ annotationId, updates }),
    });

    assert.equal(resolved.status, 'resolved');
    assert.equal(resolved.messageIndex, 2);
    assert.equal(resolved.range.toString(), 'target');
    assert.deepEqual(resolved.restoredRange, { start: 12, end: 18 });
    assert.deepEqual(syncCalls, [
      {
        annotationId: 'annotation-version-aware',
        updates: {
          messageIndex: 2,
          contentSignature: resolved.syncUpdates.contentSignature,
          messagePreview: 'Intro Alpha target omega revised',
          range: { start: 12, end: 18 },
        },
      },
    ]);
  } finally {
    cleanup();
  }
});

test('annotation overlap hit-test returns newest matching annotation', () => {
  const older = {
    status: 'resolved',
    messageIndex: 0,
    annotation: {
      id: 'older',
      createdAt: '2026-04-11T10:00:00.000Z',
      range: { start: 0, end: 6 },
    },
  };
  const newer = {
    status: 'resolved',
    messageIndex: 0,
    annotation: {
      id: 'newer',
      createdAt: '2026-04-11T10:01:00.000Z',
      range: { start: 3, end: 10 },
    },
  };

  assert.equal(findAnnotationAtOffset([older, newer], 0, 4)?.id, 'newer');
  assert.equal(findAnnotationAtOffset([older, newer], 0, 1)?.id, 'older');
  assert.equal(findAnnotationAtOffset([older, newer], 1, 4), undefined);
});
