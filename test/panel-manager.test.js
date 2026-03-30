import test from 'node:test';
import assert from 'node:assert/strict';
import { setupDom } from '../test-support/dom.js';

test('panel manager hides owners independently and collapses container only when needed', async () => {
  const cleanup = setupDom();
  const { default: navigationInterceptor } = await import('../src/core/NavigationInterceptor.js');
  const { default: VisibilityManager } = await import('../src/utils/VisibilityManager.js');
  const { panelManager } = await import('../src/components/PanelManager.js');

  const originalIsOnConversationPage = VisibilityManager.isOnConversationPage;

  try {
    VisibilityManager.isOnConversationPage = () => true;
    panelManager.destroy();
    panelManager.visible = true;

    const navButton = document.createElement('button');
    navButton.id = 'nav-button';
    const compactButton = document.createElement('button');
    compactButton.id = 'compact-button';

    panelManager.addButton(navButton, 10, { owner: 'navigation', visible: true });
    panelManager.addButton(compactButton, 20, { owner: 'compactView', visible: true });

    const container = panelManager.getContainer();
    assert.equal(container.style.display, 'flex');
    assert.equal(navButton.style.display, 'inline-flex');
    assert.equal(compactButton.style.display, 'inline-flex');

    panelManager.setOwnerVisibility('navigation', false);
    assert.equal(navButton.style.display, 'none');
    assert.equal(compactButton.style.display, 'inline-flex');
    assert.equal(container.style.display, 'flex');

    panelManager.setOwnerVisibility('compactView', false);
    assert.equal(container.style.display, 'none');
  } finally {
    VisibilityManager.isOnConversationPage = originalIsOnConversationPage;
    VisibilityManager.destroy();
    navigationInterceptor.destroy();
    panelManager.destroy();
    cleanup();
  }
});
