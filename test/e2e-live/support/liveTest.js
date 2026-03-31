import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test as base, expect } from '@playwright/test';
import { cloneDefaultSettings } from '../../../src/config/defaultSettings.js';
import {
  collectLivePageSnapshot,
  createArtifactRunDir,
  DEFAULT_BROWSER_PATH,
  DEFAULT_CHROME_USER_DATA_DIR,
  DEFAULT_CLONE_DIR,
  DEFAULT_EXTENSION_NAME,
  DEFAULT_PROFILE_NAME,
  DEFAULT_VIEWPORT,
  evaluateLiveRouteResult,
  getInstalledExtension,
  launchLiveChrome,
  openExtensionHarness,
  parseBooleanFlag,
  refreshChromeProfileClone,
  waitForExtensionId,
  writeJson,
} from '../../../scripts/fixtures/lib/liveChrome.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const extensionPath = path.resolve(__dirname, '..', '..', '..');

function createErrorBucket(page) {
  const errors = [];

  page.on('pageerror', error => {
    errors.push(`pageerror:${error.message}`);
  });

  page.on('console', message => {
    if (message.type() === 'error') {
      errors.push(`console:${message.text()}`);
    }
  });

  return errors;
}

function createLiveSettings() {
  const settings = cloneDefaultSettings();
  settings.general = {
    ...(settings.general || {}),
    analyticsEnabled: false,
  };
  return settings;
}

function resolveLiveHeadlessMode() {
  return parseBooleanFlag(process.env.CLAUDE_LEAF_LIVE_HEADLESS, false);
}

function resolveRequireExtensionMode() {
  return parseBooleanFlag(process.env.CLAUDE_LEAF_LIVE_REQUIRE_EXTENSION, false);
}

export const test = base.extend({
  liveSession: [
    async ({}, use) => {
      const artifactDir = await createArtifactRunDir({ label: 'smoke' });
      const cloneMetadata = await refreshChromeProfileClone({
        profileName: DEFAULT_PROFILE_NAME,
        chromeUserDataDir: DEFAULT_CHROME_USER_DATA_DIR,
        cloneDir: DEFAULT_CLONE_DIR,
        browserPath: DEFAULT_BROWSER_PATH,
      });

      const installedExtension = await getInstalledExtension({
        cloneDir: cloneMetadata.cloneDir,
        profileDirectory: cloneMetadata.profileDirectory,
        extensionPath,
        extensionName: DEFAULT_EXTENSION_NAME,
      });

      const liveChrome = await launchLiveChrome({
        cloneDir: cloneMetadata.cloneDir,
        profileDirectory: cloneMetadata.profileDirectory,
        browserPath: cloneMetadata.browserPath,
        artifactDir,
        viewport: DEFAULT_VIEWPORT,
        headless: resolveLiveHeadlessMode(),
      });

      const settings = createLiveSettings();

      try {
        await use({
          ...liveChrome,
          extensionId: null,
          harnessPage: null,
          settings,
          artifactDir,
          cloneMetadata,
          installedExtension,
          requireExtension: resolveRequireExtensionMode(),
        });
      } finally {
        if (liveChrome.harnessPage && !liveChrome.harnessPage.isClosed()) {
          await liveChrome.harnessPage.close();
        }
        await liveChrome.close();
      }
    },
    { scope: 'worker' },
  ],

  livePage: async ({ liveSession }, use) => {
    const page =
      liveSession.context.pages().find(currentPage => {
        return currentPage.url() === 'about:blank';
      }) || (await liveSession.context.newPage());

    page.__clLeafErrors = createErrorBucket(page);
    await page.setViewportSize(DEFAULT_VIEWPORT);

    try {
      await use(page);
    } finally {
      if (!page.isClosed()) {
        await page.close();
      }
    }
  },
});

export { expect };

export function clearPageErrors(page) {
  if (Array.isArray(page.__clLeafErrors)) {
    page.__clLeafErrors.length = 0;
  }
}

export function getPageErrors(page) {
  return Array.isArray(page.__clLeafErrors) ? [...page.__clLeafErrors] : [];
}

export async function ensureHarnessPage(liveSession) {
  if (liveSession.harnessPage && !liveSession.harnessPage.isClosed()) {
    return liveSession.harnessPage;
  }

  const extensionId = await waitForExtensionId(liveSession.context);
  const harnessPage = await openExtensionHarness(liveSession.context, extensionId);

  await harnessPage.evaluate(async seededSettings => {
    await window.__clLeafTestHarness.resetForTab(null);
    await window.__clLeafTestHarness.setSettings(seededSettings, null);
    await window.__clLeafTestHarness.closeNonFixtureTabs();
  }, liveSession.settings);

  liveSession.extensionId = extensionId;
  liveSession.harnessPage = harnessPage;

  return harnessPage;
}

export async function tryGetExtensionState(harnessPage, pathname) {
  let lastError = null;

  for (let attempt = 0; attempt < 12; attempt += 1) {
    try {
      const tabId = await harnessPage.evaluate(async routePath => {
        const tab = await window.__clLeafTestHarness.getTabByRoute(routePath);
        return tab?.id ?? null;
      }, pathname);

      if (!tabId) {
        await harnessPage.waitForTimeout(200);
        continue;
      }

      const state = await harnessPage.evaluate(targetTabId => {
        return window.__clLeafTestHarness.sendToTab(targetTabId, {
          type: 'CL_TEST_GET_STATE',
        });
      }, tabId);

      return {
        available: true,
        tabId,
        state,
        error: null,
      };
    } catch (error) {
      lastError = error;
      await harnessPage.waitForTimeout(200);
    }
  }

  return {
    available: false,
    tabId: null,
    state: null,
    error: lastError ? String(lastError) : 'No extension state available for route',
  };
}

export async function navigateAndCollect(
  page,
  routeKey,
  requestedUrl,
  waitMs = 6_000,
  expectations = {}
) {
  await page.goto(requestedUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForTimeout(waitMs);
  const snapshot = await collectLivePageSnapshot(page);
  const evaluation = evaluateLiveRouteResult(routeKey, snapshot, expectations);

  return {
    requestedUrl,
    routeKey,
    ...snapshot,
    evaluation,
  };
}

export async function writeLiveReport(artifactDir, report) {
  const reportPath = path.join(artifactDir, 'live-smoke-report.json');
  await writeJson(reportPath, report);
  return reportPath;
}

export function screenshotPath(artifactDir, name) {
  return path.join(artifactDir, `${name}.png`);
}
