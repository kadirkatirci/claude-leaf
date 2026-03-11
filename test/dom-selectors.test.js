import test from 'node:test';
import assert from 'node:assert/strict';
import { setupDom } from '../test-support/dom.js';

async function loadSelectorModules() {
  const [
    { default: DOMUtilsCore },
    { default: DOMUtilsParsing },
    { default: MessageHub },
    markerUtils,
    { default: navigationInterceptor },
  ] = await Promise.all([
    import('../src/utils/DOMUtils-Core.js'),
    import('../src/utils/DOMUtils-Parsing.js'),
    import('../src/core/MessageHub.js'),
    import('../src/utils/MarkerUtils.js'),
    import('../src/core/NavigationInterceptor.js'),
  ]);

  return {
    DOMUtilsCore,
    DOMUtilsParsing,
    MessageHub,
    getCleanMessageText: markerUtils.getCleanMessageText,
    getUserMessageElement: markerUtils.getUserMessageElement,
    navigationInterceptor,
  };
}

test('findVersionSpan prefers the version nav container and falls back to generic span scan', async () => {
  const cleanup = setupDom(`
    <div id="container">
      <div class="inline-flex items-center gap-1">
        <span>2 / 4</span>
      </div>
      <span>9 / 9</span>
    </div>
    <div id="fallback">
      <span>1 / 3</span>
    </div>
  `);
  let navigationInterceptor;

  try {
    const { DOMUtilsParsing, navigationInterceptor: loadedInterceptor } =
      await loadSelectorModules();
    navigationInterceptor = loadedInterceptor;
    const container = document.getElementById('container');
    const fallback = document.getElementById('fallback');

    assert.equal(DOMUtilsParsing.findVersionSpan(container)?.textContent.trim(), '2 / 4');
    assert.equal(DOMUtilsParsing.findVersionSpan(fallback)?.textContent.trim(), '1 / 3');
  } finally {
    navigationInterceptor?.destroy();
    cleanup();
  }
});

test('getEditedPrompts keeps current selector logic for user messages, version detection, and retry button lookup', async () => {
  const cleanup = setupDom(`
    <main>
      <div data-testid="conversation-turn-1">
        <div data-testid="user-message">Prompt A</div>
        <div class="inline-flex items-center gap-1"><span>2 / 2</span></div>
        <button type="button">
          <svg><path d="M10.3857 10.3857"/></svg>
        </button>
      </div>
      <div data-testid="conversation-turn-2">
        <div data-testid="user-message">Prompt B</div>
        <div class="inline-flex items-center gap-1"><span>1 / 1</span></div>
      </div>
    </main>
  `);
  const { DOMUtilsCore, DOMUtilsParsing, navigationInterceptor } = await loadSelectorModules();
  const originalIsOnConversationPage = DOMUtilsCore.isOnConversationPage;
  const originalFindActualMessages = DOMUtilsCore.findActualMessages;

  try {
    DOMUtilsCore.isOnConversationPage = () => true;
    DOMUtilsCore.findActualMessages = () =>
      Array.from(document.querySelectorAll('[data-testid^="conversation-turn-"]'));

    const editedPrompts = DOMUtilsParsing.getEditedPrompts();

    assert.equal(editedPrompts.length, 1);
    assert.equal(editedPrompts[0].versionInfo, '2 / 2');
    assert.equal(editedPrompts[0].containerId, 'edit-index-0');
    assert.ok(editedPrompts[0].editButton);
  } finally {
    navigationInterceptor.destroy();
    DOMUtilsCore.isOnConversationPage = originalIsOnConversationPage;
    DOMUtilsCore.findActualMessages = originalFindActualMessages;
    cleanup();
  }
});

test('MarkerUtils keeps message text extraction and previous user-message fallback behavior', async () => {
  const cleanup = setupDom(`
    <div id="user-container">
      <div data-testid="user-message">
        <span>User prompt</span>
        <button>Ignored</button>
      </div>
    </div>
    <div id="assistant-container">
      <div class="font-claude-message">
        <span>Assistant answer</span>
        <button>Ignored</button>
      </div>
    </div>
    <div id="assistant-followup">
      <div class="font-claude-message">
        <span>Follow-up answer</span>
      </div>
    </div>
  `);
  let navigationInterceptor;

  try {
    const {
      getCleanMessageText,
      getUserMessageElement,
      navigationInterceptor: loadedInterceptor,
    } = await loadSelectorModules();
    navigationInterceptor = loadedInterceptor;
    const userContainer = document.getElementById('user-container');
    const assistantContainer = document.getElementById('assistant-container');
    const assistantFollowup = document.getElementById('assistant-followup');

    assert.equal(getCleanMessageText(userContainer), 'User prompt');
    assert.equal(getCleanMessageText(assistantContainer), 'Assistant answer');

    const messages = [userContainer, assistantContainer, assistantFollowup];
    const { element, index } = getUserMessageElement(assistantFollowup, messages, 2);
    assert.equal(element?.getAttribute('data-testid'), 'user-message');
    assert.equal(element?.textContent.replace(/\s+/g, ' ').trim(), 'User prompt Ignored');
    assert.equal(index, 0);
  } finally {
    navigationInterceptor?.destroy();
    cleanup();
  }
});

test('MessageHub version scan ignores spans inside the user-message body', async () => {
  const cleanup = setupDom(`
    <div id="message">
      <div data-testid="user-message">
        <span>3 / 7</span>
      </div>
      <div class="inline-flex items-center gap-1">
        <span>2 / 3</span>
      </div>
    </div>
  `);
  let navigationInterceptor;

  try {
    const { MessageHub, navigationInterceptor: loadedInterceptor } = await loadSelectorModules();
    navigationInterceptor = loadedInterceptor;
    const message = document.getElementById('message');
    assert.equal(MessageHub.getVersionInfoFromMessage(message), '2 / 3');
  } finally {
    navigationInterceptor?.destroy();
    cleanup();
  }
});
