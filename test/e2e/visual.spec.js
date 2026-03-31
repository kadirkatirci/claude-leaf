import {
  getRenderedMessage,
  NARROW_VIEWPORT,
  openFixture,
  test,
  expect,
  writeStoreData,
} from './support/extensionTest.js';
import { CHAT_TEST_SURFACES } from './support/chatFixtures.js';

function createSeededBookmarks(route) {
  return {
    categories: [
      {
        id: 'focus',
        name: 'Focus',
        color: '#ef4444',
        type: 'category',
        createdAt: '2026-03-31T10:00:00.000Z',
      },
    ],
    bookmarks: [
      {
        id: 'bookmark-user-migration',
        conversationUrl: route,
        categoryId: 'default',
        sender: 'user',
        previewText: 'Migration checklist for the next release review',
        fullText:
          'Migration checklist for the next release review with rollout notes and migration tasks.',
        timestamp: Date.parse('2026-03-31T10:10:00.000Z'),
        createdAt: '2026-03-31T10:10:00.000Z',
      },
      {
        id: 'bookmark-assistant-release',
        conversationUrl: route,
        categoryId: 'focus',
        sender: 'assistant',
        previewText: 'Release checklist with validation and rollback notes',
        fullText:
          'Release checklist with validation steps, rollback notes, and launch coordination.',
        timestamp: Date.parse('2026-03-31T10:20:00.000Z'),
        createdAt: '2026-03-31T10:20:00.000Z',
      },
    ],
  };
}

async function openBookmarkManager(page) {
  await page.evaluate(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  });
  await page
    .locator('[data-clp-sidebar-bookmarks-item="true"] [data-dd-action-name="sidebar-nav-item"]')
    .evaluate(element => element.click());
  await expect(page.locator('#bm-current-category-title')).toHaveText('All Bookmarks');
}

function assertInsideViewport(box, viewport, padding = 8) {
  expect(box.x, 'element should stay inside viewport on the left').toBeGreaterThanOrEqual(padding);
  expect(box.y, 'element should stay inside viewport on the top').toBeGreaterThanOrEqual(padding);
  expect(box.x + box.width, 'element should stay inside viewport on the right').toBeLessThanOrEqual(
    viewport.width - padding
  );
  expect(
    box.y + box.height,
    'element should stay inside viewport on the bottom'
  ).toBeLessThanOrEqual(viewport.height - padding);
}

function assertFitsViewport(box, viewport, padding = 0) {
  expect(box.width, 'element width should fit within viewport').toBeLessThanOrEqual(
    viewport.width - padding
  );
  expect(box.height, 'element height should fit within viewport').toBeLessThanOrEqual(
    viewport.height - padding
  );
}

function assertNoOverlap(firstBox, secondBox, label) {
  const overlaps =
    firstBox.x < secondBox.x + secondBox.width &&
    firstBox.x + firstBox.width > secondBox.x &&
    firstBox.y < secondBox.y + secondBox.height &&
    firstBox.y + firstBox.height > secondBox.y;

  expect(overlaps, label).toBe(false);
}

async function getRequiredBox(locator, label) {
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error(`Missing bounding box for ${label}`);
  }
  return box;
}

test.describe('targeted visual baselines', () => {
  test('floating panel baseline on the short real chat fixture', async ({
    fixturePage,
    harnessPage,
  }) => {
    await openFixture(fixturePage, harnessPage, CHAT_TEST_SURFACES.visuals.nav);
    await expect(fixturePage.locator('#claude-nav-container')).toHaveScreenshot(
      'nav-panel-real-short.png'
    );
  });

  test('bookmark category popover baseline', async ({ fixturePage, harnessPage }) => {
    await openFixture(fixturePage, harnessPage, CHAT_TEST_SURFACES.visuals.bookmarkPopover);
    const firstMessage = getRenderedMessage(fixturePage, 0);
    await firstMessage.hover();
    await firstMessage.locator('.claude-bookmark-btn').click();
    await expect(fixturePage.locator('.claude-category-popover')).toHaveScreenshot(
      'bookmark-category-popover-real-short.png'
    );
  });

  test('bookmark panel baseline', async ({ fixturePage, harnessPage }) => {
    await openFixture(fixturePage, harnessPage, CHAT_TEST_SURFACES.visuals.bookmarks);
    const firstMessage = getRenderedMessage(fixturePage, 0);
    await firstMessage.hover();
    await firstMessage.locator('.claude-bookmark-btn').click();
    await fixturePage.locator('.claude-category-popover').getByText('General').click();
    await fixturePage.locator('#claude-bookmarks-fixed-btn').click();
    await expect(fixturePage.locator('#claude-bookmarks-panel')).toHaveScreenshot(
      'bookmarks-panel-real-short.png'
    );
  });

  test('bookmark manager modal baseline', async ({ fixturePage, harnessPage }) => {
    const { tabId, fixture } = await openFixture(
      fixturePage,
      harnessPage,
      CHAT_TEST_SURFACES.visuals.bookmarkManager
    );
    await writeStoreData(harnessPage, tabId, 'bookmarks', createSeededBookmarks(fixture.route));
    await fixturePage.waitForTimeout(400);

    await openBookmarkManager(fixturePage);
    const modal = fixturePage
      .locator('#bm-category-list')
      .locator(
        'xpath=ancestor::div[contains(@class,"rounded-xl") and contains(@class,"overflow-hidden")][1]'
      );
    await expect(modal).toHaveScreenshot('bookmark-manager-real-short.png');
  });

  test('marker panel baseline', async ({ fixturePage, harnessPage }) => {
    await openFixture(fixturePage, harnessPage, CHAT_TEST_SURFACES.visuals.marker);
    const firstMessage = getRenderedMessage(fixturePage, 1);
    await firstMessage.hover();
    const markerButton = firstMessage.locator('.emoji-marker-btn');
    await expect(markerButton).toBeVisible();
    await markerButton.evaluate(element => element.click());
    await fixturePage.getByRole('button', { name: '⭐' }).first().click();
    await fixturePage.locator('#claude-marker-fixed-btn').click();
    await expect(fixturePage.locator('#claude-marker-panel')).toHaveScreenshot(
      'marker-panel-real-medium.png'
    );
  });

  test('edit panel and modal baselines', async ({ fixturePage, harnessPage }) => {
    await openFixture(fixturePage, harnessPage, CHAT_TEST_SURFACES.visuals.edit);
    await fixturePage.locator('#claude-edit-fixed-btn').click();
    await expect(fixturePage.locator('#claude-edit-panel')).toHaveScreenshot(
      'edit-panel-real-medium.png'
    );

    await fixturePage
      .locator('.claude-edit-badge')
      .first()
      .evaluate(element => element.click());
    await expect(fixturePage.locator('#claude-edit-modal-view')).toHaveScreenshot(
      'edit-modal-real-medium.png'
    );
  });

  test('branch map modal shell baseline', async ({ fixturePage, harnessPage }) => {
    await openFixture(fixturePage, harnessPage, CHAT_TEST_SURFACES.visuals.branchMap);
    await fixturePage
      .locator('.claude-edit-badge')
      .first()
      .evaluate(element => element.click());
    await expect(fixturePage.locator('#claude-edit-modal-view')).toBeVisible();
    await fixturePage.keyboard.press('Escape');

    await fixturePage.locator('#claude-edit-fixed-btn').click();
    const branchMapButton = fixturePage.locator(
      '#claude-edit-panel button:has-text("Show Chat Branch Map")'
    );
    await branchMapButton.scrollIntoViewIfNeeded();
    await branchMapButton.click({ force: true });

    await expect(fixturePage.locator('#branch-map-content')).toHaveScreenshot(
      'branch-map-shell-real-medium.png'
    );
  });

  test('narrow viewport keeps floating controls stacked and unclipped', async ({
    fixturePage,
    harnessPage,
  }) => {
    await openFixture(fixturePage, harnessPage, CHAT_TEST_SURFACES.visuals.edit, {
      viewport: NARROW_VIEWPORT,
    });

    const navContainer = fixturePage.locator('#claude-nav-container');
    const bookmarkButton = fixturePage.locator('#claude-bookmarks-fixed-btn');
    const markerButton = fixturePage.locator('#claude-marker-fixed-btn');
    const editButton = fixturePage.locator('#claude-edit-fixed-btn');

    await expect(navContainer).toBeVisible();
    await expect(bookmarkButton).toBeVisible();
    await expect(markerButton).toBeVisible();
    await expect(editButton).toBeVisible();

    const [navBox, bookmarkBox, markerBox, editBox] = await Promise.all([
      getRequiredBox(navContainer, 'navigation container'),
      getRequiredBox(bookmarkButton, 'bookmark button'),
      getRequiredBox(markerButton, 'marker button'),
      getRequiredBox(editButton, 'edit button'),
    ]);

    [navBox, bookmarkBox, markerBox, editBox].forEach(box => {
      assertInsideViewport(box, NARROW_VIEWPORT);
    });

    const sortedButtonBoxes = [bookmarkBox, markerBox, editBox].sort((first, second) => {
      return first.y - second.y;
    });

    for (let index = 0; index < sortedButtonBoxes.length - 1; index += 1) {
      const current = sortedButtonBoxes[index];
      const next = sortedButtonBoxes[index + 1];
      expect(
        next.y - (current.y + current.height),
        'floating buttons should keep a visible vertical gap at narrow width'
      ).toBeGreaterThanOrEqual(8);
    }

    assertNoOverlap(navBox, bookmarkBox, 'navigation container should not overlap bookmark button');
    assertNoOverlap(navBox, markerBox, 'navigation container should not overlap marker button');
    assertNoOverlap(navBox, editBox, 'navigation container should not overlap edit button');
    assertNoOverlap(
      bookmarkBox,
      markerBox,
      'bookmark and marker buttons should not overlap at narrow width'
    );
    assertNoOverlap(
      markerBox,
      editBox,
      'marker and edit buttons should not overlap at narrow width'
    );

    await expect(navContainer).toHaveScreenshot('nav-panel-real-short-narrow.png');
  });

  test('narrow viewport keeps bookmark popover and panel anchored without clipping', async ({
    fixturePage,
    harnessPage,
  }) => {
    await openFixture(fixturePage, harnessPage, CHAT_TEST_SURFACES.visuals.bookmarkPopover, {
      viewport: NARROW_VIEWPORT,
    });

    const firstMessage = getRenderedMessage(fixturePage, 0);
    await firstMessage.hover();
    const bookmarkButton = firstMessage.locator('.claude-bookmark-btn');
    await bookmarkButton.click();

    const popover = fixturePage.locator('.claude-category-popover');
    await expect(popover).toBeVisible();

    const [buttonBox, popoverBox] = await Promise.all([
      getRequiredBox(bookmarkButton, 'bookmark button'),
      getRequiredBox(popover, 'category popover'),
    ]);

    assertInsideViewport(popoverBox, NARROW_VIEWPORT);
    const anchorsBesideButton =
      popoverBox.x + popoverBox.width <= buttonBox.x ||
      popoverBox.x >= buttonBox.x + buttonBox.width;
    expect(anchorsBesideButton, 'category popover should open beside the trigger button').toBe(
      true
    );

    await expect(popover).toHaveScreenshot('bookmark-category-popover-real-short-narrow.png');

    await popover.getByText('General').click();
    await fixturePage.locator('#claude-bookmarks-fixed-btn').click();

    const bookmarkPanel = fixturePage.locator('#claude-bookmarks-panel');
    await expect(bookmarkPanel).toBeVisible();
    const panelBox = await getRequiredBox(bookmarkPanel, 'bookmark panel');
    assertInsideViewport(panelBox, NARROW_VIEWPORT);

    await expect(bookmarkPanel).toHaveScreenshot('bookmarks-panel-real-short-narrow.png');
  });

  test('narrow viewport keeps bookmark manager and branch map modals within view', async ({
    fixturePage,
    harnessPage,
  }) => {
    const { tabId, fixture } = await openFixture(
      fixturePage,
      harnessPage,
      CHAT_TEST_SURFACES.visuals.bookmarkManager,
      {
        viewport: NARROW_VIEWPORT,
      }
    );
    await writeStoreData(harnessPage, tabId, 'bookmarks', createSeededBookmarks(fixture.route));
    await fixturePage.waitForTimeout(400);

    await openBookmarkManager(fixturePage);
    const bookmarkManagerModal = fixturePage
      .locator('#bm-category-list')
      .locator(
        'xpath=ancestor::div[contains(@class,"rounded-xl") and contains(@class,"overflow-hidden")][1]'
      );
    await expect(bookmarkManagerModal).toBeVisible();
    const bookmarkManagerBox = await getRequiredBox(bookmarkManagerModal, 'bookmark manager modal');
    assertFitsViewport(bookmarkManagerBox, NARROW_VIEWPORT, 4);
    await expect(bookmarkManagerModal).toHaveScreenshot('bookmark-manager-real-short-narrow.png');

    await fixturePage.keyboard.press('Escape');
    await expect(bookmarkManagerModal).toHaveCount(0);

    await openFixture(fixturePage, harnessPage, CHAT_TEST_SURFACES.visuals.branchMap, {
      viewport: NARROW_VIEWPORT,
    });
    await fixturePage
      .locator('.claude-edit-badge')
      .first()
      .evaluate(element => element.click());
    await expect(fixturePage.locator('#claude-edit-modal-view')).toBeVisible();
    await fixturePage.keyboard.press('Escape');

    await fixturePage.locator('#claude-edit-fixed-btn').click();
    const branchMapButton = fixturePage.locator(
      '#claude-edit-panel button:has-text("Show Chat Branch Map")'
    );
    await branchMapButton.scrollIntoViewIfNeeded();
    await branchMapButton.click({ force: true });

    const branchMap = fixturePage.locator('#branch-map-content');
    await expect(branchMap).toBeVisible();
    const branchMapBox = await getRequiredBox(branchMap, 'branch map content');
    assertFitsViewport(branchMapBox, NARROW_VIEWPORT, 4);
    await expect(branchMap).toHaveScreenshot('branch-map-shell-real-medium-narrow.png');
  });
});
