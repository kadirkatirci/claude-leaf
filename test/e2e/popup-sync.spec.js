import { cloneDefaultSettings } from '../../src/config/defaultSettings.js';
import {
  assertNoPageErrors,
  getExtensionState,
  getRenderedMessage,
  openFixture,
  test,
  expect,
  DEFAULT_VIEWPORT,
  NARROW_VIEWPORT,
} from './support/extensionTest.js';
import { CHAT_TEST_SURFACES } from './support/chatFixtures.js';

async function openPopupForTab(harnessPage, extensionContext, tabId) {
  const popupUrl = await harnessPage.evaluate(
    targetTabId => window.__clLeafTestHarness.getPopupUrl(targetTabId),
    tabId
  );

  const popupPage = await extensionContext.newPage();
  await popupPage.goto(popupUrl, { waitUntil: 'domcontentloaded' });
  await popupPage.waitForSelector('.feature-item[data-module="navigation"]');
  return popupPage;
}

async function savePopupSettings(popupPage, fixturePage, waitMs = 700) {
  await popupPage.locator('#save-btn').click();
  await fixturePage.waitForTimeout(waitMs);
}

async function setPopupCheckbox(popupPage, selector, checked) {
  await popupPage.locator(selector).evaluate((element, nextChecked) => {
    element.checked = nextChecked;
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }, checked);
}

async function clickPopupButton(popupPage, selector) {
  await popupPage.locator(selector).evaluate(element => element.click());
}

async function readStoredSettings(harnessPage) {
  return harnessPage.evaluate(async () => {
    const storage = await window.__clLeafTestHarness.getStorage('sync', ['settings']);
    return storage.settings || null;
  });
}

async function addBookmarkToGeneral(page, message) {
  await message.hover();
  await message.locator('.claude-bookmark-btn').click();
  await page.locator('.claude-category-popover').getByText('General').click();
}

async function addMarker(page, message, emoji = '⭐') {
  await message.hover();
  const markerButton = message.locator('.emoji-marker-btn');
  await expect(markerButton).toBeVisible();
  await markerButton.evaluate(element => element.click());
  await page.getByRole('button', { name: emoji }).first().click();
}

test.describe('popup sync', () => {
  for (const viewport of [DEFAULT_VIEWPORT, NARROW_VIEWPORT]) {
    test(`popup hides dev-disabled modules and updates active Claude tab settings at ${viewport.width}x${viewport.height}`, async ({
      fixturePage,
      harnessPage,
      extensionContext,
    }) => {
      const settings = cloneDefaultSettings();
      settings.navigation.showFloatingUI = true;

      const { tabId } = await openFixture(fixturePage, harnessPage, CHAT_TEST_SURFACES.popup.base, {
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

  test('popup saves do not wipe navigation state on the long real chat fixture', async ({
    fixturePage,
    harnessPage,
    extensionContext,
  }) => {
    const settings = cloneDefaultSettings();
    settings.navigation.showFloatingUI = true;

    const { tabId } = await openFixture(
      fixturePage,
      harnessPage,
      CHAT_TEST_SURFACES.popup.persistence,
      {
        settings,
      }
    );
    await fixturePage.locator('#claude-nav-next').click();
    await fixturePage.waitForTimeout(350);
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

      await popupPage.locator('#navigation-floating-ui').click();
      await popupPage.locator('#save-btn').click();
      await fixturePage.waitForTimeout(700);
      await expect(fixturePage.locator('#claude-nav-top')).toBeHidden();

      await popupPage.locator('#navigation-floating-ui').click();
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

  test('popup toggles bookmarks without wiping saved bookmarks or unrelated nested settings', async ({
    fixturePage,
    harnessPage,
    extensionContext,
  }) => {
    const settings = cloneDefaultSettings();
    settings.bookmarks.showFloatingUI = true;
    settings.emojiMarkers.favoriteEmojis = ['🔥', '💡'];
    settings.navigation.showCounter = false;

    const { tabId } = await openFixture(fixturePage, harnessPage, CHAT_TEST_SURFACES.popup.base, {
      settings,
    });

    const targetMessage = getRenderedMessage(fixturePage, 1);
    await addBookmarkToGeneral(fixturePage, targetMessage);
    await expect(fixturePage.locator('#claude-bookmarks-fixed-btn')).toBeVisible();
    await expect(fixturePage.locator('[data-clp-sidebar-bookmarks-item="true"]')).toHaveCount(1);

    const popupPage = await openPopupForTab(harnessPage, extensionContext, tabId);
    try {
      await setPopupCheckbox(popupPage, '#bookmarks-enabled', false);
      await savePopupSettings(popupPage, fixturePage);

      const bookmarkStateAfterDisable = await getExtensionState(harnessPage, tabId);
      expect(bookmarkStateAfterDisable.moduleStates?.bookmarks).toEqual({
        enabled: false,
        initialized: false,
      });

      await expect(fixturePage.locator('#claude-bookmarks-fixed-btn')).toHaveCount(0);
      await expect(fixturePage.locator('[data-clp-sidebar-bookmarks-item="true"]')).toHaveCount(0);
      await targetMessage.hover();
      await expect(targetMessage.locator('.claude-bookmark-btn')).toHaveCount(0);
      await expect(targetMessage.locator('.emoji-marker-btn')).toBeVisible();

      const settingsAfterDisable = await readStoredSettings(harnessPage);
      expect(settingsAfterDisable?.navigation?.showCounter).toBe(false);
      expect(settingsAfterDisable?.emojiMarkers?.favoriteEmojis).toEqual(['🔥', '💡']);

      await setPopupCheckbox(popupPage, '#bookmarks-enabled', true);
      await savePopupSettings(popupPage, fixturePage);

      const bookmarkStateAfterEnable = await getExtensionState(harnessPage, tabId);
      expect(bookmarkStateAfterEnable.moduleStates?.bookmarks).toEqual({
        enabled: true,
        initialized: true,
      });

      await expect(fixturePage.locator('#claude-bookmarks-fixed-btn')).toBeVisible();
      await expect(fixturePage.locator('[data-clp-sidebar-bookmarks-item="true"]')).toHaveCount(1);
      await targetMessage.hover();
      await expect(targetMessage.locator('.claude-bookmark-btn')).toBeVisible();

      await fixturePage.locator('#claude-bookmarks-fixed-btn').click();
      await expect(fixturePage.locator('#claude-bookmarks-panel')).toBeVisible();
      await expect(fixturePage.locator('#claude-bookmarks-panel .p-3')).toHaveCount(1);
    } finally {
      await popupPage.close();
    }

    assertNoPageErrors(fixturePage, ['ResizeObserver loop limit exceeded']);
  });

  test('popup toggles emoji markers without wiping marker data or favorite emoji settings', async ({
    fixturePage,
    harnessPage,
    extensionContext,
  }) => {
    const settings = cloneDefaultSettings();
    settings.emojiMarkers.showFloatingUI = true;
    settings.emojiMarkers.favoriteEmojis = ['🔥', '🧪'];
    settings.bookmarks.showTimestamp = false;

    const { tabId } = await openFixture(
      fixturePage,
      harnessPage,
      CHAT_TEST_SURFACES.popup.modules,
      {
        settings,
      }
    );

    const targetMessage = getRenderedMessage(fixturePage, 1);
    await addMarker(fixturePage, targetMessage, '🔥');
    await expect(targetMessage.locator('.emoji-marker-badge')).toContainText('🔥');
    await expect(fixturePage.locator('#claude-marker-fixed-btn')).toBeVisible();

    const popupPage = await openPopupForTab(harnessPage, extensionContext, tabId);
    try {
      await setPopupCheckbox(popupPage, '#emojiMarkers-enabled', false);
      await savePopupSettings(popupPage, fixturePage);

      const markerStateAfterDisable = await getExtensionState(harnessPage, tabId);
      expect(markerStateAfterDisable.moduleStates?.emojiMarkers).toEqual({
        enabled: false,
        initialized: false,
      });

      await targetMessage.hover();
      await expect(fixturePage.locator('#claude-marker-fixed-btn')).toHaveCount(0);
      await expect(targetMessage.locator('.emoji-marker-btn')).toHaveCount(0);
      await expect(targetMessage.locator('.emoji-marker-badge')).toHaveCount(0);
      await expect(targetMessage.locator('.claude-bookmark-btn')).toBeVisible();

      const settingsAfterDisable = await readStoredSettings(harnessPage);
      expect(settingsAfterDisable?.emojiMarkers?.favoriteEmojis).toEqual(['🔥', '🧪']);
      expect(settingsAfterDisable?.bookmarks?.showTimestamp).toBe(false);

      await setPopupCheckbox(popupPage, '#emojiMarkers-enabled', true);
      await savePopupSettings(popupPage, fixturePage);

      const markerStateAfterEnable = await getExtensionState(harnessPage, tabId);
      expect(markerStateAfterEnable.moduleStates?.emojiMarkers).toEqual({
        enabled: true,
        initialized: true,
      });

      await targetMessage.hover();
      await expect(fixturePage.locator('#claude-marker-fixed-btn')).toBeVisible();
      await expect(targetMessage.locator('.emoji-marker-badge')).toContainText('🔥');
    } finally {
      await popupPage.close();
    }

    assertNoPageErrors(fixturePage, ['ResizeObserver loop limit exceeded']);
  });

  test('popup keeps bookmark and emoji state intact while toggling edit history visibility and enable state', async ({
    fixturePage,
    harnessPage,
    extensionContext,
  }) => {
    const settings = cloneDefaultSettings();
    settings.editHistory.showFloatingUI = true;
    settings.bookmarks.showFloatingUI = true;
    settings.emojiMarkers.showFloatingUI = true;
    settings.navigation.showCounter = false;

    const { tabId } = await openFixture(
      fixturePage,
      harnessPage,
      CHAT_TEST_SURFACES.popup.modules,
      {
        settings,
      }
    );

    const firstMessage = getRenderedMessage(fixturePage, 0);
    const secondMessage = getRenderedMessage(fixturePage, 1);
    await addBookmarkToGeneral(fixturePage, firstMessage);
    await addMarker(fixturePage, secondMessage, '⭐');

    await expect(fixturePage.locator('.claude-edit-badge')).toHaveCount(2);
    await expect(fixturePage.locator('#claude-edit-fixed-btn')).toBeVisible();
    await expect(fixturePage.locator('#claude-bookmarks-fixed-btn')).toBeVisible();
    await expect(fixturePage.locator('#claude-marker-fixed-btn')).toBeVisible();

    const popupPage = await openPopupForTab(harnessPage, extensionContext, tabId);
    try {
      await clickPopupButton(popupPage, '#editHistory-floating-ui');
      await savePopupSettings(popupPage, fixturePage);

      await expect(fixturePage.locator('#claude-edit-fixed-btn')).toBeHidden();
      await expect(fixturePage.locator('.claude-edit-badge')).toHaveCount(2);

      await setPopupCheckbox(popupPage, '#editHistory-enabled', false);
      await savePopupSettings(popupPage, fixturePage);

      const historyStateAfterDisable = await getExtensionState(harnessPage, tabId);
      expect(historyStateAfterDisable.moduleStates?.editHistory).toEqual({
        enabled: false,
        initialized: false,
      });

      await expect(fixturePage.locator('#claude-edit-fixed-btn')).toHaveCount(0);
      await expect(fixturePage.locator('.claude-edit-badge')).toHaveCount(0);
      await expect(fixturePage.locator('#claude-bookmarks-fixed-btn')).toBeVisible();
      await expect(fixturePage.locator('#claude-marker-fixed-btn')).toBeVisible();

      const settingsAfterDisable = await readStoredSettings(harnessPage);
      expect(settingsAfterDisable?.navigation?.showCounter).toBe(false);
      expect(settingsAfterDisable?.editHistory?.showFloatingUI).toBe(false);

      await setPopupCheckbox(popupPage, '#editHistory-enabled', true);
      await savePopupSettings(popupPage, fixturePage);

      const historyStateAfterEnable = await getExtensionState(harnessPage, tabId);
      expect(historyStateAfterEnable.moduleStates?.editHistory).toEqual({
        enabled: true,
        initialized: true,
      });

      await expect(fixturePage.locator('.claude-edit-badge')).toHaveCount(2);
      await expect(fixturePage.locator('#claude-edit-fixed-btn')).toBeHidden();

      await clickPopupButton(popupPage, '#editHistory-floating-ui');
      await savePopupSettings(popupPage, fixturePage);

      await expect(fixturePage.locator('#claude-edit-fixed-btn')).toBeVisible();
      await expect(fixturePage.locator('#claude-bookmarks-fixed-btn')).toBeVisible();
      await expect(fixturePage.locator('#claude-marker-fixed-btn')).toBeVisible();
    } finally {
      await popupPage.close();
    }

    assertNoPageErrors(fixturePage, ['ResizeObserver loop limit exceeded']);
  });
});
