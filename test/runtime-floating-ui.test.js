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
