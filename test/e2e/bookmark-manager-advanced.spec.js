import {
  assertNoPageErrors,
  openFixture,
  readStoreData,
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
      {
        id: 'bookmark-assistant-retro',
        conversationUrl: route,
        categoryId: 'focus',
        sender: 'assistant',
        previewText: 'Retro summary for stability fixes and follow-up tasks',
        fullText:
          'Retro summary for stability fixes, fixture follow-up tasks, and owner assignments.',
        timestamp: Date.parse('2026-03-31T10:30:00.000Z'),
        createdAt: '2026-03-31T10:30:00.000Z',
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

async function domClick(locator) {
  await locator.evaluate(element => element.click());
}

async function acceptNextDialog(page) {
  const dialogPromise = page.waitForEvent('dialog');
  return dialogPromise.then(dialog => dialog.accept());
}

test.describe('bookmark manager advanced flows', () => {
  test('filters by category, updates detail selection, and deletes bookmarks from the detail pane', async ({
    fixturePage,
    harnessPage,
  }) => {
    const { tabId, fixture } = await openFixture(
      fixturePage,
      harnessPage,
      CHAT_TEST_SURFACES.bookmarks.manager
    );

    await writeStoreData(harnessPage, tabId, 'bookmarks', createSeededBookmarks(fixture.route));
    await fixturePage.waitForTimeout(400);
    await openBookmarkManager(fixturePage);

    await domClick(fixturePage.locator('#bm-category-list > div').filter({ hasText: 'Focus' }));
    await expect(fixturePage.locator('#bm-current-category-title')).toHaveText('Focus');
    await expect(fixturePage.locator('#bm-grid > div')).toHaveCount(2);

    await domClick(fixturePage.getByTitle('List View'));
    await expect(fixturePage.locator('#bm-master-list > div')).toHaveCount(2);
    await expect(fixturePage.locator('#bm-detail-body')).toContainText(
      'Retro summary for stability fixes'
    );

    await domClick(fixturePage.locator('#bm-master-list > div').nth(1));
    await expect(fixturePage.locator('#bm-detail-body')).toContainText('Release checklist');

    const acceptDialog = acceptNextDialog(fixturePage);
    await domClick(fixturePage.locator('#bm-detail-delete-btn'));
    await acceptDialog;

    await expect(fixturePage.locator('#bm-master-list > div')).toHaveCount(1);
    await expect(fixturePage.locator('#bm-detail-body')).toContainText('Release checklist');

    assertNoPageErrors(fixturePage, ['ResizeObserver loop limit exceeded']);
  });

  test('reassigns custom category bookmarks to General when the category is deleted', async ({
    fixturePage,
    harnessPage,
  }) => {
    const { tabId, fixture } = await openFixture(
      fixturePage,
      harnessPage,
      CHAT_TEST_SURFACES.bookmarks.manager
    );

    await writeStoreData(harnessPage, tabId, 'bookmarks', createSeededBookmarks(fixture.route));
    await fixturePage.waitForTimeout(400);
    await openBookmarkManager(fixturePage);

    const focusCategory = fixturePage
      .locator('#bm-category-list > div')
      .filter({ hasText: 'Focus' });
    await expect(focusCategory).toHaveCount(1);

    const acceptDialog = acceptNextDialog(fixturePage);
    await domClick(focusCategory.getByTitle('Delete Category'));
    await acceptDialog;

    await expect(
      fixturePage.locator('#bm-category-list > div').filter({ hasText: 'Focus' })
    ).toHaveCount(0);
    await expect(fixturePage.locator('#bm-grid > div')).toHaveCount(3);

    const storeResponse = await readStoreData(harnessPage, tabId, 'bookmarks');
    const storeData = storeResponse?.data || {};
    const categoryIds = (storeData.categories || []).map(category => category.id);
    expect(categoryIds).not.toContain('focus');

    const reassigned = (storeData.bookmarks || []).filter(
      bookmark => bookmark.id !== 'bookmark-user-migration'
    );
    expect(reassigned.every(bookmark => bookmark.categoryId === 'default')).toBe(true);

    assertNoPageErrors(fixturePage, ['ResizeObserver loop limit exceeded']);
  });
});
