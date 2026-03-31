import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { chromium, expect, test as base } from '@playwright/test';
import { cloneDefaultSettings } from '../../../src/config/defaultSettings.js';

const require = createRequire(import.meta.url);
const { installFixtureRoutes, getFixtureById } = require('../../fixtures/lib/fixture-router.cjs');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..', '..');
const extensionPath = repoRoot;
export const DEFAULT_VIEWPORT = { width: 1440, height: 900 };
export const NARROW_VIEWPORT = { width: 1180, height: 900 };

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

export const test = base.extend({
  extensionContext: [
    async ({}, use) => {
      const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-leaf-playwright-'));
      const networkViolations = [];
      const context = await chromium.launchPersistentContext(userDataDir, {
        channel: 'chromium',
        headless: !!process.env.CI,
        viewport: DEFAULT_VIEWPORT,
        args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
      });
      context.__clLeafNetworkViolations = networkViolations;

      await installFixtureRoutes(context, networkViolations);

      try {
        await use(context);
      } finally {
        await context.close();
        fs.rmSync(userDataDir, { recursive: true, force: true });
      }
    },
    { scope: 'worker' },
  ],

  extensionId: [
    async ({ extensionContext }, use) => {
      let [serviceWorker] = extensionContext.serviceWorkers();
      if (!serviceWorker) {
        serviceWorker = await extensionContext.waitForEvent('serviceworker');
      }

      await use(new URL(serviceWorker.url()).host);
    },
    { scope: 'worker' },
  ],

  harnessPage: async ({ extensionContext, extensionId }, use) => {
    const page = await extensionContext.newPage();
    await page.goto(
      `chrome-extension://${extensionId}/test-support/playwright/extension-harness.html`
    );
    await page.waitForFunction(() => window.__clLeafTestHarness?.ready === true);

    try {
      await use(page);
    } finally {
      await page.close();
    }
  },

  fixturePage: async ({ extensionContext }, use) => {
    const page = await extensionContext.newPage();
    page.__clLeafErrors = createErrorBucket(page);
    page.__clLeafNetworkViolations = extensionContext.__clLeafNetworkViolations || [];

    try {
      await use(page);
    } finally {
      await page.close();
    }
  },
});

export { expect };

async function lookupTabId(harnessPage, route) {
  return harnessPage.evaluate(async fixtureRoute => {
    const tab = await window.__clLeafTestHarness.getTabByRoute(fixtureRoute);
    return tab?.id ?? null;
  }, route);
}

async function seedSettings(harnessPage, settings, tabId) {
  await harnessPage.evaluate(
    async payload => {
      await window.__clLeafTestHarness.setSettings(payload.settings, payload.tabId);
    },
    { settings, tabId }
  );
}

function createTestSettings(overrides = null) {
  const base = overrides ? structuredClone(overrides) : cloneDefaultSettings();
  base.general = {
    ...(base.general || {}),
    analyticsEnabled: false,
  };
  return base;
}

async function resetState(harnessPage, tabId) {
  await harnessPage.evaluate(async targetTabId => {
    await window.__clLeafTestHarness.resetForTab(targetTabId);
  }, tabId);
}

async function waitForFixtureReady(page) {
  await page.waitForFunction(() => Boolean(window.__claudeFixture));
}

function clearNetworkViolations(page) {
  if (Array.isArray(page.__clLeafNetworkViolations)) {
    page.__clLeafNetworkViolations.length = 0;
  }
}

async function waitForAppReady(page, fixture) {
  if (fixture.meta.pageType === 'conversation' || fixture.meta.pageType === 'project_chat') {
    await page.waitForSelector('#claude-nav-container');
  }
}

export async function openFixture(fixturePage, harnessPage, fixtureId, options = {}) {
  const fixture = getFixtureById(fixtureId);
  if (!fixture) {
    throw new Error(`Unknown fixture: ${fixtureId}`);
  }

  const viewport = options.viewport || fixture.meta.viewport || DEFAULT_VIEWPORT;
  const testSettings = createTestSettings(options.settings);

  await harnessPage.evaluate(async () => {
    await window.__clLeafTestHarness.closeNonFixtureTabs();
  });
  clearNetworkViolations(fixturePage);
  await seedSettings(harnessPage, testSettings, null);
  await fixturePage.waitForTimeout(200);
  clearNetworkViolations(fixturePage);
  await fixturePage.setViewportSize(viewport);
  await fixturePage.goto(`https://claude.ai${fixture.route}`, { waitUntil: 'domcontentloaded' });
  await waitForFixtureReady(fixturePage);

  const initialTabId = await lookupTabId(harnessPage, fixture.route);
  await resetState(harnessPage, initialTabId);

  await seedSettings(harnessPage, testSettings, initialTabId);

  await fixturePage.reload({ waitUntil: 'domcontentloaded' });
  await waitForFixtureReady(fixturePage);

  const tabId = await lookupTabId(harnessPage, fixture.route);
  await seedSettings(harnessPage, testSettings, tabId);

  await waitForAppReady(fixturePage, fixture);

  return {
    fixture,
    tabId,
  };
}

export async function getExtensionState(harnessPage, tabId) {
  return harnessPage.evaluate(async targetTabId => {
    let lastError = null;

    for (let attempt = 0; attempt < 10; attempt += 1) {
      try {
        const response = await window.__clLeafTestHarness.sendToTab(targetTabId, {
          type: 'CL_TEST_GET_STATE',
        });

        if (response && typeof response === 'object') {
          return response;
        }
      } catch (error) {
        lastError = error;
      }

      await new Promise(resolve => {
        window.setTimeout(resolve, 150);
      });
    }

    throw lastError || new Error('Failed to fetch extension state');
  }, tabId);
}

export function assertNoPageErrors(page, allowlist = []) {
  const errors = (page.__clLeafErrors || []).filter(entry => {
    return !allowlist.some(pattern => {
      if (pattern instanceof RegExp) {
        return pattern.test(entry);
      }
      return entry.includes(pattern);
    });
  });

  expect(errors, `Unexpected console/page errors on ${page.url()}`).toEqual([]);

  const networkViolations = page.__clLeafNetworkViolations || [];
  expect(
    networkViolations,
    `Unexpected live network requests on ${page.url()}: ${JSON.stringify(networkViolations, null, 2)}`
  ).toEqual([]);
}
