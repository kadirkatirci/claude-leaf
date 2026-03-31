import path from 'node:path';
import { resolveOrderedChatTargets } from '../../scripts/fixtures/lib/chatFixtureConfig.js';
import {
  clearPageErrors,
  ensureHarnessPage,
  expect,
  getPageErrors,
  navigateAndCollect,
  screenshotPath,
  test,
  tryGetExtensionState,
  writeLiveReport,
} from './support/liveTest.js';

function failedChecksMessage(result) {
  return result.evaluation.checks
    .filter(check => !check.pass)
    .map(check => `${check.id}: ${check.message}`)
    .join(' | ');
}

function failedModuleChecksMessage(moduleSmoke) {
  return (moduleSmoke?.checks || [])
    .filter(check => !check.pass)
    .map(check => `${check.id}: ${check.message}`)
    .join(' | ');
}

function buildCheck(id, pass, message) {
  return { id, pass, message };
}

async function isVisible(locator) {
  try {
    return await locator.isVisible();
  } catch {
    return false;
  }
}

function createModuleSmokeStatus({ installedExtension, requireExtension }) {
  if (installedExtension?.installed && installedExtension?.enabled) {
    return {
      enabled: true,
      pass: true,
      skipped: false,
      checks: [],
      counts: {},
    };
  }

  const reason = installedExtension?.installed
    ? 'Claude Leaf is installed in the Test profile but disabled. Re-enable it in chrome://extensions and retry.'
    : 'Claude Leaf is not installed in the Test profile. In Chrome 137+ official Google Chrome ignores --load-extension, so load the repo once via chrome://extensions > Developer mode > Load unpacked.';

  return {
    enabled: false,
    skipped: !requireExtension,
    pass: !requireExtension,
    checks: [
      buildCheck(
        'extension_setup',
        !requireExtension,
        requireExtension ? reason : `Skipped live module smoke. ${reason}`
      ),
    ],
    counts: {},
  };
}

async function collectModuleSmoke(page, target) {
  const features = new Set(target.features || []);
  const checks = [];
  const counts = {};

  const navContainer = page.locator('#claude-nav-container');
  const bookmarkButton = page.locator('#claude-bookmarks-fixed-btn');
  const markerButton = page.locator('#claude-marker-fixed-btn');
  const editButton = page.locator('#claude-edit-fixed-btn');
  const editBadges = page.locator('.claude-edit-badge');

  if (features.has('navigation')) {
    const navVisible = await isVisible(navContainer);
    const navButtonCount = navVisible ? await navContainer.locator('button').count() : 0;
    counts.navButtons = navButtonCount;
    checks.push(
      buildCheck(
        'nav_container',
        navVisible,
        navVisible ? 'Navigation panel attached' : 'Navigation panel missing'
      )
    );
    checks.push(
      buildCheck(
        'nav_buttons',
        navButtonCount >= 3,
        navButtonCount >= 3
          ? `Navigation panel exposes ${navButtonCount} controls`
          : `Expected at least 3 navigation controls, found ${navButtonCount}`
      )
    );
  }

  if (features.has('bookmarks')) {
    const bookmarkVisible = await isVisible(bookmarkButton);
    checks.push(
      buildCheck(
        'bookmark_button',
        bookmarkVisible,
        bookmarkVisible ? 'Bookmark fixed button attached' : 'Bookmark fixed button missing'
      )
    );

    if (bookmarkVisible) {
      await bookmarkButton.click();
      const bookmarkPanel = page.locator('#claude-bookmarks-panel');
      const panelVisible = await isVisible(bookmarkPanel);
      checks.push(
        buildCheck(
          'bookmark_panel',
          panelVisible,
          panelVisible ? 'Bookmark panel opens' : 'Bookmark panel did not open'
        )
      );

      if (panelVisible) {
        await page.keyboard.press('Escape');
      }
    }
  }

  if (features.has('emojiMarkers')) {
    const markerVisible = await isVisible(markerButton);
    checks.push(
      buildCheck(
        'marker_button',
        markerVisible,
        markerVisible ? 'Marker fixed button attached' : 'Marker fixed button missing'
      )
    );

    if (markerVisible) {
      await markerButton.click();
      const markerPanel = page.locator('#claude-marker-panel');
      const panelVisible = await isVisible(markerPanel);
      checks.push(
        buildCheck(
          'marker_panel',
          panelVisible,
          panelVisible ? 'Marker panel opens' : 'Marker panel did not open'
        )
      );

      if (panelVisible) {
        await page.keyboard.press('Escape');
      }
    }
  }

  if (features.has('editHistory')) {
    const editVisible = await isVisible(editButton);
    checks.push(
      buildCheck(
        'edit_button',
        editVisible,
        editVisible ? 'Edit history fixed button attached' : 'Edit history fixed button missing'
      )
    );

    const editBadgeCount = await editBadges.count();
    counts.editBadges = editBadgeCount;
    const minEditedMessages = target.smoke?.minEditedMessages || 1;
    checks.push(
      buildCheck(
        'edit_badges',
        editBadgeCount >= minEditedMessages,
        editBadgeCount >= minEditedMessages
          ? `Detected ${editBadgeCount} edit badges`
          : `Expected at least ${minEditedMessages} edit badges, found ${editBadgeCount}`
      )
    );

    if (editVisible) {
      await editButton.click();
      const editPanel = page.locator('#claude-edit-panel');
      const panelVisible = await isVisible(editPanel);
      checks.push(
        buildCheck(
          'edit_panel',
          panelVisible,
          panelVisible ? 'Edit history panel opens' : 'Edit history panel did not open'
        )
      );

      if (panelVisible) {
        await page.keyboard.press('Escape');
      }
    }
  }

  return {
    checks,
    counts,
    pass: checks.every(check => check.pass),
  };
}

test.describe('live claude chat smoke', () => {
  test('authenticated Test profile can open the configured short, medium and long chat targets', async ({
    liveSession,
    livePage,
  }) => {
    const targets = await resolveOrderedChatTargets();
    const report = {
      generatedAt: new Date().toISOString(),
      artifactDir: liveSession.artifactDir,
      profileName: liveSession.cloneMetadata.profileName,
      profileDirectory: liveSession.cloneMetadata.profileDirectory,
      browserPath: liveSession.cloneMetadata.browserPath,
      installedExtension: liveSession.installedExtension,
      requireExtension: liveSession.requireExtension,
      targets: [],
    };

    const moduleSmokeStatus = createModuleSmokeStatus({
      installedExtension: liveSession.installedExtension,
      requireExtension: liveSession.requireExtension,
    });

    for (const target of targets) {
      clearPageErrors(livePage);

      const result = await navigateAndCollect(livePage, 'chat', target.url, 7_000, target.smoke);
      result.targetName = target.targetName;
      result.pageErrors = getPageErrors(livePage);
      result.moduleSmoke = moduleSmokeStatus.enabled
        ? await collectModuleSmoke(livePage, target)
        : moduleSmokeStatus;

      try {
        const harnessPage = await ensureHarnessPage(liveSession);
        result.extension = await tryGetExtensionState(harnessPage, result.pathname);
      } catch (error) {
        result.extension = {
          available: false,
          tabId: null,
          state: null,
          error: String(error),
        };
      }

      const screenshotName = `chat-${target.targetName}`;
      result.screenshot = path.basename(screenshotPath(liveSession.artifactDir, screenshotName));
      await livePage.screenshot({
        path: screenshotPath(liveSession.artifactDir, screenshotName),
        fullPage: false,
      });

      report.targets.push(result);

      expect(
        result.evaluation.pass,
        `Live ${target.targetName} chat failed: ${failedChecksMessage(result)}`
      ).toBe(true);
      if (liveSession.requireExtension) {
        expect(
          result.moduleSmoke.pass,
          `Live ${target.targetName} module smoke failed: ${failedModuleChecksMessage(result.moduleSmoke)}`
        ).toBe(true);
      }
    }

    report.reportPath = await writeLiveReport(liveSession.artifactDir, report);
  });
});
