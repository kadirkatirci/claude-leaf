export function failedChecksMessage(result) {
  return result.evaluation.checks
    .filter(check => !check.pass)
    .map(check => `${check.id}: ${check.message}`)
    .join(' | ');
}

export function failedModuleChecksMessage(moduleSmoke) {
  return (moduleSmoke?.checks || [])
    .filter(check => !check.pass)
    .map(check => `${check.id}: ${check.message}`)
    .join(' | ');
}

export function buildCheck(id, pass, message) {
  return { id, pass, message };
}

export async function isVisible(locator) {
  try {
    return await locator.isVisible();
  } catch {
    return false;
  }
}

export function createModuleSmokeStatus({ installedExtension, requireExtension }) {
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

export async function collectModuleSmoke(page, target) {
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
