import {
  getRenderedMessage,
  openFixture,
  test,
  expect,
  writeStoreData,
} from './support/extensionTest.js';
import { CHAT_TEST_SURFACES } from './support/chatFixtures.js';

function createSeededBookmarks(route) {
  return {
    categories: [
      {
        id: 'focus',
        name: 'Focus',
        color: '#ef4444',
        type: 'category',
        createdAt: '2026-03-31T10:00:00.000Z',
      },
    ],
    bookmarks: [
      {
        id: 'bookmark-user-migration',
        conversationUrl: route,
        categoryId: 'default',
        sender: 'user',
        previewText: 'Migration checklist for the next release review',
        fullText:
          'Migration checklist for the next release review with rollout notes and migration tasks.',
        timestamp: Date.parse('2026-03-31T10:10:00.000Z'),
        createdAt: '2026-03-31T10:10:00.000Z',
      },
      {
        id: 'bookmark-assistant-release',
        conversationUrl: route,
        categoryId: 'focus',
        sender: 'assistant',
        previewText: 'Release checklist with validation and rollback notes',
        fullText:
          'Release checklist with validation steps, rollback notes, and launch coordination.',
        timestamp: Date.parse('2026-03-31T10:20:00.000Z'),
        createdAt: '2026-03-31T10:20:00.000Z',
      },
    ],
  };
}

async function openBookmarkManager(page) {
  await page.evaluate(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  });
  await page
    .locator('[data-clp-sidebar-bookmarks-item="true"] [data-dd-action-name="sidebar-nav-item"]')
    .evaluate(element => element.click());
  await expect(page.locator('#bm-current-category-title')).toHaveText('All Bookmarks');
}

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

  test('bookmark category popover baseline', async ({ fixturePage, harnessPage }) => {
    await openFixture(fixturePage, harnessPage, CHAT_TEST_SURFACES.visuals.bookmarkPopover);
    const firstMessage = getRenderedMessage(fixturePage, 0);
    await firstMessage.hover();
    await firstMessage.locator('.claude-bookmark-btn').click();
    await expect(fixturePage.locator('.claude-category-popover')).toHaveScreenshot(
      'bookmark-category-popover-real-short.png'
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

  test('bookmark manager modal baseline', async ({ fixturePage, harnessPage }) => {
    const { tabId, fixture } = await openFixture(
      fixturePage,
      harnessPage,
      CHAT_TEST_SURFACES.visuals.bookmarkManager
    );
    await writeStoreData(harnessPage, tabId, 'bookmarks', createSeededBookmarks(fixture.route));
    await fixturePage.waitForTimeout(400);

    await openBookmarkManager(fixturePage);
    const modal = fixturePage
      .locator('#bm-category-list')
      .locator(
        'xpath=ancestor::div[contains(@class,"rounded-xl") and contains(@class,"overflow-hidden")][1]'
      );
    await expect(modal).toHaveScreenshot('bookmark-manager-real-short.png');
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

  test('branch map modal shell baseline', async ({ fixturePage, harnessPage }) => {
    await openFixture(fixturePage, harnessPage, CHAT_TEST_SURFACES.visuals.branchMap);
    await fixturePage
      .locator('.claude-edit-badge')
      .first()
      .evaluate(element => element.click());
    await expect(fixturePage.locator('#claude-edit-modal-view')).toBeVisible();
    await fixturePage.keyboard.press('Escape');

    await fixturePage.locator('#claude-edit-fixed-btn').click();
    const branchMapButton = fixturePage.locator(
      '#claude-edit-panel button:has-text("Show Chat Branch Map")'
    );
    await branchMapButton.scrollIntoViewIfNeeded();
    await branchMapButton.click({ force: true });

    await expect(fixturePage.locator('#branch-map-content')).toHaveScreenshot(
      'branch-map-shell-real-medium.png'
    );
  });
});
