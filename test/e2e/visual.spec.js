import { openFixture, test, expect } from './support/extensionTest.js';

test.describe('targeted visual baselines', () => {
  test('floating panel baseline in dark conversation', async ({ fixturePage, harnessPage }) => {
    await openFixture(fixturePage, harnessPage, 'chat-basic-dark');
    await expect(fixturePage.locator('#claude-nav-container')).toHaveScreenshot(
      'nav-panel-dark.png'
    );
  });

  test('floating panel baseline in light conversation', async ({ fixturePage, harnessPage }) => {
    await openFixture(fixturePage, harnessPage, 'chat-basic-light');
    await expect(fixturePage.locator('#claude-nav-container')).toHaveScreenshot(
      'nav-panel-light.png'
    );
  });

  test('bookmark panel baseline', async ({ fixturePage, harnessPage }) => {
    await openFixture(fixturePage, harnessPage, 'chat-basic-dark');
    const firstMessage = fixturePage.locator('[data-test-render-count="1"]');
    await firstMessage.hover();
    await firstMessage.locator('.claude-bookmark-btn').click();
    await fixturePage.locator('.claude-category-popover').getByText('General').click();
    await fixturePage.locator('#claude-bookmarks-fixed-btn').click();
    await expect(fixturePage.locator('#claude-bookmarks-panel')).toHaveScreenshot(
      'bookmarks-panel.png'
    );
  });

  test('marker panel baseline', async ({ fixturePage, harnessPage }) => {
    await openFixture(fixturePage, harnessPage, 'chat-basic-dark');
    const firstMessage = fixturePage.locator('[data-test-render-count="2"]');
    await firstMessage.hover();
    const markerButton = firstMessage.locator('.emoji-marker-btn');
    await expect(markerButton).toBeVisible();
    await markerButton.evaluate(element => element.click());
    await fixturePage.getByRole('button', { name: '⭐' }).first().click();
    await fixturePage.locator('#claude-marker-fixed-btn').click();
    await expect(fixturePage.locator('#claude-marker-panel')).toHaveScreenshot('marker-panel.png');
  });

  test('edit panel and modal baselines', async ({ fixturePage, harnessPage }) => {
    await openFixture(fixturePage, harnessPage, 'chat-edited-thread');
    await fixturePage.locator('#claude-edit-fixed-btn').click();
    await expect(fixturePage.locator('#claude-edit-panel')).toHaveScreenshot('edit-panel.png');

    await fixturePage
      .locator('.claude-edit-badge')
      .first()
      .evaluate(element => element.click());
    await expect(fixturePage.locator('#claude-edit-modal-view')).toHaveScreenshot('edit-modal.png');
  });
});
