import { cloneDefaultSettings } from '../../src/config/defaultSettings.js';
import {
  assertNoPageErrors,
  openFixture,
  test,
  expect,
  DEFAULT_VIEWPORT,
  NARROW_VIEWPORT,
} from './support/extensionTest.js';

test.describe('popup sync', () => {
  for (const viewport of [DEFAULT_VIEWPORT, NARROW_VIEWPORT]) {
    test(`popup hides dev-disabled modules and updates active Claude tab settings at ${viewport.width}x${viewport.height}`, async ({
      fixturePage,
      harnessPage,
      extensionContext,
    }) => {
      const settings = cloneDefaultSettings();
      settings.navigation.showFloatingUI = true;

      const { tabId } = await openFixture(fixturePage, harnessPage, 'chat-basic-dark', {
        settings,
        viewport,
      });
      await fixturePage.locator('#claude-nav-next').click();
      await fixturePage.waitForTimeout(350);
      const counterBeforePopupSave = await fixturePage.locator('#claude-nav-counter').textContent();

      const popupUrl = await harnessPage.evaluate(
        targetTabId => window.__clLeafTestHarness.getPopupUrl(targetTabId),
        tabId
      );

      const popupPage = await extensionContext.newPage();
      try {
        await popupPage.goto(popupUrl, { waitUntil: 'domcontentloaded' });
        await popupPage.waitForSelector('.feature-item[data-module="navigation"]');

        await expect(popupPage.locator('.feature-item[data-module="compactView"]')).toHaveCount(0);
        await expect(popupPage.locator('.feature-item[data-module="sidebarCollapse"]')).toHaveCount(
          0
        );
        await expect(popupPage.locator('.feature-item[data-module="contentFolding"]')).toHaveCount(
          0
        );

        const navigationVisibility = popupPage.locator('#navigation-floating-ui');
        await navigationVisibility.click();
        await popupPage.locator('#save-btn').click();

        await fixturePage.waitForTimeout(700);
        await expect(fixturePage.locator('#claude-nav-top')).toBeHidden();

        await navigationVisibility.click();
        await popupPage.locator('#save-btn').click();

        await fixturePage.waitForTimeout(700);
        await expect(fixturePage.locator('#claude-nav-top')).toBeVisible();
        await expect(fixturePage.locator('#claude-nav-counter')).toHaveText(
          counterBeforePopupSave || ''
        );
      } finally {
        await popupPage.close();
      }

      assertNoPageErrors(fixturePage, ['ResizeObserver loop limit exceeded']);
    });
  }
});
