import { assertNoPageErrors, openFixture, test, expect } from './support/extensionTest.js';
import { REAL_CHAT_FIXTURES, SYNTHETIC_CHAT_FIXTURES } from './support/chatFixtures.js';

test.describe('fixture contracts', () => {
  const cases = [
    [REAL_CHAT_FIXTURES.short, 'conversation', true, 'sanitized_html'],
    [REAL_CHAT_FIXTURES.medium, 'conversation', true, 'sanitized_html'],
    [REAL_CHAT_FIXTURES.long, 'conversation', true, 'sanitized_html'],
    [SYNTHETIC_CHAT_FIXTURES.streaming, 'conversation', true, 'seed'],
    [SYNTHETIC_CHAT_FIXTURES.editedThread, 'conversation', true, 'seed'],
  ];

  for (const [fixtureId, expectedPageType, expectsNav, expectedSourceMode] of cases) {
    test(`${fixtureId} initializes on the expected route`, async ({ fixturePage, harnessPage }) => {
      const { fixture } = await openFixture(fixturePage, harnessPage, fixtureId);

      expect(new URL(fixturePage.url()).pathname).toBe(fixture.route);
      expect(fixture.meta.pageType).toBe(expectedPageType);
      expect(fixture.meta.sourceMode).toBe(expectedSourceMode);

      if (expectsNav) {
        await expect(fixturePage.locator('#claude-nav-container')).toBeVisible();
      } else {
        await expect(fixturePage.locator('#claude-nav-container')).toBeHidden();
      }

      assertNoPageErrors(fixturePage, ['ResizeObserver loop limit exceeded']);
    });
  }

  test('streaming fixture settles without live network access', async ({
    fixturePage,
    harnessPage,
  }) => {
    await openFixture(fixturePage, harnessPage, SYNTHETIC_CHAT_FIXTURES.streaming);

    await fixturePage.evaluate(() => window.__claudeFixture.finishStreaming(6));
    await fixturePage.waitForTimeout(400);

    const streamingCount = await fixturePage.locator('[data-is-streaming="true"]').count();
    expect(streamingCount).toBe(0);

    assertNoPageErrors(fixturePage, ['ResizeObserver loop limit exceeded']);
  });

  test('read-only capture-backed fixtures expose helper API without mutation support', async ({
    fixturePage,
    harnessPage,
  }) => {
    await openFixture(fixturePage, harnessPage, REAL_CHAT_FIXTURES.medium);

    const helperState = await fixturePage.evaluate(() => ({
      sourceMode: window.__claudeFixture.getState().meta.sourceMode,
      mutable: window.__claudeFixture.getState().meta.helpers.mutable,
      appendResult: window.__claudeFixture.appendTurn({ role: 'user', text: 'noop' }),
      editResult: window.__claudeFixture.openEditForm('edit-index-0', 'noop'),
      toggleResult: window.__claudeFixture.toggleSidebarSection('Recent'),
    }));

    expect(helperState).toEqual({
      sourceMode: 'sanitized_html',
      mutable: false,
      appendResult: false,
      editResult: false,
      toggleResult: false,
    });

    assertNoPageErrors(fixturePage, ['ResizeObserver loop limit exceeded']);
  });
});
