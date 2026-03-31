import {
  assertNoPageErrors,
  getRenderedMessage,
  openFixture,
  test,
  expect,
} from './support/extensionTest.js';
import { CHAT_TEST_SURFACES } from './support/chatFixtures.js';

async function addMarkerFromFullPicker(page, message, emoji) {
  await message.hover();
  const markerButton = message.locator('.emoji-marker-btn');
  await expect(markerButton).toBeVisible();
  await markerButton.evaluate(element => element.click());

  await expect(page.locator('#emoji-quick-picker')).toBeVisible();
  await page.getByTitle('More emojis').click();
  await expect(page.locator('#emoji-full-picker')).toBeVisible();

  const searchBox = page.getByPlaceholder('Search emoji...');
  await searchBox.fill('fire');
  await expect(page.locator('#search-results')).toBeVisible();

  await page.locator('#search-results button').filter({ hasText: emoji }).first().click();
}

test.describe('emoji marker advanced flows', () => {
  test('supports the full picker workflow when adding a marker', async ({
    fixturePage,
    harnessPage,
  }) => {
    await openFixture(fixturePage, harnessPage, CHAT_TEST_SURFACES.emoji.advanced);

    const targetMessage = getRenderedMessage(fixturePage, 1);
    await addMarkerFromFullPicker(fixturePage, targetMessage, '🔥');

    const badge = targetMessage.locator('.emoji-marker-badge');
    await expect(badge).toContainText('🔥');

    await fixturePage.locator('#claude-marker-fixed-btn').click();
    await expect(fixturePage.locator('#claude-marker-panel')).toContainText('🔥');

    assertNoPageErrors(fixturePage, ['ResizeObserver loop limit exceeded']);
  });

  test('navigates back to the highlighted message when selecting a marker from the panel', async ({
    fixturePage,
    harnessPage,
  }) => {
    await openFixture(fixturePage, harnessPage, CHAT_TEST_SURFACES.emoji.denseList);

    for (const index of [0, 1, 12]) {
      const message = getRenderedMessage(fixturePage, index);
      await message.hover();
      const markerButton = message.locator('.emoji-marker-btn');
      await expect(markerButton).toBeVisible();
      await markerButton.evaluate(element => element.click());
      await fixturePage.getByRole('button', { name: '⭐' }).first().click();
      await fixturePage.waitForTimeout(100);
    }

    const targetMessage = getRenderedMessage(fixturePage, 12);
    await fixturePage.evaluate(() => {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'auto' });
    });
    const scrollBeforeNavigate = await fixturePage.evaluate(() => window.scrollY);

    await fixturePage.locator('#claude-marker-fixed-btn').click();
    await expect(fixturePage.locator('#claude-marker-panel')).toBeVisible();
    await expect(fixturePage.locator('#claude-marker-panel .panel-items > div')).toHaveCount(3);
    await fixturePage.locator('#claude-marker-panel .panel-items > div').first().click();
    await fixturePage.waitForTimeout(600);

    const scrollAfterNavigate = await fixturePage.evaluate(() => window.scrollY);
    expect(scrollAfterNavigate).toBeLessThan(scrollBeforeNavigate);
    await expect(targetMessage).toHaveClass(/claude-nav-highlight/);

    assertNoPageErrors(fixturePage, ['ResizeObserver loop limit exceeded']);
  });
});
