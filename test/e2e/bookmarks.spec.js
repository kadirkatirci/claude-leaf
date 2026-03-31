import {
  assertNoPageErrors,
  getRenderedMessage,
  openFixture,
  test,
  expect,
} from './support/extensionTest.js';

test.describe('bookmark module', () => {
  test('adds a bookmark, injects sidebar entry, navigates back to it, and removes it', async ({
    fixturePage,
    harnessPage,
  }) => {
    await openFixture(fixturePage, harnessPage, 'chat-real-short');

    const targetMessage = getRenderedMessage(fixturePage, 2);
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
    await expect(targetMessage).toHaveClass(/claude-nav-highlight/);

    await fixturePage.locator('#claude-bookmarks-fixed-btn').click();
    await expect(fixturePage.locator('#claude-bookmarks-panel')).toBeVisible();
    await fixturePage.locator('#claude-bookmarks-panel .size-4').click();
    await expect(fixturePage.locator('#claude-bookmarks-panel')).toContainText('No bookmarks yet');

    assertNoPageErrors(fixturePage, ['ResizeObserver loop limit exceeded']);
  });

  test('supports bookmark keyboard shortcuts on the medium real chat fixture', async ({
    fixturePage,
    harnessPage,
  }) => {
    await openFixture(fixturePage, harnessPage, 'chat-real-medium');

    const firstMessage = getRenderedMessage(fixturePage, 0);
    await firstMessage.hover();
    await fixturePage.keyboard.press('Alt+b');
    await fixturePage.locator('.claude-category-popover').getByText('General').click();
    await expect(fixturePage.locator('[data-clp-sidebar-bookmarks-item="true"]')).toHaveCount(1);
    await fixturePage.keyboard.press('Alt+Shift+B');
    await expect(fixturePage.locator('#claude-bookmarks-panel')).toBeVisible();

    assertNoPageErrors(fixturePage, ['ResizeObserver loop limit exceeded']);
  });

  test('renders a scrollable bookmarks panel on the long real chat fixture', async ({
    fixturePage,
    harnessPage,
  }) => {
    await openFixture(fixturePage, harnessPage, 'chat-real-long');

    for (const index of [0, 2, 4, 6, 8, 10, 12, 14]) {
      const message = getRenderedMessage(fixturePage, index);
      await message.hover();
      await message.locator('.claude-bookmark-btn').click();
      await fixturePage.locator('.claude-category-popover').getByText('General').click();
      await fixturePage.waitForTimeout(120);
    }

    await fixturePage.locator('#claude-bookmarks-fixed-btn').click();
    const panelContent = fixturePage.locator('#claude-bookmarks-panel .panel-content');
    await expect(panelContent).toBeVisible();

    const scrollMetrics = await panelContent.evaluate(async element => {
      element.scrollTo({ top: element.scrollHeight });
      await new Promise(resolve => {
        requestAnimationFrame(() => {
          requestAnimationFrame(resolve);
        });
      });

      return {
        scrollHeight: element.scrollHeight,
        clientHeight: element.clientHeight,
        scrollTop: element.scrollTop,
      };
    });

    expect(scrollMetrics.scrollHeight).toBeGreaterThan(scrollMetrics.clientHeight);
    expect(scrollMetrics.scrollTop).toBeGreaterThan(0);

    assertNoPageErrors(fixturePage, ['ResizeObserver loop limit exceeded']);
  });
});
