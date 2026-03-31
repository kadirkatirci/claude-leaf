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
      await harnessPage.evaluate(
        async payload => {
          await window.__clLeafTestHarness.setSettings(payload.settings, payload.tabId);
        },
        { settings, tabId }
      );

      await fixturePage.waitForTimeout(500);
      await expect(fixturePage.locator('#claude-nav-top')).toBeHidden();

      settings.navigation.showFloatingUI = true;
      await harnessPage.evaluate(
        async payload => {
          await window.__clLeafTestHarness.setSettings(payload.settings, payload.tabId);
        },
        { settings, tabId }
      );

      await fixturePage.waitForTimeout(600);
      await expect(fixturePage.locator('#claude-nav-top')).toBeVisible();
      await expect(counter).toHaveText(counterBeforeHide || '');

      assertNoPageErrors(fixturePage, ['ResizeObserver loop limit exceeded']);
    });
  }

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
});
