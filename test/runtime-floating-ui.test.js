import test from 'node:test';
import assert from 'node:assert/strict';
import { setupDom } from '../test-support/dom.js';

test('bookmark destroy cleans up its fixed launcher', async () => {
  const cleanup = setupDom();
  const originalChrome = globalThis.chrome;
  const { default: navigationInterceptor } = await import('../src/core/NavigationInterceptor.js');
  const { storeSyncChannel } = await import('../src/utils/StoreSyncChannel.js');

  try {
    globalThis.chrome = {
      runtime: {
        onMessage: {
          removeListener() {},
        },
      },
    };

    const { default: BookmarkModule } = await import('../src/modules/BookmarkModule.js');
    const module = new BookmarkModule();
    let fixedButtonDestroyed = false;

    module.destroyFixedButton = () => {
      fixedButtonDestroyed = true;
    };
    module.buttonManager = {
      removeAll() {},
    };
    module._panel = {
      destroy() {},
    };
    module._sidebar = {
      destroy() {},
    };

    module.destroy();
    assert.equal(fixedButtonDestroyed, true);
  } finally {
    storeSyncChannel.destroy();
    navigationInterceptor.destroy();
    if (originalChrome === undefined) {
      delete globalThis.chrome;
    } else {
      globalThis.chrome = originalChrome;
    }
    cleanup();
  }
});

test('bookmark runtime listener does not claim unrelated messages', async () => {
  const cleanup = setupDom();
  const { default: navigationInterceptor } = await import('../src/core/NavigationInterceptor.js');
  const { storeSyncChannel } = await import('../src/utils/StoreSyncChannel.js');

  try {
    const { default: BookmarkModule } = await import('../src/modules/BookmarkModule.js');
    const module = new BookmarkModule();
    let refreshCount = 0;

    module.addBookmarkButtons = () => {
      refreshCount += 1;
      return Promise.resolve();
    };
    module.updateUI = () => {
      refreshCount += 1;
      return Promise.resolve();
    };

    const listener = module.createChromeMessageListener();

    assert.equal(listener({ type: 'STORE_READ', storeId: 'editHistory' }), false);
    await Promise.resolve();
    assert.equal(refreshCount, 0);

    assert.equal(listener({ type: 'BOOKMARKS_UPDATED' }), false);
    await new Promise(resolve => {
      setTimeout(resolve, 0);
    });
    assert.equal(refreshCount, 2);
  } finally {
    storeSyncChannel.destroy();
    navigationInterceptor.destroy();
    cleanup();
  }
});

test('navigation destroy removes shared panel buttons', async () => {
  const cleanup = setupDom();
  const { default: navigationInterceptor } = await import('../src/core/NavigationInterceptor.js');
  const { panelManager } = await import('../src/components/PanelManager.js');
  const { default: NavigationModule } = await import('../src/modules/NavigationModule.js');
  const { storeSyncChannel } = await import('../src/utils/StoreSyncChannel.js');

  try {
    panelManager.destroy();
    panelManager.visible = true;

    const topBtn = document.createElement('button');
    topBtn.id = 'claude-nav-top';
    const prevBtn = document.createElement('button');
    prevBtn.id = 'claude-nav-prev';
    const nextBtn = document.createElement('button');
    nextBtn.id = 'claude-nav-next';

    panelManager.addButton(topBtn, 10, { owner: 'navigation', visible: true });
    panelManager.addButton(prevBtn, 20, { owner: 'navigation', visible: true });
    panelManager.addButton(nextBtn, 30, { owner: 'navigation', visible: true });

    const module = new NavigationModule();
    module.elements = { topBtn, prevBtn, nextBtn };
    module.destroy();

    assert.equal(document.getElementById('claude-nav-top'), null);
    assert.equal(document.getElementById('claude-nav-prev'), null);
    assert.equal(document.getElementById('claude-nav-next'), null);
  } finally {
    storeSyncChannel.destroy();
    navigationInterceptor.destroy();
    panelManager.destroy();
    cleanup();
  }
});
