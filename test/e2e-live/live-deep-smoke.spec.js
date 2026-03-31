import path from 'node:path';
import { resolveChatTarget } from '../../scripts/fixtures/lib/chatFixtureConfig.js';
import {
  assertNoPageErrors,
  clearPageErrors,
  ensureHarnessPage,
  expect,
  getLiveTabId,
  getPageErrors,
  getRenderedMessage,
  navigateAndCollect,
  openLivePopupForTab,
  resetLiveTab,
  screenshotPath,
  seedLiveSettings,
  test,
  tryGetExtensionState,
  writeLiveReport,
} from './support/liveTest.js';
import {
  buildCheck,
  collectModuleSmoke,
  createModuleSmokeStatus,
  failedChecksMessage,
  failedModuleChecksMessage,
  isVisible,
} from './support/liveSmokeHelpers.js';

function resolveDeepTargetName() {
  return process.env.CLAUDE_LEAF_LIVE_TARGET || 'long';
}

async function waitForScrollSettled(page, waitMs = 600) {
  await page.waitForTimeout(waitMs);
}

async function getElementViewportTop(locator) {
  return locator.evaluate(element => Math.round(element.getBoundingClientRect().top));
}

function isViewportAnchored(top) {
  return top > -100 && top < 700;
}

async function collectDeepChecks(page, popupPage, target) {
  const checks = [];
  const counts = {};

  const counter = page.locator('#claude-nav-counter');
  const navNext = page.locator('#claude-nav-next');
  const navPrev = page.locator('#claude-nav-prev');
  const navTop = page.locator('#claude-nav-top');

  const initialCounter = ((await counter.textContent()) || '').trim();
  const initialScroll = await page.evaluate(() => window.scrollY);
  await navNext.click();
  await waitForScrollSettled(page);
  const afterNextCounter = ((await counter.textContent()) || '').trim();
  const afterNextScroll = await page.evaluate(() => window.scrollY);

  checks.push(
    buildCheck(
      'nav_next',
      afterNextCounter !== initialCounter,
      afterNextCounter !== initialCounter
        ? `Navigation next moved from ${initialCounter} to ${afterNextCounter}`
        : `Navigation next did not advance. before=${initialCounter} after=${afterNextCounter}, scrollBefore=${initialScroll}, scrollAfter=${afterNextScroll}`
    )
  );

  await navPrev.click();
  await waitForScrollSettled(page);
  const afterPrevCounter = ((await counter.textContent()) || '').trim();
  checks.push(
    buildCheck(
      'nav_prev',
      afterPrevCounter === initialCounter,
      afterPrevCounter === initialCounter
        ? `Navigation prev restored ${initialCounter}`
        : `Navigation prev did not restore initial counter. got=${afterPrevCounter}`
    )
  );

  await page.keyboard.press('Alt+ArrowDown');
  await waitForScrollSettled(page);
  const afterShortcutCounter = ((await counter.textContent()) || '').trim();
  checks.push(
    buildCheck(
      'nav_shortcut',
      afterShortcutCounter !== initialCounter,
      afterShortcutCounter !== initialCounter
        ? `Alt+ArrowDown advanced to ${afterShortcutCounter}`
        : 'Alt+ArrowDown did not advance the navigation counter'
    )
  );

  await page.keyboard.press('Alt+Home');
  await waitForScrollSettled(page, 900);
  const afterHomeScroll = await page.evaluate(() => window.scrollY);
  await navTop.click();
  await waitForScrollSettled(page, 900);
  const afterTopScroll = await page.evaluate(() => window.scrollY);
  checks.push(
    buildCheck(
      'nav_home',
      afterHomeScroll < 100 && afterTopScroll < 100,
      afterHomeScroll < 100 && afterTopScroll < 100
        ? 'Alt+Home and top button return the page to the top'
        : `Expected top navigation to return near the top. home=${afterHomeScroll}, top=${afterTopScroll}`
    )
  );

  const bookmarkMessage = getRenderedMessage(page, 2);
  await bookmarkMessage.hover();
  const bookmarkButton = bookmarkMessage.locator('.claude-bookmark-btn');
  await expect(bookmarkButton).toBeVisible();
  await bookmarkButton.click();
  const categoryPopover = page.locator('.claude-category-popover');
  await expect(categoryPopover).toBeVisible();
  await categoryPopover.getByText('General').click();
  await expect(page.locator('#claude-bookmarks-fixed-btn')).toBeVisible();
  await page.locator('#claude-bookmarks-fixed-btn').click();
  const bookmarkPanel = page.locator('#claude-bookmarks-panel');
  await expect(bookmarkPanel).toBeVisible();
  const bookmarkItems = bookmarkPanel.locator('.p-3');
  const bookmarkItemCount = await bookmarkItems.count();
  counts.bookmarkItems = bookmarkItemCount;
  checks.push(
    buildCheck(
      'bookmark_add',
      bookmarkItemCount >= 1,
      bookmarkItemCount >= 1
        ? `Bookmark panel lists ${bookmarkItemCount} item(s)`
        : 'Bookmark panel did not list the newly created bookmark'
    )
  );

  await page.evaluate(() => {
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'auto' });
  });
  await waitForScrollSettled(page, 300);
  await bookmarkItems.first().click();
  await waitForScrollSettled(page, 700);
  const bookmarkHighlighted = await bookmarkMessage.evaluate(element =>
    element.classList.contains('claude-nav-highlight')
  );
  const bookmarkTargetTop = await getElementViewportTop(bookmarkMessage);
  checks.push(
    buildCheck(
      'bookmark_navigate',
      bookmarkHighlighted && isViewportAnchored(bookmarkTargetTop),
      bookmarkHighlighted && isViewportAnchored(bookmarkTargetTop)
        ? `Bookmark panel navigated back to the target message at top=${bookmarkTargetTop}`
        : `Bookmark navigation did not focus the target message. highlight=${bookmarkHighlighted}, top=${bookmarkTargetTop}`
    )
  );

  const markerMessage = getRenderedMessage(page, 4);
  await markerMessage.hover();
  const markerButton = markerMessage.locator('.emoji-marker-btn');
  await expect(markerButton).toBeVisible();
  await markerButton.evaluate(element => element.click());
  await page.getByRole('button', { name: '⭐' }).first().click();
  const markerBadge = markerMessage.locator('.emoji-marker-badge');
  await expect(markerBadge).toContainText('⭐');
  await page.locator('#claude-marker-fixed-btn').click();
  const markerPanel = page.locator('#claude-marker-panel');
  await expect(markerPanel).toBeVisible();
  const markerItems = markerPanel.locator('.panel-items > div');
  const markerItemCount = await markerItems.count();
  counts.markerItems = markerItemCount;
  checks.push(
    buildCheck(
      'marker_add',
      markerItemCount >= 1,
      markerItemCount >= 1
        ? `Marker panel lists ${markerItemCount} item(s)`
        : 'Marker panel did not list the newly created marker'
    )
  );

  await page.evaluate(() => {
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'auto' });
  });
  await waitForScrollSettled(page, 300);
  await markerItems.first().click();
  await waitForScrollSettled(page, 700);
  const markerHighlighted = await markerMessage.evaluate(element =>
    element.classList.contains('claude-nav-highlight')
  );
  const markerTargetTop = await getElementViewportTop(markerMessage);
  checks.push(
    buildCheck(
      'marker_navigate',
      markerHighlighted && isViewportAnchored(markerTargetTop),
      markerHighlighted && isViewportAnchored(markerTargetTop)
        ? `Marker panel navigated back to the marked message at top=${markerTargetTop}`
        : `Marker navigation did not focus the marked message. highlight=${markerHighlighted}, top=${markerTargetTop}`
    )
  );

  if ((target.features || []).includes('editHistory')) {
    const editButton = page.locator('#claude-edit-fixed-btn');
    const editBadges = page.locator('.claude-edit-badge');
    const editBadgeCount = await editBadges.count();
    counts.editBadges = editBadgeCount;

    await expect(editButton).toBeVisible();
    await editButton.click();
    const editPanel = page.locator('#claude-edit-panel');
    await expect(editPanel).toBeVisible();
    const editPanelItems = editPanel.locator('.p-2.overflow-y-auto.flex-1.bg-bg-000 > div');
    const editPanelItemCount = await editPanelItems.count();
    counts.editPanelItems = editPanelItemCount;
    checks.push(
      buildCheck(
        'edit_panel_items',
        editPanelItemCount >= (target.smoke?.minEditedMessages || 1),
        editPanelItemCount >= (target.smoke?.minEditedMessages || 1)
          ? `Edit panel lists ${editPanelItemCount} item(s)`
          : `Edit panel expected at least ${target.smoke?.minEditedMessages || 1} item(s), found ${editPanelItemCount}`
      )
    );

    await editBadges.first().evaluate(element => element.click());
    const editModal = page.locator('#claude-edit-modal-view');
    await expect(editModal).toBeVisible();
    const versionLabel = (
      (await page.locator('#claude-edit-view-version').textContent()) || ''
    ).trim();
    checks.push(
      buildCheck(
        'edit_modal',
        /^\d+\s*\/\s*\d+$/.test(versionLabel),
        /^\d+\s*\/\s*\d+$/.test(versionLabel)
          ? `Edit modal opened on version ${versionLabel}`
          : `Edit modal version label missing or malformed: ${versionLabel || '(empty)'}`
      )
    );
    await page.keyboard.press('Escape');

    await editButton.click();
    const branchMapButton = page.locator(
      '#claude-edit-panel button:has-text("Show Chat Branch Map")'
    );
    await branchMapButton.scrollIntoViewIfNeeded();
    await branchMapButton.click({ force: true });
    const branchMap = page.locator('#branch-map-content');
    await expect(branchMap).toBeVisible();
    const branchMapVisible = await isVisible(branchMap);
    checks.push(
      buildCheck(
        'branch_map',
        branchMapVisible,
        branchMapVisible ? 'Branch map modal opened' : 'Branch map modal did not open'
      )
    );
    await page.keyboard.press('Escape');
  }

  if (popupPage) {
    const navigationVisibility = popupPage.locator('#navigation-floating-ui');
    const navTopVisibleBefore = await isVisible(page.locator('#claude-nav-top'));

    await navigationVisibility.click();
    await popupPage.locator('#save-btn').click();
    await waitForScrollSettled(page, 800);
    const navTopHidden = !(await isVisible(page.locator('#claude-nav-top')));

    await navigationVisibility.click();
    await popupPage.locator('#save-btn').click();
    await waitForScrollSettled(page, 800);
    const navTopVisibleAgain = await isVisible(page.locator('#claude-nav-top'));

    checks.push(
      buildCheck(
        'popup_navigation_visibility',
        navTopVisibleBefore && navTopHidden && navTopVisibleAgain,
        navTopVisibleBefore && navTopHidden && navTopVisibleAgain
          ? 'Popup save hides and restores navigation controls on the live chat'
          : `Popup-driven navigation visibility toggle failed. before=${navTopVisibleBefore} hidden=${navTopHidden} restored=${navTopVisibleAgain}`
      )
    );
  }

  return {
    checks,
    counts,
    pass: checks.every(check => check.pass),
  };
}

test.describe('live claude chat deep smoke', () => {
  test('runs a deeper safe interaction sweep against a single configured live chat', async ({
    liveSession,
    livePage,
  }) => {
    const targetName = resolveDeepTargetName();
    const target = await resolveChatTarget(targetName);
    const report = {
      generatedAt: new Date().toISOString(),
      artifactDir: liveSession.artifactDir,
      targetName,
      installedExtension: liveSession.installedExtension,
      requireExtension: true,
    };

    clearPageErrors(livePage);

    const result = await navigateAndCollect(livePage, 'chat', target.url, 7_000, target.smoke);
    result.targetName = target.targetName;
    result.pageErrors = getPageErrors(livePage);

    expect(
      result.evaluation.pass,
      `Live ${targetName} deep smoke route failed: ${failedChecksMessage(result)}`
    ).toBe(true);

    const moduleSmokeStatus = createModuleSmokeStatus({
      installedExtension: liveSession.installedExtension,
      requireExtension: true,
    });
    expect(
      moduleSmokeStatus.pass,
      `Live ${targetName} deep smoke preflight failed: ${failedModuleChecksMessage(moduleSmokeStatus)}`
    ).toBe(true);

    const harnessPage = await ensureHarnessPage(liveSession);
    const tabId = await getLiveTabId(harnessPage, result.pathname);
    expect(
      tabId,
      `Live ${targetName} deep smoke could not resolve the active Claude tab`
    ).toBeTruthy();

    await resetLiveTab(harnessPage, tabId);
    await seedLiveSettings(harnessPage, liveSession.settings, tabId);
    await livePage.reload({ waitUntil: 'domcontentloaded' });
    await waitForScrollSettled(livePage, 1500);
    clearPageErrors(livePage);

    result.moduleSmoke = await collectModuleSmoke(livePage, target);
    expect(
      result.moduleSmoke.pass,
      `Live ${targetName} deep smoke basic module checks failed: ${failedModuleChecksMessage(result.moduleSmoke)}`
    ).toBe(true);

    result.extension = await tryGetExtensionState(harnessPage, result.pathname);
    expect(
      result.extension.available,
      `Live ${targetName} deep smoke could not read extension state: ${result.extension.error || 'unknown error'}`
    ).toBe(true);

    const popupPage = await openLivePopupForTab(harnessPage, liveSession, tabId);

    try {
      result.deepSmoke = await collectDeepChecks(livePage, popupPage, target);
    } finally {
      await popupPage.close();
    }

    expect(
      result.deepSmoke.pass,
      `Live ${targetName} deep smoke failed: ${failedModuleChecksMessage(result.deepSmoke)}`
    ).toBe(true);

    assertNoPageErrors(livePage, ['ResizeObserver loop limit exceeded']);

    const screenshotName = `chat-${targetName}-deep`;
    result.screenshot = path.basename(screenshotPath(liveSession.artifactDir, screenshotName));
    await livePage.screenshot({
      path: screenshotPath(liveSession.artifactDir, screenshotName),
      fullPage: false,
    });

    report.result = result;
    report.reportPath = await writeLiveReport(liveSession.artifactDir, report);
  });
});
