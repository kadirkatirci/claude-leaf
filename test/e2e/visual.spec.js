import { getRenderedMessage, openFixture, test, expect } from './support/extensionTest.js';
import { CHAT_TEST_SURFACES } from './support/chatFixtures.js';

test.describe('targeted visual baselines', () => {
  test('floating panel baseline on the short real chat fixture', async ({
    fixturePage,
    harnessPage,
  }) => {
    await openFixture(fixturePage, harnessPage, CHAT_TEST_SURFACES.visuals.nav);
    await expect(fixturePage.locator('#claude-nav-container')).toHaveScreenshot(
      'nav-panel-real-short.png'
    );
  });

  test('bookmark panel baseline', async ({ fixturePage, harnessPage }) => {
    await openFixture(fixturePage, harnessPage, CHAT_TEST_SURFACES.visuals.bookmarks);
    const firstMessage = getRenderedMessage(fixturePage, 0);
    await firstMessage.hover();
    await firstMessage.locator('.claude-bookmark-btn').click();
    await fixturePage.locator('.claude-category-popover').getByText('General').click();
    await fixturePage.locator('#claude-bookmarks-fixed-btn').click();
    await expect(fixturePage.locator('#claude-bookmarks-panel')).toHaveScreenshot(
      'bookmarks-panel-real-short.png'
    );
  });

  test('marker panel baseline', async ({ fixturePage, harnessPage }) => {
    await openFixture(fixturePage, harnessPage, CHAT_TEST_SURFACES.visuals.marker);
    const firstMessage = getRenderedMessage(fixturePage, 1);
    await firstMessage.hover();
    const markerButton = firstMessage.locator('.emoji-marker-btn');
    await expect(markerButton).toBeVisible();
    await markerButton.evaluate(element => element.click());
    await fixturePage.getByRole('button', { name: '⭐' }).first().click();
    await fixturePage.locator('#claude-marker-fixed-btn').click();
    await expect(fixturePage.locator('#claude-marker-panel')).toHaveScreenshot(
      'marker-panel-real-medium.png'
    );
  });

  test('edit panel and modal baselines', async ({ fixturePage, harnessPage }) => {
    await openFixture(fixturePage, harnessPage, CHAT_TEST_SURFACES.visuals.edit);
    await fixturePage.locator('#claude-edit-fixed-btn').click();
    await expect(fixturePage.locator('#claude-edit-panel')).toHaveScreenshot(
      'edit-panel-real-medium.png'
    );

    await fixturePage
      .locator('.claude-edit-badge')
      .first()
      .evaluate(element => element.click());
    await expect(fixturePage.locator('#claude-edit-modal-view')).toHaveScreenshot(
      'edit-modal-real-medium.png'
    );
  });
});
