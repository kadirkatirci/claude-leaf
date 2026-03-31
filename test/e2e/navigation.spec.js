import { cloneDefaultSettings } from '../../src/config/defaultSettings.js';
import {
  assertNoPageErrors,
  getRenderedMessage,
  openFixture,
  test,
  expect,
  DEFAULT_VIEWPORT,
  NARROW_VIEWPORT,
} from './support/extensionTest.js';
import { CHAT_TEST_SURFACES } from './support/chatFixtures.js';

async function applySettings(harnessPage, tabId, settings) {
  await harnessPage.evaluate(
    async payload => {
      await window.__clLeafTestHarness.setSettings(payload.settings, payload.tabId);
    },
    { settings, tabId }
  );
}

async function dispatchNavigationShortcut(page, key) {
  await page.evaluate(shortcutKey => {
    document.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: shortcutKey,
        altKey: true,
        bubbles: true,
        cancelable: true,
      })
    );
  }, key);
}

test.describe('navigation module', () => {
  const viewports = [DEFAULT_VIEWPORT, NARROW_VIEWPORT];

  for (const viewport of viewports) {
    test(`updates counter and scrolls through messages at ${viewport.width}x${viewport.height}`, async ({
      fixturePage,
      harnessPage,
    }) => {
      await openFixture(fixturePage, harnessPage, CHAT_TEST_SURFACES.navigation.thread, {
        viewport,
      });
      await fixturePage.waitForTimeout(800);

      const counter = fixturePage.locator('#claude-nav-counter');
      const firstMessage = getRenderedMessage(fixturePage, 0);
      await expect(counter).toContainText('/');

      const initialCounter = await counter.textContent();
      const initialScroll = await fixturePage.evaluate(() => window.scrollY);

      await fixturePage.locator('#claude-nav-next').click();
      await fixturePage.waitForTimeout(350);

      const afterNextScroll = await fixturePage.evaluate(() => window.scrollY);
      const afterNextCounter = await counter.textContent();
      expect(afterNextScroll).toBeGreaterThan(initialScroll);
      expect(afterNextCounter).not.toEqual(initialCounter);

      await fixturePage.locator('#claude-nav-prev').click();
      await fixturePage.waitForTimeout(500);
      const afterPrevCounter = await counter.textContent();
      expect(afterPrevCounter).toEqual(initialCounter);

      await fixturePage.locator('#claude-nav-top').click();
      await fixturePage.waitForTimeout(700);
      const backToTop = await fixturePage.evaluate(() => window.scrollY);
      const firstMessageTop = await firstMessage.evaluate(element => {
        return Math.round(element.getBoundingClientRect().top);
      });
      expect(backToTop).toBeLessThanOrEqual(afterNextScroll);
      expect(firstMessageTop).toBeLessThan(80);

      assertNoPageErrors(fixturePage, ['ResizeObserver loop limit exceeded']);
    });
  }

  test('tracks manual scrolling through the intersection observer on the long real chat fixture', async ({
    fixturePage,
    harnessPage,
  }) => {
    await openFixture(fixturePage, harnessPage, CHAT_TEST_SURFACES.navigation.thread);
    await fixturePage.waitForTimeout(800);

    const counter = fixturePage.locator('#claude-nav-counter');

    for (const index of [6, 14]) {
      const target = getRenderedMessage(fixturePage, index);
      await target.evaluate(element => {
        element.scrollIntoView({ block: 'center', behavior: 'auto' });
      });

      await expect(counter).toHaveText(new RegExp(`^${index + 1}/`));
    }

    assertNoPageErrors(fixturePage, ['ResizeObserver loop limit exceeded']);
  });

  for (const viewport of viewports) {
    test(`preserves counter state when floating controls are toggled off and back on at ${viewport.width}x${viewport.height}`, async ({
      fixturePage,
      harnessPage,
    }) => {
      const settings = cloneDefaultSettings();
      settings.navigation.showFloatingUI = true;

      const { tabId } = await openFixture(
        fixturePage,
        harnessPage,
        CHAT_TEST_SURFACES.navigation.thread,
        {
          settings,
          viewport,
        }
      );

      const counter = fixturePage.locator('#claude-nav-counter');
      await fixturePage.locator('#claude-nav-next').click();
      await fixturePage.waitForTimeout(350);
      const counterBeforeHide = await counter.textContent();

      settings.navigation.showFloatingUI = false;
      await applySettings(harnessPage, tabId, settings);

      await fixturePage.waitForTimeout(500);
      await expect(fixturePage.locator('#claude-nav-top')).toBeHidden();

      settings.navigation.showFloatingUI = true;
      await applySettings(harnessPage, tabId, settings);

      await fixturePage.waitForTimeout(600);
      await expect(fixturePage.locator('#claude-nav-top')).toBeVisible();
      await expect(counter).toHaveText(counterBeforeHide || '');

      assertNoPageErrors(fixturePage, ['ResizeObserver loop limit exceeded']);
    });
  }

  test('applies position, opacity and counter visibility setting changes', async ({
    fixturePage,
    harnessPage,
  }) => {
    const settings = cloneDefaultSettings();
    const { tabId } = await openFixture(
      fixturePage,
      harnessPage,
      CHAT_TEST_SURFACES.navigation.thread,
      {
        settings,
      }
    );

    settings.navigation.position = 'left';
    settings.navigation.showCounter = false;
    settings.general.opacity = 0.4;
    await applySettings(harnessPage, tabId, settings);

    const container = fixturePage.locator('#claude-nav-container');
    const counter = fixturePage.locator('#claude-nav-counter');

    await expect
      .poll(async () => {
        return container.evaluate(element => ({
          left: element.style.left,
          right: element.style.right,
          opacity: element.style.opacity,
        }));
      })
      .toEqual({
        left: '30px',
        right: 'auto',
        opacity: '0.4',
      });
    await expect(counter).toBeHidden();

    settings.navigation.position = 'right';
    settings.navigation.showCounter = true;
    settings.general.opacity = 0.7;
    await applySettings(harnessPage, tabId, settings);

    await expect
      .poll(async () => {
        return container.evaluate(element => ({
          left: element.style.left,
          right: element.style.right,
          opacity: element.style.opacity,
        }));
      })
      .toEqual({
        left: 'auto',
        right: '30px',
        opacity: '0.7',
      });
    await expect(counter).toBeVisible();

    assertNoPageErrors(fixturePage, ['ResizeObserver loop limit exceeded']);
  });

  for (const viewport of viewports) {
    test(`supports navigation keyboard shortcuts on real chat fixtures at ${viewport.width}x${viewport.height}`, async ({
      fixturePage,
      harnessPage,
    }) => {
      await openFixture(fixturePage, harnessPage, CHAT_TEST_SURFACES.navigation.keyboard, {
        viewport,
      });
      await fixturePage.waitForTimeout(800);

      const counter = fixturePage.locator('#claude-nav-counter');
      const initialCounter = await counter.textContent();

      await fixturePage.keyboard.press('Alt+ArrowDown');
      await fixturePage.waitForTimeout(500);
      const afterNext = await counter.textContent();
      expect(afterNext).not.toEqual(initialCounter);

      await fixturePage.keyboard.press('Alt+ArrowUp');
      await fixturePage.waitForTimeout(500);
      await expect(counter).toHaveText(initialCounter || '');

      await fixturePage.keyboard.press('Alt+Home');
      await fixturePage.waitForTimeout(700);
      expect(await fixturePage.evaluate(() => window.scrollY)).toBeLessThan(80);

      assertNoPageErrors(fixturePage, ['ResizeObserver loop limit exceeded']);
    });
  }

  test('disables and restores navigation keyboard shortcuts through settings updates', async ({
    fixturePage,
    harnessPage,
  }) => {
    const settings = cloneDefaultSettings();
    const { tabId } = await openFixture(
      fixturePage,
      harnessPage,
      CHAT_TEST_SURFACES.navigation.keyboard,
      {
        settings,
      }
    );
    await fixturePage.waitForTimeout(800);

    const counter = fixturePage.locator('#claude-nav-counter');
    const initialCounter = await counter.textContent();

    settings.navigation.keyboardShortcuts = false;
    await applySettings(harnessPage, tabId, settings);
    await fixturePage.waitForTimeout(400);

    await dispatchNavigationShortcut(fixturePage, 'ArrowDown');
    await fixturePage.waitForTimeout(500);
    await expect(counter).toHaveText(initialCounter || '');

    settings.navigation.keyboardShortcuts = true;
    await applySettings(harnessPage, tabId, settings);
    await fixturePage.waitForTimeout(400);

    await dispatchNavigationShortcut(fixturePage, 'ArrowDown');
    await expect(counter).not.toHaveText(initialCounter || '');

    assertNoPageErrors(fixturePage, ['ResizeObserver loop limit exceeded']);
  });
});
