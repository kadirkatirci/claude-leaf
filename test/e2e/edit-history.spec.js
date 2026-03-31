import { assertNoPageErrors, openFixture, test, expect } from './support/extensionTest.js';
import { CHAT_TEST_SURFACES } from './support/chatFixtures.js';

test.describe('edit history module', () => {
  test('renders edit badges, modal and branch map on the medium real chat fixture', async ({
    fixturePage,
    harnessPage,
  }) => {
    await openFixture(fixturePage, harnessPage, CHAT_TEST_SURFACES.history.natural);

    const badges = fixturePage.locator('.claude-edit-badge');
    await expect(badges).toHaveCount(2);

    await fixturePage.locator('#claude-edit-fixed-btn').click();
    await expect(fixturePage.locator('#claude-edit-panel')).toBeVisible();
    await expect(fixturePage.locator('#claude-edit-panel')).toContainText('Edit Points');

    await badges.first().evaluate(element => element.click());
    await expect(fixturePage.locator('#claude-edit-modal-view')).toBeVisible();
    await expect(fixturePage.locator('#claude-edit-view-version')).toContainText('/');
    await fixturePage.keyboard.press('Escape');

    await fixturePage.locator('#claude-edit-fixed-btn').click();
    const branchMapButton = fixturePage.locator(
      '#claude-edit-panel button:has-text("Show Chat Branch Map")'
    );
    await branchMapButton.scrollIntoViewIfNeeded();
    await branchMapButton.click({ force: true });
    await expect(fixturePage.locator('#branch-map-content')).toBeVisible();

    assertNoPageErrors(fixturePage, ['ResizeObserver loop limit exceeded']);
  });

  test('detects multiple edited prompts on the long real chat fixture', async ({
    fixturePage,
    harnessPage,
  }) => {
    await openFixture(fixturePage, harnessPage, CHAT_TEST_SURFACES.history.dense);

    await expect(fixturePage.locator('.claude-edit-badge')).toHaveCount(3);
    await fixturePage.locator('#claude-edit-fixed-btn').click();
    await expect(fixturePage.locator('#claude-edit-panel')).toBeVisible();
    await expect(fixturePage.locator('#claude-edit-panel')).toContainText('Edit Points');

    const panelItems = fixturePage.locator(
      '#claude-edit-panel .p-2.overflow-y-auto.flex-1.bg-bg-000 > div'
    );
    await expect(panelItems).toHaveCount(3);

    assertNoPageErrors(fixturePage, ['ResizeObserver loop limit exceeded']);
  });

  test('reacts to synthetic inline edit sessions', async ({ fixturePage, harnessPage }) => {
    await openFixture(fixturePage, harnessPage, CHAT_TEST_SURFACES.history.controlled);

    const opened = await fixturePage.evaluate(() =>
      window.__claudeFixture.openEditForm(
        'edit-index-2',
        'Reword this prompt to include popup sync regression checks.'
      )
    );
    expect(opened).toBe(true);

    await fixturePage.waitForSelector('[data-fixture-edit-form="true"]');
    const submitted = await fixturePage.evaluate(() =>
      window.__claudeFixture.submitEdit('edit-index-2', '4 / 4')
    );
    expect(submitted).toBe(true);

    await fixturePage.waitForTimeout(400);
    await expect(
      fixturePage.locator(
        '[data-edit-container-id="edit-index-2"] .inline-flex.items-center.gap-1 span'
      )
    ).toHaveText('4 / 4');

    assertNoPageErrors(fixturePage, ['ResizeObserver loop limit exceeded']);
  });

  test('supports cancelling a synthetic inline edit session without mutating version state', async ({
    fixturePage,
    harnessPage,
  }) => {
    await openFixture(fixturePage, harnessPage, CHAT_TEST_SURFACES.history.controlled);

    const target = fixturePage.locator('[data-edit-container-id="edit-index-0"]');
    const originalVersion = await target
      .locator('.inline-flex.items-center.gap-1 span')
      .textContent();

    const opened = await fixturePage.evaluate(() =>
      window.__claudeFixture.openEditForm(
        'edit-index-0',
        'Cancel this edit to make sure the draft form closes cleanly.'
      )
    );
    expect(opened).toBe(true);

    await fixturePage.waitForSelector('[data-fixture-edit-form="true"]');
    await fixturePage.locator('[data-fixture-edit-form="true"] button[type="button"]').click();
    await expect(fixturePage.locator('[data-fixture-edit-form="true"]')).toHaveCount(0);
    await expect(target.locator('.inline-flex.items-center.gap-1 span')).toHaveText(
      originalVersion || ''
    );

    assertNoPageErrors(fixturePage, ['ResizeObserver loop limit exceeded']);
  });
});
