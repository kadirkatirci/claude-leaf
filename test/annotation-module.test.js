import test from 'node:test';
import assert from 'node:assert/strict';
import { setupDom } from '../test-support/dom.js';

function createMessageDom() {
  return `
    <nav aria-label="Sidebar">
      <div class="flex flex-col px-2 pt-4 gap-px">
        <div class="relative group">
          <a href="/recents" data-dd-action-name="sidebar-nav-item" class="native-sidebar-item">
            <div class="w-full flex flex-row items-center justify-start gap-3">
              <div><svg></svg></div>
              <span class="truncate text-sm whitespace-nowrap flex-1">
                <div class="opacity-0 transition-opacity ease-out duration-150"><span>Chats</span></div>
              </span>
            </div>
          </a>
        </div>
      </div>
    </nav>
    <main>
      <div data-test-render-count="1">
        <div data-testid="user-message"><p>Hello annotated text</p></div>
      </div>
      <div data-test-render-count="2">
        <div class="font-claude-message"><p>Claude response text</p></div>
      </div>
    </main>
  `;
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
  window.getSelection().removeAllRanges();
  window.getSelection().addRange(range);
  return { node, range };
}

async function setupAnnotationEnvironment() {
  const cleanupDom = setupDom(createMessageDom());
  window.history.replaceState({}, '', '/chat/test-thread');
  window.__navigationInterceptor = {
    getState: () => ({
      isConversationPage: true,
      path: '/chat/test-thread',
      pageType: 'conversation',
    }),
    onNavigate: () => () => {},
  };

  const originalChrome = globalThis.chrome;
  const originalCss = globalThis.CSS;
  const originalHighlight = globalThis.Highlight;
  const originalRequestAnimationFrame = globalThis.requestAnimationFrame;

  const analyticsMessages = [];
  globalThis.chrome = {
    runtime: {
      lastError: null,
      sendMessage(message, callback) {
        analyticsMessages.push(message);
        callback?.({});
      },
    },
  };
  globalThis.requestAnimationFrame = callback => window.setTimeout(callback, 0);

  class FakeHighlight {
    constructor(...ranges) {
      this.ranges = ranges;
      this.priority = 0;
    }
  }

  const highlights = new Map();
  globalThis.CSS = { highlights };
  globalThis.Highlight = FakeHighlight;

  const [
    { default: BaseModule },
    { default: DOMUtils },
    { default: VisibilityManager },
    { default: navigationInterceptor },
    { annotationStore },
    { storeSyncChannel },
    { default: AnnotationModule },
  ] = await Promise.all([
    import('../src/modules/BaseModule.js'),
    import('../src/utils/DOMUtils.js'),
    import('../src/utils/VisibilityManager.js'),
    import('../src/core/NavigationInterceptor.js'),
    import('../src/stores/index.js'),
    import('../src/utils/StoreSyncChannel.js'),
    import('../src/modules/AnnotationModule.js'),
  ]);

  const messages = Array.from(document.querySelectorAll('[data-test-render-count]'));
  const storedAnnotations = [];
  let removedId = null;
  const scrolled = [];

  const originals = {
    baseInit: BaseModule.prototype.init,
    baseGetSetting: BaseModule.prototype.getSetting,
    domIsOnConversationPage: DOMUtils.isOnConversationPage,
    domFindMessages: DOMUtils.findMessages,
    domScrollToElement: DOMUtils.scrollToElement,
    visibilityIsOnConversationPage: VisibilityManager.isOnConversationPage,
    visibilityOnVisibilityChange: VisibilityManager.onVisibilityChange,
    navigationOnNavigate: navigationInterceptor.onNavigate,
    storeGetByConversation: annotationStore.getByConversation,
    storeGetById: annotationStore.getById,
    storeAdd: annotationStore.add,
    storeUpdate: annotationStore.update,
    storeRemove: annotationStore.remove,
  };

  BaseModule.prototype.init = function initStub() {
    this.enabled = true;
    this.initialized = true;
    this.unsubscribers = [];
    this.settings = { annotations: { enabled: true, showFloatingUI: true } };
  };
  BaseModule.prototype.getSetting = () => Promise.resolve(0.7);
  DOMUtils.isOnConversationPage = () => true;
  DOMUtils.findMessages = () => messages;
  DOMUtils.scrollToElement = element => scrolled.push(element);
  VisibilityManager.isOnConversationPage = () => true;
  VisibilityManager.onVisibilityChange = callback => {
    callback(true);
    return () => {};
  };
  navigationInterceptor.onNavigate = () => () => {};

  annotationStore.getByConversation = () => Promise.resolve([...storedAnnotations]);
  annotationStore.getById = id => Promise.resolve(storedAnnotations.find(item => item.id === id));
  annotationStore.add = annotation => {
    const stored = {
      ...annotation,
      id: annotation.id || `annotation-${storedAnnotations.length + 1}`,
      createdAt: annotation.createdAt || new Date(storedAnnotations.length + 1).toISOString(),
      updatedAt: annotation.updatedAt || new Date(storedAnnotations.length + 1).toISOString(),
    };
    storedAnnotations.push(stored);
    return Promise.resolve(stored.id);
  };
  annotationStore.update = (id, updates) => {
    const index = storedAnnotations.findIndex(item => item.id === id);
    if (index !== -1) {
      storedAnnotations[index] = {
        ...storedAnnotations[index],
        ...updates,
        updatedAt: new Date().toISOString(),
      };
    }
    return Promise.resolve();
  };
  annotationStore.remove = id => {
    removedId = id;
    const index = storedAnnotations.findIndex(item => item.id === id);
    if (index !== -1) {
      storedAnnotations.splice(index, 1);
    }
    return Promise.resolve();
  };

  const module = new AnnotationModule();

  return {
    module,
    messages,
    storedAnnotations,
    highlights,
    analyticsMessages,
    scrolled,
    get removedId() {
      return removedId;
    },
    cleanup() {
      module.destroy();
      BaseModule.prototype.init = originals.baseInit;
      BaseModule.prototype.getSetting = originals.baseGetSetting;
      DOMUtils.isOnConversationPage = originals.domIsOnConversationPage;
      DOMUtils.findMessages = originals.domFindMessages;
      DOMUtils.scrollToElement = originals.domScrollToElement;
      VisibilityManager.isOnConversationPage = originals.visibilityIsOnConversationPage;
      VisibilityManager.onVisibilityChange = originals.visibilityOnVisibilityChange;
      navigationInterceptor.onNavigate = originals.navigationOnNavigate;
      annotationStore.getByConversation = originals.storeGetByConversation;
      annotationStore.getById = originals.storeGetById;
      annotationStore.add = originals.storeAdd;
      annotationStore.update = originals.storeUpdate;
      annotationStore.remove = originals.storeRemove;
      storeSyncChannel.destroy();
      VisibilityManager.destroy();
      navigationInterceptor.destroy();
      document
        .querySelectorAll('.cl-annotation-manager-modal')
        .forEach(element => element.remove());

      if (originalChrome === undefined) {
        delete globalThis.chrome;
      } else {
        globalThis.chrome = originalChrome;
      }
      if (originalCss === undefined) {
        delete globalThis.CSS;
      } else {
        globalThis.CSS = originalCss;
      }
      if (originalHighlight === undefined) {
        delete globalThis.Highlight;
      } else {
        globalThis.Highlight = originalHighlight;
      }
      if (originalRequestAnimationFrame === undefined) {
        delete globalThis.requestAnimationFrame;
      } else {
        globalThis.requestAnimationFrame = originalRequestAnimationFrame;
      }
      cleanupDom();
    },
  };
}

test('annotation module creates highlights from valid selections and renders quick panel', async () => {
  const env = await setupAnnotationEnvironment();

  try {
    await env.module.init();

    const { node } = selectText(env.messages[0], 'annotated');
    document.dispatchEvent(new window.MouseEvent('mouseup', { bubbles: true }));
    await new Promise(resolve => {
      setTimeout(resolve, 120);
    });

    const bubble = document.querySelector('.cl-annotation-bubble');
    assert.ok(bubble);
    assert.equal(bubble.style.display, 'flex');

    document
      .querySelector('[data-annotation-color="blue"]')
      .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    await new Promise(resolve => {
      setTimeout(resolve, 0);
    });

    assert.equal(env.storedAnnotations.length, 1);
    assert.equal(env.storedAnnotations[0].selectedText, 'annotated');
    assert.equal(env.storedAnnotations[0].color, 'blue');
    assert.equal(env.highlights.size, 1);

    document.caretRangeFromPoint = () => {
      const range = document.createRange();
      range.setStart(node, node.nodeValue.indexOf('annotated') + 2);
      range.collapse(true);
      return range;
    };
    env.messages[0].dispatchEvent(
      new window.MouseEvent('click', { bubbles: true, clientX: 10, clientY: 10 })
    );

    assert.ok(document.querySelector('.cl-annotation-editor'));

    document
      .getElementById('claude-annotations-fixed-btn')
      .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

    assert.equal(document.getElementById('claude-annotations-panel').style.display, 'flex');
    assert.match(document.getElementById('claude-annotations-panel').textContent, /annotated/);
  } finally {
    env.cleanup();
  }
});

test('annotation module updates, deletes, navigates, and opens distinct sidebar manager', async () => {
  const env = await setupAnnotationEnvironment();

  try {
    await env.module.init();
    selectText(env.messages[1], 'response');
    document.dispatchEvent(new window.MouseEvent('mouseup', { bubbles: true }));
    await new Promise(resolve => {
      setTimeout(resolve, 120);
    });
    document
      .querySelector('[data-annotation-color="yellow"]')
      .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    await new Promise(resolve => {
      setTimeout(resolve, 0);
    });

    const annotationId = env.storedAnnotations[0].id;
    await env.module.updateAnnotation(
      annotationId,
      { note: 'Important note', color: 'green' },
      'test'
    );

    assert.equal(env.storedAnnotations[0].note, 'Important note');
    assert.equal(env.storedAnnotations[0].color, 'green');

    assert.equal(
      env.module.navigateToAnnotation(annotationId, { source: 'test', openEditor: false }),
      true
    );
    assert.equal(env.scrolled[0], env.messages[1]);

    const sidebarTrigger = document.querySelector(
      '[data-clp-sidebar-annotations-item="true"] [data-dd-action-name="sidebar-nav-item"]'
    );
    assert.ok(sidebarTrigger);
    sidebarTrigger.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    await new Promise(resolve => {
      setTimeout(resolve, 20);
    });

    const manager = document.querySelector('.cl-annotation-manager-modal');
    const quickPanel = document.getElementById('claude-annotations-panel');
    assert.ok(manager);
    assert.notEqual(manager, quickPanel);
    assert.equal(manager.querySelector('textarea')?.value, 'Important note');

    await env.module.deleteAnnotation(annotationId, 'test');
    assert.equal(env.removedId, annotationId);
    assert.equal(env.storedAnnotations.length, 0);
  } finally {
    env.cleanup();
  }
});
