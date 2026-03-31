import { assertNoPageErrors, openFixture, test, expect } from './support/extensionTest.js';

test.describe('emoji marker module', () => {
  test('adds a marker, exposes alternate emoji choices and removes it', async ({
    fixturePage,
    harnessPage,
  }) => {
    await openFixture(fixturePage, harnessPage, 'chat-basic-dark');

    const targetMessage = fixturePage.locator('[data-test-render-count="2"]');
    await targetMessage.hover();
    const markerButton = targetMessage.locator('.emoji-marker-btn');
    await expect(markerButton).toBeVisible();
    await markerButton.evaluate(element => element.click());

    await fixturePage.getByRole('button', { name: '⭐' }).first().click();
    const badge = targetMessage.locator('.emoji-marker-badge');
    await expect(badge).toContainText('⭐');
    await expect(fixturePage.locator('#claude-marker-fixed-btn')).toBeVisible();

    await badge.evaluate(element => element.click());
    const badgeOptions = fixturePage.locator(
      '.emoji-marker-options[data-owner="emoji-marker-badge"]'
    );
    await expect(badgeOptions).toBeVisible();
    await expect(badgeOptions.getByRole('button', { name: '🔥', exact: true })).toBeVisible();

    await fixturePage.locator('#claude-marker-fixed-btn').click();
    await expect(fixturePage.locator('#claude-marker-panel')).toBeVisible();
    await expect(fixturePage.locator('#claude-marker-panel')).toContainText('⭐');

    fixturePage.once('dialog', dialog => dialog.accept());
    await fixturePage.locator('#claude-marker-panel button[title="Remove marker"]').click();
    await expect(fixturePage.locator('#claude-marker-panel')).toContainText(
      'No markers in this conversation'
    );

    assertNoPageErrors(fixturePage, ['ResizeObserver loop limit exceeded']);
  });

  test('renders a scrollable marker panel on the dense long-response fixture', async ({
    fixturePage,
    harnessPage,
  }) => {
    await openFixture(fixturePage, harnessPage, 'chat-long-response');

    for (const renderCount of ['1', '2', '3', '4', '5', '6', '7', '8']) {
      const message = fixturePage.locator(`[data-test-render-count="${renderCount}"]`);
      await message.hover();
      const markerButton = message.locator('.emoji-marker-btn');
      await expect(markerButton).toBeVisible();
      await markerButton.evaluate(element => element.click());
      await fixturePage.getByRole('button', { name: '⭐' }).first().click();
      await fixturePage.waitForTimeout(100);
    }

    await fixturePage.locator('#claude-marker-fixed-btn').click();
    const panelContent = fixturePage.locator('#claude-marker-panel .panel-content');
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
