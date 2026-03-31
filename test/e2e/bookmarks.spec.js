import { assertNoPageErrors, openFixture, test, expect } from './support/extensionTest.js';

test.describe('bookmark module', () => {
  test('adds a bookmark, injects sidebar entry, navigates back to it, and removes it', async ({
    fixturePage,
    harnessPage,
  }) => {
    await openFixture(fixturePage, harnessPage, 'chat-basic-dark');

    const targetMessage = fixturePage.locator('[data-test-render-count="3"]');
    await targetMessage.hover();
    await targetMessage.locator('.claude-bookmark-btn').click();

    const categoryPopover = fixturePage.locator('.claude-category-popover');
    await expect(categoryPopover).toBeVisible();
    await categoryPopover.getByText('General').click();

    await expect(fixturePage.locator('#claude-bookmarks-fixed-btn')).toBeVisible();
    await fixturePage.locator('#claude-bookmarks-fixed-btn').click();
    await expect(fixturePage.locator('#claude-bookmarks-panel')).toBeVisible();
    await expect(fixturePage.locator('#claude-bookmarks-panel')).toContainText('Bookmarks');
    await expect(fixturePage.locator('[data-clp-sidebar-bookmarks-item="true"]')).toHaveCount(1);

    await fixturePage.evaluate(() => {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'auto' });
    });
    await fixturePage.waitForTimeout(300);

    const scrollBeforeNavigate = await fixturePage.evaluate(() => window.scrollY);
    await fixturePage.locator('#claude-bookmarks-panel .p-3').first().click();
    await fixturePage.waitForTimeout(600);

    const scrollAfterNavigate = await fixturePage.evaluate(() => window.scrollY);
    expect(scrollAfterNavigate).toBeLessThan(scrollBeforeNavigate);
    await expect(fixturePage.locator('[data-test-render-count="3"]')).toHaveClass(
      /claude-nav-highlight/
    );

    await fixturePage.locator('#claude-bookmarks-fixed-btn').click();
    await expect(fixturePage.locator('#claude-bookmarks-panel')).toBeVisible();
    await fixturePage.locator('#claude-bookmarks-panel .size-4').click();
    await expect(fixturePage.locator('#claude-bookmarks-panel')).toContainText('No bookmarks yet');

    assertNoPageErrors(fixturePage, ['ResizeObserver loop limit exceeded']);
  });

  test('injects the bookmark sidebar entry on the richer sidebar fixture', async ({
    fixturePage,
    harnessPage,
  }) => {
    await openFixture(fixturePage, harnessPage, 'chat-sidebar-rich');

    const firstMessage = fixturePage.locator('[data-test-render-count="1"]');
    await firstMessage.hover();
    await firstMessage.locator('.claude-bookmark-btn').click();
    await fixturePage.locator('.claude-category-popover').getByText('General').click();

    await expect(fixturePage.locator('[data-clp-sidebar-bookmarks-item="true"]')).toHaveCount(1);
    await expect(fixturePage.locator('[data-clp-sidebar-bookmarks-item="true"]')).toContainText(
      'Bookmarks'
    );

    assertNoPageErrors(fixturePage, ['ResizeObserver loop limit exceeded']);
  });
});
