import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const backgroundScriptPath = new URL('../src/background.js', import.meta.url);
const backgroundScriptSource = fs.readFileSync(backgroundScriptPath, 'utf8');

function createChromeStub() {
  const storageState = {};
  const alarmCreates = [];
  const listeners = {};

  const chrome = {
    storage: {
      local: {
        get(keys) {
          const result = {};
          for (const key of keys) {
            result[key] = storageState[key];
          }
          return Promise.resolve(result);
        },
        set(payload) {
          Object.assign(storageState, payload);
          return Promise.resolve();
        },
      },
      sync: {
        get() {
          return Promise.resolve({
            settings: {
              general: {
                analyticsEnabled: false,
              },
            },
          });
        },
      },
      session: {
        get() {
          return Promise.resolve({});
        },
        set() {
          return Promise.resolve();
        },
      },
    },
    alarms: {
      clear() {
        alarmCreates.push({ cleared: true });
        return Promise.resolve();
      },
      create(name, payload) {
        alarmCreates.push({ name, payload });
      },
      onAlarm: {
        addListener(listener) {
          listeners.onAlarm = listener;
        },
      },
    },
    tabs: {
      query() {
        return Promise.resolve([]);
      },
      get() {
        return Promise.resolve(null);
      },
      sendMessage() {
        return Promise.resolve({ accepted: true });
      },
      create() {},
    },
    runtime: {
      getManifest() {
        return { version: '1.0.2' };
      },
      onInstalled: {
        addListener(listener) {
          listeners.onInstalled = listener;
        },
      },
      onStartup: {
        addListener(listener) {
          listeners.onStartup = listener;
        },
      },
      onUpdateAvailable: {
        addListener(listener) {
          listeners.onUpdateAvailable = listener;
        },
      },
      onMessage: {
        addListener(listener) {
          listeners.onMessage = listener;
        },
      },
      reload() {},
      getURL() {
        return 'chrome-extension://test/test-support/playwright/extension-harness.html';
      },
    },
  };

  return { chrome, storageState, alarmCreates, listeners };
}

function loadScheduledMessageHelpers(overrides = {}) {
  const { chrome, storageState, alarmCreates, listeners } = createChromeStub();
  Object.assign(chrome, overrides);

  const context = vm.createContext({
    chrome,
    console,
    URL,
    Date,
    setTimeout,
    clearTimeout,
    fetch: () => Promise.resolve({ ok: false }),
    self: {
      crypto: { randomUUID: () => 'uuid-test' },
    },
  });

  new vm.Script(
    `${backgroundScriptSource}
this.__SCHEDULE_BG_TEST__ = {
  createOrUpdateSchedule,
  readScheduleStore,
  processDueSchedules,
  expirePendingSchedulesOnStartup,
  getScheduleForConversation,
  normalizeConversationUrl,
  executeSchedule,
  handleScheduleExecuteResult
};`,
    { filename: 'scheduled-message-background.js' }
  ).runInContext(context);

  return {
    ...context.__SCHEDULE_BG_TEST__,
    chrome,
    storageState,
    alarmCreates,
    listeners,
  };
}

test('schedule creation replaces same conversation entry and keeps earliest alarm', async () => {
  const { createOrUpdateSchedule, readScheduleStore, alarmCreates } = loadScheduledMessageHelpers();

  const now = Date.now();
  await createOrUpdateSchedule(
    {
      conversationUrl: 'https://claude.ai/chat/alpha',
      snapshotText: 'alpha',
      scheduledForMs: now + 60000,
      hasAttachmentExpectation: false,
    },
    { tab: { id: 1 } }
  );
  await createOrUpdateSchedule(
    {
      conversationUrl: 'https://claude.ai/chat/beta',
      snapshotText: 'beta',
      scheduledForMs: now + 30000,
      hasAttachmentExpectation: false,
    },
    { tab: { id: 2 } }
  );
  await createOrUpdateSchedule(
    {
      conversationUrl: 'https://claude.ai/chat/alpha',
      snapshotText: 'alpha-updated',
      scheduledForMs: now + 90000,
      hasAttachmentExpectation: false,
    },
    { tab: { id: 1 } }
  );

  const store = await readScheduleStore();
  assert.equal(store.items.length, 2);
  assert.equal(
    store.items.find(item => item.conversationUrl === 'https://claude.ai/chat/alpha')?.snapshotText,
    'alpha-updated'
  );

  const latestAlarm = alarmCreates.filter(item => item.name).at(-1);
  assert.equal(latestAlarm?.name, 'claude_leaf_scheduled_message_v2');
  assert.equal(latestAlarm?.payload.when, store.items[1].scheduledForMs);
});

test('same-tab /new schedules are re-associated after the conversation gets a real URL', async () => {
  const { createOrUpdateSchedule, getScheduleForConversation, readScheduleStore } =
    loadScheduledMessageHelpers();

  await createOrUpdateSchedule(
    {
      conversationUrl: 'https://claude.ai/new',
      snapshotText: 'draft from new chat',
      scheduledForMs: Date.now() + 120000,
      hasAttachmentExpectation: false,
    },
    { tab: { id: 42 } }
  );

  const migrated = await getScheduleForConversation('https://claude.ai/chat/generated-thread', 42);
  const store = await readScheduleStore();

  assert.equal(migrated?.conversationUrl, 'https://claude.ai/chat/generated-thread');
  assert.equal(store.items[0]?.conversationUrl, 'https://claude.ai/chat/generated-thread');
});

test('due schedules retry at most 3 times and then fail with retry_exhausted', async () => {
  const { createOrUpdateSchedule, processDueSchedules, readScheduleStore, storageState } =
    loadScheduledMessageHelpers();

  const conversationUrl = 'https://claude.ai/chat/retry-me';
  await createOrUpdateSchedule(
    {
      conversationUrl,
      snapshotText: 'retry me',
      scheduledForMs: Date.now() + 120000,
      hasAttachmentExpectation: false,
    },
    { tab: { id: 7 } }
  );

  for (let attempt = 1; attempt <= 4; attempt++) {
    storageState.scheduled_message_queue_v2.items[0].scheduledForMs = Date.now() - 1000;
    await processDueSchedules();
    const store = await readScheduleStore();
    const record = store.items[0];

    if (attempt < 4) {
      assert.equal(record.status, 'retrying');
      assert.equal(record.retryCount, attempt);
    } else {
      assert.equal(record.status, 'failed');
      assert.equal(record.lastErrorCode, 'retry_exhausted');
    }
  }
});

test('matching-tab-missing keeps the schedule retryable instead of dropping it', async () => {
  const { createOrUpdateSchedule, processDueSchedules, getScheduleForConversation, storageState } =
    loadScheduledMessageHelpers();

  const conversationUrl = 'https://claude.ai/chat/missing-tab';
  await createOrUpdateSchedule(
    {
      conversationUrl,
      snapshotText: 'hello',
      scheduledForMs: Date.now() + 120000,
      hasAttachmentExpectation: false,
    },
    { tab: { id: 5 } }
  );

  storageState.scheduled_message_queue_v2.items[0].scheduledForMs = Date.now() - 1000;
  await processDueSchedules();

  const schedule = await getScheduleForConversation(conversationUrl);
  assert.equal(schedule.status, 'retrying');
  assert.equal(schedule.lastErrorCode, 'matching_tab_missing');
  assert.equal(schedule.retryCount, 1);
});

test('startup expires pending schedules from a previous browser session', async () => {
  const { createOrUpdateSchedule, expirePendingSchedulesOnStartup, getScheduleForConversation } =
    loadScheduledMessageHelpers();

  const conversationUrl = 'https://claude.ai/chat/expired-session';
  await createOrUpdateSchedule(
    {
      conversationUrl,
      snapshotText: 'session',
      scheduledForMs: Date.now() + 120000,
      hasAttachmentExpectation: false,
    },
    { tab: { id: 3 } }
  );

  await expirePendingSchedulesOnStartup();

  const schedule = await getScheduleForConversation(conversationUrl);
  assert.equal(schedule.status, 'expired_session');
  assert.equal(schedule.lastErrorCode, 'expired_session');
});

test('successful execute results are not lost when the content reply arrives before waiter registration', async () => {
  const bridge = {
    handleScheduleExecuteResult: null,
  };
  const conversationUrl = 'https://claude.ai/chat/race-safe';
  const helpers = loadScheduledMessageHelpers({
    tabs: {
      query() {
        return Promise.resolve([{ id: 22, url: conversationUrl, active: true }]);
      },
      get() {
        return Promise.resolve({ id: 22, url: conversationUrl, active: true });
      },
      sendMessage() {
        bridge.handleScheduleExecuteResult({
          id: 'uuid-test',
          conversationUrl,
          outcome: {
            status: 'sent',
            code: 'sent',
          },
        });
        return Promise.resolve({ accepted: true });
      },
      create() {},
    },
  });

  bridge.handleScheduleExecuteResult = helpers.handleScheduleExecuteResult;

  const { createOrUpdateSchedule, getScheduleForConversation, executeSchedule } = helpers;

  await createOrUpdateSchedule(
    {
      conversationUrl,
      snapshotText: 'exact time race',
      scheduledForMs: Date.now() + 120000,
      hasAttachmentExpectation: false,
    },
    { tab: { id: 22 } }
  );

  const schedule = await getScheduleForConversation(conversationUrl);
  const result = await executeSchedule(schedule, {
    manual: false,
    preferredTabId: 22,
  });

  assert.equal(result.status, 'sent');
  assert.equal(await getScheduleForConversation(conversationUrl), null);
});
