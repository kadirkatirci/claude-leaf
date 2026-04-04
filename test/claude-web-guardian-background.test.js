import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const backgroundScriptPath = new URL(
  '../tools/claude-web-guardian/src/background.js',
  import.meta.url
);
const backgroundScriptSource = fs.readFileSync(backgroundScriptPath, 'utf8');
const inlinedBackgroundSource = backgroundScriptSource.replace(
  "import { ALARM_NAME, DEFAULT_SETTINGS, STORAGE_KEYS } from './config.js';",
  `const ALARM_NAME = 'cwg_scheduled_canary';
const DEFAULT_SETTINGS = {
  enabled: true,
  intervalMinutes: 360,
  checks: { domCore: true, editHistory: true, sidebar: true, theme: true, routes: true },
  bridge: { enabled: false, webhookUrl: '' },
  historyLimit: 200,
};
const STORAGE_KEYS = {
  settings: 'cwg_settings',
  reports: 'cwg_reports',
  lastRunAt: 'cwg_last_run_at',
  pendingAlerts: 'cwg_pending_alerts',
};`
);

function createChromeStub(overrides = {}) {
  const chrome = {
    storage: {
      local: {
        get() {
          return {};
        },
        set() {},
      },
    },
    alarms: {
      async clear() {},
      create() {},
      onAlarm: {
        addListener() {},
      },
    },
    tabs: {
      query() {
        return [];
      },
      get() {
        return { id: 1, url: 'https://claude.ai/chat/test', windowId: 1 };
      },
      async update() {},
      async create() {},
      onRemoved: {
        addListener() {},
      },
    },
    action: {
      async setBadgeText() {},
      async setBadgeBackgroundColor() {},
      async setTitle() {},
    },
    runtime: {
      onInstalled: {
        addListener() {},
      },
      onStartup: {
        addListener() {},
      },
      onMessage: {
        addListener() {},
      },
    },
    webNavigation: {
      onHistoryStateUpdated: {
        addListener() {},
      },
    },
    notifications: {
      async create() {},
      onClicked: {
        addListener() {},
      },
    },
    windows: {
      async update() {},
    },
  };

  return {
    ...chrome,
    ...overrides,
    storage: {
      ...chrome.storage,
      ...(overrides.storage || {}),
      local: {
        ...chrome.storage.local,
        ...(overrides.storage?.local || {}),
      },
    },
    alarms: {
      ...chrome.alarms,
      ...(overrides.alarms || {}),
    },
    tabs: {
      ...chrome.tabs,
      ...(overrides.tabs || {}),
    },
    action: {
      ...chrome.action,
      ...(overrides.action || {}),
    },
    runtime: {
      ...chrome.runtime,
      ...(overrides.runtime || {}),
    },
    webNavigation: {
      ...chrome.webNavigation,
      ...(overrides.webNavigation || {}),
    },
    notifications: {
      ...chrome.notifications,
      ...(overrides.notifications || {}),
    },
    windows: {
      ...chrome.windows,
      ...(overrides.windows || {}),
    },
  };
}

function loadGuardianBackgroundHelpers(chromeOverrides = {}) {
  const chrome = createChromeStub(chromeOverrides);
  const context = vm.createContext({
    chrome,
    console,
    Date,
    URL,
    setTimeout,
    clearTimeout,
    encodeURIComponent,
    fetch: () => Promise.resolve({ ok: true }),
  });

  new vm.Script(
    `${inlinedBackgroundSource}
this.__CWG_BG_TEST__ = {
  buildFailureSignature,
  shouldScheduleFailureNotifications,
  buildFailureAlertPayload,
  buildFailureNotificationTitle,
  buildFailureNotificationMessage,
  runCanary
};`,
    { filename: 'claude-web-guardian-background.js' }
  ).runInContext(context);

  return {
    ...context.__CWG_BG_TEST__,
    chrome,
  };
}

function createFailingReport(pathname = '/chat/test-thread') {
  return {
    timestamp: 123,
    tabId: 5,
    url: `https://claude.ai${pathname}`,
    pageMeta: {
      pathname,
    },
    checks: [
      {
        id: 'main_container',
        pass: false,
        severity: 'high',
        message: 'Main container missing',
      },
      {
        id: 'message_nodes',
        pass: false,
        severity: 'high',
        message: 'Message node count: 0',
      },
    ],
  };
}

test('failure signature is stable for the same failing path and check ids', () => {
  const { buildFailureSignature } = loadGuardianBackgroundHelpers();

  assert.equal(
    buildFailureSignature(createFailingReport()),
    '/chat/test-thread|main_container,message_nodes'
  );
  assert.equal(
    buildFailureSignature({
      url: 'https://claude.ai/chat/test-thread',
      checks: [{ id: 'main_container', pass: true }],
    }),
    null
  );
});

test('failure notifications are deduped against the previous failing report', () => {
  const { shouldScheduleFailureNotifications } = loadGuardianBackgroundHelpers();
  const current = createFailingReport();
  const sameAsPrevious = createFailingReport();
  const recoveredPrevious = {
    ...createFailingReport(),
    checks: [{ id: 'main_container', pass: true, message: 'Main container found' }],
  };

  assert.equal(shouldScheduleFailureNotifications(current, sameAsPrevious), false);
  assert.equal(shouldScheduleFailureNotifications(current, recoveredPrevious), true);
});

test('failure notification payload and message include path and failing checks', () => {
  const {
    buildFailureAlertPayload,
    buildFailureNotificationTitle,
    buildFailureNotificationMessage,
  } = loadGuardianBackgroundHelpers();
  const payload = buildFailureAlertPayload(createFailingReport('/chat/focus-me'));

  assert.equal(payload.pathname, '/chat/focus-me');
  assert.equal(payload.failureCount, 2);
  assert.match(buildFailureNotificationTitle(payload, 2, 3), /\(2\/3\)/);

  const message = buildFailureNotificationMessage(payload);
  assert.match(message, /\/chat\/focus-me/);
  assert.match(message, /main_container/);
  assert.match(message, /message_nodes/);
});

test('runCanary skips history writes when no Claude tab exists', async () => {
  const storageSetCalls = [];
  const badgeTextCalls = [];
  const titleCalls = [];
  const { runCanary } = loadGuardianBackgroundHelpers({
    storage: {
      local: {
        async set(value) {
          storageSetCalls.push(value);
        },
      },
    },
    action: {
      async setBadgeText(value) {
        badgeTextCalls.push(value);
      },
      async setTitle(value) {
        titleCalls.push(value);
      },
    },
  });

  const result = await runCanary('heartbeat');

  assert.equal(result.ok, false);
  assert.equal(result.reason, 'no_tab');
  assert.equal(storageSetCalls.length, 0);
  assert.equal(badgeTextCalls.length, 1);
  assert.equal(badgeTextCalls[0].text, '');
  assert.equal(titleCalls.length, 1);
  assert.match(titleCalls[0].title, /Status: idle/);
  assert.match(titleCalls[0].title, /No Claude tab available/);
});
