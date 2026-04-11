import test from 'node:test';
import assert from 'node:assert/strict';
import { setupDom } from '../test-support/dom.js';
import { readFileSync } from 'node:fs';
import { cloneDefaultSettings } from '../src/config/defaultSettings.js';
import { USAGE_EVENT_NAMES } from '../src/modules/UsageTrackerModule/constants.js';

function createComposerHtml() {
  return `
    <div data-chat-input-container="true">
      <fieldset>
        <div class="bg-bg-000" data-testid="usage-shell">
          <div class="w-full">
            <div data-testid="chat-input" contenteditable="true">Usage test</div>
          </div>
          <div>
            <button type="button" aria-label="Add files, connectors, and more">+</button>
            <button type="button" data-testid="model-selector-dropdown">Model</button>
            <button type="button" aria-label="Use voice mode">Voice</button>
            <button type="submit">Send</button>
          </div>
        </div>
      </fieldset>
    </div>
  `;
}

function createNewComposerHtml() {
  return `
    <div class="!box-content flex flex-col bg-bg-000" data-testid="usage-shell">
      <div class="flex flex-col m-3.5 gap-3">
        <div class="relative">
          <div class="w-full overflow-y-auto">
            <div data-testid="chat-input" contenteditable="true"></div>
          </div>
        </div>
        <div class="relative flex gap-2 w-full items-center">
          <div class="relative flex-1 flex items-center shrink min-w-0 gap-1">
            <div>
              <button type="button" aria-label="Add files, connectors, and more">+</button>
            </div>
            <div class="flex flex-row items-center min-w-0 gap-1"></div>
          </div>
          <div class="transition-all duration-200 ease-out">
            <div class="overflow-hidden shrink-0 p-1 -m-1">
              <button type="button" data-testid="model-selector-dropdown">Model</button>
            </div>
          </div>
          <div class="shrink-0 flex items-center w-8 z-10 justify-end">
            <div class="flex items-center gap-1 shrink-0">
              <button type="button" aria-label="Use voice mode">Voice</button>
              <button type="button" aria-label="Send message">Send</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

async function setupUsageTrackerEnvironment(html, { urlPath = '/chat/test-thread' } = {}) {
  const cleanupDom = setupDom(html);
  const originalChrome = globalThis.chrome;

  window.history.replaceState({}, '', urlPath);
  document.cookie = 'lastActiveOrg=test-org-123';

  const sentMessages = [];
  globalThis.chrome = {
    runtime: {
      lastError: null,
      getURL(path) {
        return `chrome-extension://test-extension/${path}`;
      },
      sendMessage(message, callback) {
        sentMessages.push(message);
        callback?.({});
      },
    },
  };

  const [
    { default: BaseModule },
    { default: DOMUtils },
    { default: ObserverManager },
    { storeSyncChannel },
    { default: navigationInterceptor },
    { default: UsageTrackerModule },
    { default: UsageClient },
    { default: UsageBridge },
  ] = await Promise.all([
    import('../src/modules/BaseModule.js'),
    import('../src/utils/DOMUtils.js'),
    import('../src/managers/ObserverManager.js'),
    import('../src/utils/StoreSyncChannel.js'),
    import('../src/core/NavigationInterceptor.js'),
    import('../src/modules/UsageTrackerModule.js'),
    import('../src/modules/UsageTrackerModule/UsageClient.js'),
    import('../src/modules/UsageTrackerModule/UsageBridge.js'),
  ]);

  const originalBaseInit = BaseModule.prototype.init;
  const originalDomConversationCheck = DOMUtils.isOnConversationPage;
  const originalObserve = ObserverManager.observe;
  const originalDisconnect = ObserverManager.disconnect;
  const originalFetchUsage = UsageClient.prototype.fetchUsage;
  const originalEnsureInjected = UsageBridge.prototype.ensureInjected;

  BaseModule.prototype.init = function initStub() {
    this.enabled = true;
    this.initialized = true;
    this.unsubscribers = [];
    this.settings = { usageTracker: { enabled: true } };
  };
  DOMUtils.isOnConversationPage = () => true;
  ObserverManager.observe = () => {};
  ObserverManager.disconnect = () => {};
  UsageBridge.prototype.ensureInjected = function ensureInjectedStub() {};
  UsageClient.prototype.fetchUsage = function fetchUsageStub() {
    return {
      five_hour: {
        utilization: 63,
        resets_at: '2026-04-11T18:00:00.000Z',
      },
      seven_day: {
        utilization: 13,
        resets_at: '2026-04-18T11:00:00.000Z',
      },
    };
  };

  const module = new UsageTrackerModule();

  return {
    module,
    sentMessages,
    cleanup() {
      module.destroy();
      BaseModule.prototype.init = originalBaseInit;
      DOMUtils.isOnConversationPage = originalDomConversationCheck;
      ObserverManager.observe = originalObserve;
      ObserverManager.disconnect = originalDisconnect;
      UsageClient.prototype.fetchUsage = originalFetchUsage;
      UsageBridge.prototype.ensureInjected = originalEnsureInjected;
      storeSyncChannel.destroy();
      navigationInterceptor.destroy();
      if (originalChrome === undefined) {
        delete globalThis.chrome;
      } else {
        globalThis.chrome = originalChrome;
      }
      cleanupDom();
    },
  };
}

test('usage tracker renders session and weekly lines inside the composer', async () => {
  const env = await setupUsageTrackerEnvironment(createComposerHtml());

  try {
    await env.module.init();

    const root = document.querySelector('.cl-usage-tracker');
    const sessionFill = document.querySelector('[data-usage-fill="session"]');
    const weeklyFill = document.querySelector('[data-usage-fill="weekly"]');
    const sessionLine = document.querySelector('[data-usage-kind="session"]');
    const weeklyLine = document.querySelector('[data-usage-kind="weekly"]');
    const tooltip = document.querySelector('[data-usage-tooltip]');
    const usageShell = document.querySelector('[data-testid="usage-shell"]');
    const initialAnalyticsCount = env.sentMessages.filter(message => {
      return message?.type === 'ANALYTICS_EVENT';
    }).length;

    assert.ok(root);
    assert.equal(root.parentElement, usageShell);
    assert.equal(root.style.overflow, 'hidden');
    assert.equal(sessionFill.style.width, '63%');
    assert.equal(weeklyFill.style.width, '13%');
    assert.equal(sessionLine.style.left, '0px');
    assert.equal(sessionLine.style.right, '0px');
    assert.equal(weeklyLine.style.left, '0px');
    assert.equal(weeklyLine.style.right, '0px');
    assert.equal(sessionLine.style.height, '10px');
    assert.equal(weeklyLine.style.height, '10px');
    assert.equal(sessionLine.title, '');
    assert.equal(weeklyLine.title, '');
    assert.match(sessionLine.getAttribute('aria-label'), /Session 63%/);
    assert.match(weeklyLine.getAttribute('aria-label'), /Weekly 13%/);
    assert.match(sessionFill.style.background, /8,\s*145,\s*178/);
    assert.match(weeklyFill.style.background, /37,\s*99,\s*235/);
    sessionLine.dispatchEvent(new window.MouseEvent('mouseenter', { bubbles: true }));
    assert.equal(tooltip.style.opacity, '1');
    assert.match(tooltip.textContent, /Session 63%/);
    sessionLine.dispatchEvent(new window.MouseEvent('mouseleave', { bubbles: true }));
    assert.equal(tooltip.style.opacity, '0');

    const analyticsMessages = env.sentMessages.filter(
      message => message?.type === 'ANALYTICS_EVENT'
    );
    assert.equal(analyticsMessages.length, initialAnalyticsCount + 1);
    assert.equal(analyticsMessages.at(-1)?.name, 'usage_tracker_tooltip_open');
    assert.equal(analyticsMessages.at(-1)?.params?.result, 'session');

    sessionLine.dispatchEvent(new window.MouseEvent('mouseenter', { bubbles: true }));
    assert.equal(
      env.sentMessages.filter(message => message?.name === 'usage_tracker_tooltip_open').length,
      1
    );
  } finally {
    env.cleanup();
  }
});

test('usage tracker updates from completion message_limit bridge events', async () => {
  const env = await setupUsageTrackerEnvironment(createComposerHtml());

  try {
    await env.module.init();

    window.dispatchEvent(
      new window.CustomEvent(USAGE_EVENT_NAMES.LIMIT_UPDATE, {
        detail: {
          payload: {
            windows: {
              '5h': {
                utilization: 0.71,
                resets_at: 1775930400,
              },
              '7d': {
                utilization: 0.22,
                resets_at: 1776510000,
              },
            },
          },
        },
      })
    );

    const sessionFill = document.querySelector('[data-usage-fill="session"]');
    const weeklyFill = document.querySelector('[data-usage-fill="weekly"]');

    assert.equal(sessionFill.style.width, '71%');
    assert.equal(weeklyFill.style.width, '22%');
  } finally {
    env.cleanup();
  }
});

test('usage tracker mounts on /new without relying on data-chat-input-container', async () => {
  const env = await setupUsageTrackerEnvironment(createNewComposerHtml(), { urlPath: '/new' });

  try {
    await env.module.init();

    const root = document.querySelector('.cl-usage-tracker');
    const usageShell = document.querySelector('[data-testid="usage-shell"]');

    assert.ok(root);
    assert.equal(root.parentElement, usageShell);
  } finally {
    env.cleanup();
  }
});

test('usage tracker defaults to enabled for new settings', () => {
  const defaults = cloneDefaultSettings();

  assert.equal(defaults.usageTracker.enabled, true);
  assert.equal('showFloatingUI' in defaults.usageTracker, false);
});

test('usage tracker bridge is exposed as a web accessible resource instead of inline script', () => {
  const manifest = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));

  assert.ok(Array.isArray(manifest.web_accessible_resources));
  assert.ok(
    manifest.web_accessible_resources.some(entry =>
      entry.resources?.includes('src/page-bridges/usageTrackerBridge.js')
    )
  );
});
