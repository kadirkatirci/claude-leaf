import {
  assertNoPageErrors,
  openFixture,
  test,
  expect,
  writeStoreData,
} from './support/extensionTest.js';
import { CHAT_TEST_SURFACES } from './support/chatFixtures.js';

function createSeededBookmarks(route) {
  const now = Date.now();
  return {
    categories: [
      {
        id: 'focus',
        name: 'Focus',
        color: '#ef4444',
        type: 'category',
        createdAt: new Date(now - 20_000).toISOString(),
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
        timestamp: now - 3_000,
        createdAt: new Date(now - 3_000).toISOString(),
      },
      {
        id: 'bookmark-assistant-release',
        conversationUrl: route,
        categoryId: 'focus',
        sender: 'assistant',
        previewText: 'Release checklist with validation and rollback notes',
        fullText:
          'Release checklist with validation steps, rollback notes, and launch coordination.',
        timestamp: now - 2_000,
        createdAt: new Date(now - 2_000).toISOString(),
      },
      {
        id: 'bookmark-assistant-retro',
        conversationUrl: route,
        categoryId: 'focus',
        sender: 'assistant',
        previewText: 'Retro summary for stability fixes and follow-up tasks',
        fullText:
          'Retro summary for stability fixes, fixture follow-up tasks, and owner assignments.',
        timestamp: now - 1_000,
        createdAt: new Date(now - 1_000).toISOString(),
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

test.describe('bookmark manager modal', () => {
  test('opens from the sidebar and supports category creation', async ({
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
    await domClick(fixturePage.getByRole('button', { name: '+ New Category' }));
    await fixturePage.locator('#new-cat-name').fill('Urgent');
    await fixturePage.locator('#new-cat-color').fill('#ff5500');
    await domClick(fixturePage.locator('#btn-cat-save'));

    await expect(fixturePage.locator('#bm-category-list')).toContainText('Urgent');

    assertNoPageErrors(fixturePage, ['ResizeObserver loop limit exceeded']);
  });

  test('supports search, sender filters, list view, and full view rendering', async ({
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

    const searchInput = fixturePage.getByPlaceholder('Search bookmarks...');
    await searchInput.fill('migration');
    await expect(fixturePage.locator('#bm-grid > div')).toHaveCount(1);

    await searchInput.fill('');
    await domClick(fixturePage.getByRole('button', { name: 'Claude' }));
    await expect(fixturePage.locator('#bm-grid > div')).toHaveCount(2);

    await domClick(fixturePage.getByTitle('List View'));
    await expect(fixturePage.locator('#bm-list-view-container')).toBeVisible();
    await expect(fixturePage.locator('#bm-master-list > div')).toHaveCount(2);
    await expect(fixturePage.locator('#bm-detail-content')).toBeVisible();
    const detailText = await fixturePage.locator('#bm-detail-body').textContent();
    expect((detailText || '').trim().length).toBeGreaterThan(0);

    await domClick(fixturePage.getByTitle('Grid View'));
    await expect(fixturePage.locator('#bm-grid-container')).toBeVisible();
    await domClick(fixturePage.locator('#bm-grid > div').first());
    await expect(fixturePage.locator('#bm-full-view-container')).toBeVisible();
    await expect(fixturePage.locator('#bm-full-view-content')).toContainText('fixture');
    await domClick(fixturePage.getByRole('button', { name: '← Back to List' }));
    await expect(fixturePage.locator('#bm-grid-container')).toBeVisible();

    assertNoPageErrors(fixturePage, ['ResizeObserver loop limit exceeded']);
  });
});
