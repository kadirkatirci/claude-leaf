import {
  assertNoPageErrors,
  buildFixtureUrl,
  getRenderedMessage,
  openFixture,
  test,
  expect,
  writeStoreData,
} from './support/extensionTest.js';
import { CHAT_TEST_SURFACES } from './support/chatFixtures.js';

async function createBookmarkRecord(message, route, index, id) {
  const previewText = await message.evaluate(element => {
    const content =
      element.querySelector('[data-testid="user-message"]') ||
      element.querySelector('.font-claude-message') ||
      element;
    return content.textContent.trim().substring(0, 300);
  });

  return {
    id,
    conversationUrl: route,
    index,
    previewText,
    fullText: previewText,
    messagePreview: previewText,
    timestamp: Date.now(),
    createdAt: new Date().toISOString(),
    categoryId: 'default',
  };
}

async function waitForBookmarkRestore(page) {
  await page.waitForFunction(() => Boolean(window.__claudeFixture));
  await page.waitForSelector('#claude-nav-container');
  await page.waitForFunction(() => !new URL(window.location.href).searchParams.has('bookmark'));
  await expect(page.locator('.claude-nav-highlight')).toHaveCount(1);
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

test.describe('bookmark deep links', () => {
  test('restores a bookmarked message when the chat is opened with a bookmark query param', async ({
    fixturePage,
    harnessPage,
  }) => {
    const { fixture, tabId } = await openFixture(
      fixturePage,
      harnessPage,
      CHAT_TEST_SURFACES.bookmarks.deepLinkSource
    );

    const targetMessage = getRenderedMessage(fixturePage, 2);
    const bookmark = await createBookmarkRecord(
      targetMessage,
      fixture.route,
      2,
      'bookmark-direct-link'
    );
    await writeStoreData(harnessPage, tabId, 'bookmarks', {
      bookmarks: [bookmark],
      categories: [],
    });
    await fixturePage.waitForTimeout(400);

    await fixturePage.evaluate(() => {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'auto' });
    });
    const scrollBeforeRestore = await fixturePage.evaluate(() => window.scrollY);

    await fixturePage.goto(buildFixtureUrl(fixture, { bookmark: bookmark.id }), {
      waitUntil: 'domcontentloaded',
    });
    await waitForBookmarkRestore(fixturePage);

    const scrollAfterRestore = await fixturePage.evaluate(() => window.scrollY);
    expect(scrollAfterRestore).toBeLessThan(scrollBeforeRestore);
    await expect(getRenderedMessage(fixturePage, 2)).toHaveClass(/claude-nav-highlight/);

    assertNoPageErrors(fixturePage, ['ResizeObserver loop limit exceeded']);
  });

  test('opens cross-chat bookmarks in a new tab and resolves the bookmark query on the target chat', async ({
    fixturePage,
    harnessPage,
    extensionContext,
  }) => {
    const source = await openFixture(
      fixturePage,
      harnessPage,
      CHAT_TEST_SURFACES.bookmarks.deepLinkSource
    );

    const bookmark = await createBookmarkRecord(
      getRenderedMessage(fixturePage, 1),
      source.fixture.route,
      1,
      'bookmark-cross-chat'
    );

    const target = await openFixture(
      fixturePage,
      harnessPage,
      CHAT_TEST_SURFACES.bookmarks.deepLinkTarget
    );
    await writeStoreData(harnessPage, target.tabId, 'bookmarks', {
      bookmarks: [bookmark],
      categories: [],
    });
    await fixturePage.waitForTimeout(400);

    await openBookmarkManager(fixturePage);
    await expect(fixturePage.locator('#bm-grid > div')).toHaveCount(1);

    const openedPagePromise = extensionContext.waitForEvent('page');
    await domClick(fixturePage.locator('#bm-grid button[title="Go to Message"]'));
    const openedPage = await openedPagePromise;

    try {
      await openedPage.waitForLoadState('domcontentloaded');
      await waitForBookmarkRestore(openedPage);

      expect(new URL(openedPage.url()).pathname).toBe(source.fixture.route);
      await expect(openedPage.locator('.claude-nav-highlight')).toHaveCount(1);
    } finally {
      await openedPage.close();
    }

    assertNoPageErrors(fixturePage, ['ResizeObserver loop limit exceeded']);
  });
});
