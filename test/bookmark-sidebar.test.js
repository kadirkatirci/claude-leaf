import test from 'node:test';
import assert from 'node:assert/strict';
import { setupDom } from '../test-support/dom.js';

function createDomUtils() {
  return {
    createElement(tagName, options = {}) {
      const element = document.createElement(tagName);

      Object.entries(options).forEach(([key, value]) => {
        if (key === 'className') {
          element.className = value;
        } else if (key === 'textContent') {
          element.textContent = value;
        } else if (key === 'innerHTML') {
          element.innerHTML = value;
        } else if (key === 'style') {
          Object.assign(element.style, value);
        } else {
          element.setAttribute(key, value);
        }
      });

      return element;
    },
  };
}

test('bookmark sidebar item clones native sidebar item classes and keeps native anchor structure', async () => {
  const cleanup = setupDom(`
    <nav aria-label="Sidebar">
      <div class="flex flex-col px-2 pt-4 gap-px">
        <div class="relative group" data-state="closed">
          <a
            href="/recents"
            class="inline-flex items-center justify-center relative isolate shrink-0 can-focus select-none disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none disabled:drop-shadow-none border-transparent transition font-base duration-300 ease-[cubic-bezier(0.165,0.85,0.45,1)] h-8 rounded-md px-3 min-w-[4rem] whitespace-nowrap !text-xs w-full !min-w-0 group py-1.5 rounded-lg px-4 !duration-75 overflow-hidden active:bg-bg-300 active:scale-[1.0] _fill_56vq7_9 _ghost_56vq7_96"
            aria-label="Chats"
            data-dd-action-name="sidebar-nav-item"
          >
            <div class="-translate-x-2 w-full flex flex-row items-center justify-start gap-3">
              <div class="flex items-center justify-center text-text-100">
                <div
                  class="group"
                  style="width: 16px; height: 16px; display: flex; align-items: center; justify-content: center;"
                >
                  <svg width="20" height="20"></svg>
                </div>
              </div>
              <span class="truncate text-sm whitespace-nowrap flex-1">
                <div class="opacity-100 transition-opacity ease-out duration-150">
                  <span>Chats</span>
                </div>
              </span>
            </div>
          </a>
        </div>
      </div>
    </nav>
  `);

  try {
    const { BookmarkSidebar } = await import('../src/modules/BookmarkModule/BookmarkSidebar.js');
    const sidebar = new BookmarkSidebar(createDomUtils(), () => ({}));

    assert.equal(sidebar.inject(), true);

    const injectedItem = document.querySelector('[data-clp-sidebar-bookmarks-item="true"]');
    const nativeTrigger = document.querySelector('a[data-dd-action-name="sidebar-nav-item"]');
    const injectedTrigger = injectedItem.querySelector('a[data-dd-action-name="sidebar-nav-item"]');

    assert.ok(injectedItem);
    assert.ok(injectedTrigger);
    assert.equal(injectedTrigger.className, nativeTrigger.className);
    assert.equal(injectedTrigger.getAttribute('href'), '#bookmarks');
    assert.equal(injectedTrigger.getAttribute('aria-haspopup'), 'dialog');
    assert.equal(injectedTrigger.textContent.replace(/\s+/g, ' ').trim(), 'Bookmarks');
    assert.equal(
      injectedTrigger.firstElementChild?.className,
      nativeTrigger.firstElementChild?.className
    );
  } finally {
    cleanup();
  }
});

test('bookmark manager modal showSingleton keeps a single modal instance mounted', async () => {
  const cleanup = setupDom();
  const originalBroadcastChannel = globalThis.BroadcastChannel;
  const originalChrome = globalThis.chrome;
  const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
  let navigationInterceptor;

  try {
    globalThis.BroadcastChannel = undefined;
    globalThis.chrome = {
      runtime: {
        lastError: null,
        sendMessage: (_message, callback) => callback?.(),
      },
    };
    globalThis.requestAnimationFrame = callback => window.setTimeout(callback, 0);

    const [{ BookmarkManagerModal }, { bookmarkStore }, { default: loadedNavigationInterceptor }] =
      await Promise.all([
        import('../src/modules/BookmarkModule/BookmarkManagerModal.js'),
        import('../src/stores/index.js'),
        import('../src/core/NavigationInterceptor.js'),
      ]);
    navigationInterceptor = loadedNavigationInterceptor;

    const originalGetAll = bookmarkStore.getAll;
    const originalGetCategories = bookmarkStore.getCategories;

    bookmarkStore.getAll = () => Promise.resolve([]);
    bookmarkStore.getCategories = () => Promise.resolve([]);

    try {
      const first = await BookmarkManagerModal.showSingleton({ source: 'sidebar' });
      const second = await BookmarkManagerModal.showSingleton({ source: 'sidebar' });

      assert.equal(first, second);
      assert.equal(document.querySelectorAll('body > div.fixed.inset-0').length, 1);
      assert.equal(BookmarkManagerModal.getActiveInstance(), first);

      first.close('test');
      await new Promise(resolve => {
        setTimeout(resolve, 250);
      });

      assert.equal(BookmarkManagerModal.getActiveInstance(), null);
      assert.equal(document.querySelectorAll('body > div.fixed.inset-0').length, 0);
    } finally {
      bookmarkStore.getAll = originalGetAll;
      bookmarkStore.getCategories = originalGetCategories;
    }
  } finally {
    navigationInterceptor?.destroy();
    globalThis.BroadcastChannel = originalBroadcastChannel;
    globalThis.chrome = originalChrome;
    globalThis.requestAnimationFrame = originalRequestAnimationFrame;
    cleanup();
  }
});
