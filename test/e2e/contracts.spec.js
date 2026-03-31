import { assertNoPageErrors, openFixture, test, expect } from './support/extensionTest.js';

test.describe('fixture contracts', () => {
  const cases = [
    ['chat-real-short', 'conversation', true, 'sanitized_html'],
    ['chat-real-medium', 'conversation', true, 'sanitized_html'],
    ['chat-real-long', 'conversation', true, 'sanitized_html'],
    ['chat-streaming', 'conversation', true, 'seed'],
    ['chat-edited-thread', 'conversation', true, 'seed'],
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
    await openFixture(fixturePage, harnessPage, 'chat-streaming');

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
    await openFixture(fixturePage, harnessPage, 'chat-real-medium');

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
