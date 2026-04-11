/**
 * Background Service Worker
 * Handles extension-level events like installation, updates, analytics,
 * and scheduled message orchestration.
 */

const WELCOME_URL = 'https://www.tedaitesnim.com/extensions/claude-extension/welcome';
const CHANGELOG_URL = 'https://www.tedaitesnim.com/extensions/claude-extension/changelog';
const CHANGELOG_SOURCE_UPDATE = 'extension-update';
const FIXTURE_HARNESS_PATH = 'test-support/playwright/extension-harness.html';

const GA4_MEASUREMENT_ID = 'G-75M7YXJ9X7';
const GA4_API_SECRET = 'F7JQkyp9QY2_lc9LbrE2dA';
const GA4_ENDPOINT = 'https://www.google-analytics.com/mp/collect';
const GA4_SESSION_EXPIRATION_MINUTES = 30;
const GA4_ENGAGEMENT_TIME_MS = 100;
const ANALYTICS_MESSAGE_TYPE = 'ANALYTICS_EVENT';
const ANALYTICS_ENABLED_DEFAULT = true;

const SCHEDULE_MESSAGE_TYPES = {
  GET_FOR_CONVERSATION: 'SCHEDULE_GET_FOR_CONVERSATION',
  CREATE_OR_UPDATE: 'SCHEDULE_CREATE_OR_UPDATE',
  CANCEL: 'SCHEDULE_CANCEL',
  SEND_NOW: 'SCHEDULE_SEND_NOW',
  EXECUTE: 'SCHEDULE_EXECUTE',
  EXECUTE_RESULT: 'SCHEDULE_EXECUTE_RESULT',
};

const SCHEDULE_STORAGE_KEY = 'scheduled_message_queue_v2';
const SCHEDULE_ALARM_NAME = 'claude_leaf_scheduled_message_v2';
const SCHEDULE_STATUS = {
  PENDING: 'pending',
  RETRYING: 'retrying',
  SENT: 'sent',
  CANCELLED: 'cancelled',
  FAILED: 'failed',
  EXPIRED_SESSION: 'expired_session',
};
const ACTIVE_SCHEDULE_STATUSES = new Set([SCHEDULE_STATUS.PENDING, SCHEDULE_STATUS.RETRYING]);
const RETRY_BACKOFF_MS = [15000, 30000, 60000];
const EXECUTION_TIMEOUT_MS = 6000;
const RETRYABLE_ERROR_CODES = new Set([
  'matching_tab_missing',
  'content_unavailable',
  'execute_timeout',
  'composer_not_ready',
  'composer_busy',
  'send_control_unavailable',
  'conversation_mismatch',
]);

const ALLOWED_EVENTS = new Set([
  'nav_prev',
  'nav_next',
  'nav_top',
  'bookmark_add',
  'bookmark_remove',
  'bookmark_category_change',
  'bookmark_panel_toggle',
  'bookmark_navigate',
  'bookmark_manager_open',
  'bookmark_manager_close',
  'bookmark_manager_category_select',
  'bookmark_manager_sender_filter',
  'bookmark_manager_view_change',
  'bookmark_manager_search',
  'bookmark_manager_bookmark_open',
  'bookmark_manager_bookmark_delete',
  'bookmark_manager_bookmark_navigate',
  'bookmark_manager_list_select',
  'bookmark_manager_category_create_open',
  'bookmark_manager_category_create',
  'bookmark_manager_category_delete',
  'marker_add',
  'marker_remove',
  'marker_update',
  'marker_panel_toggle',
  'marker_navigate',
  'edit_detected',
  'edit_panel_toggle',
  'edit_modal_open',
  'edit_branch_map_open',
  'edit_scroll',
  'perf_init',
  'perf_scan',
  'popup_open',
  'popup_tab_view',
  'popup_module_toggle',
  'popup_settings_save',
  'popup_settings_reset',
  'popup_data_export',
  'popup_data_import',
  'popup_data_clear',
  'popup_help_click',
  'popup_emoji_picker_open',
  'popup_emoji_favorite_add',
  'popup_emoji_favorite_remove',
  'error_occurred',
  'session_start',
  'session_end',
  'funnel_step',
  'user_engagement_summary',
  'rapid_action_detected',
  'analytics_health',
  'scheduled_message_create',
  'scheduled_message_cancel',
  'scheduled_message_reschedule',
  'scheduled_message_send_now',
  'scheduled_message_sent',
  'scheduled_message_retry',
  'scheduled_message_fail',
  'usage_tracker_tooltip_open',
]);

const ALLOWED_PARAMS = new Set([
  'module',
  'method',
  'state',
  'count',
  'total_messages',
  'from_index',
  'to_index',
  'message_index',
  'category_id',
  'from_category',
  'to_category',
  'sender',
  'emoji',
  'from_emoji',
  'to_emoji',
  'result',
  'page_type',
  'view_mode',
  'query_length',
  'tab_id',
  'data_type',
  'link_id',
  'init_ms',
  'scan_ms',
  'item_count',
  'message_count',
  'bookmark_count',
  'marker_count',
  'edit_count',
  'error_type',
  'error_message',
  'error_stack',
  'error_location',
  'fatal',
  'session_duration_ms',
  'total_actions',
  'funnel_name',
  'step_number',
  'step_name',
  'step_status',
  'browser_name',
  'browser_version',
  'os_name',
  'os_version',
  'screen_width',
  'screen_height',
  'modules_used_count',
  'feature_breadth',
  'power_user_score',
  'action_type',
  'action_count',
  'time_window_ms',
]);

let analyticsEnabledCache = null;
let analyticsEnabledCacheTime = 0;
const ANALYTICS_CACHE_TTL_MS = 5 * 60 * 1000;
let fixtureAutomationModePromise = null;
const pendingExecutionWaiters = new Map();
const cachedExecutionOutcomes = new Map();
const EXECUTION_OUTCOME_CACHE_MS = 15000;

function openTab(url) {
  chrome.tabs.create({ url });
}

function isFixtureAutomationMode() {
  if (typeof fetch !== 'function' || typeof chrome.runtime?.getURL !== 'function') {
    return Promise.resolve(false);
  }

  if (!fixtureAutomationModePromise) {
    fixtureAutomationModePromise = fetch(chrome.runtime.getURL(FIXTURE_HARNESS_PATH))
      .then(response => response.ok)
      .catch(() => false);
  }

  return fixtureAutomationModePromise;
}

function buildChangelogUrl(previousVersion, currentVersion) {
  const url = new URL(CHANGELOG_URL);
  url.searchParams.set('source', CHANGELOG_SOURCE_UPDATE);
  url.searchParams.set('from', previousVersion);
  url.searchParams.set('to', currentVersion);
  return url.toString();
}

async function getOrCreateClientId() {
  const stored = await chrome.storage.local.get(['ga4_client_id']);
  if (stored.ga4_client_id) {
    return stored.ga4_client_id;
  }

  const newClientId =
    (self.crypto && self.crypto.randomUUID && self.crypto.randomUUID()) ||
    `${Date.now()}.${Math.random().toString(16).slice(2)}`;

  await chrome.storage.local.set({ ga4_client_id: newClientId });
  return newClientId;
}

async function getOrCreateSessionId() {
  const stored = await chrome.storage.session.get(['ga4_session']);
  const now = Date.now();
  const sessionData = stored.ga4_session;

  if (
    sessionData &&
    sessionData.session_id &&
    sessionData.timestamp &&
    now - sessionData.timestamp < GA4_SESSION_EXPIRATION_MINUTES * 60 * 1000
  ) {
    return sessionData.session_id;
  }

  const newSession = { session_id: now, timestamp: now };
  await chrome.storage.session.set({ ga4_session: newSession });
  return newSession.session_id;
}

async function isAnalyticsEnabled() {
  const now = Date.now();
  if (analyticsEnabledCache !== null && now - analyticsEnabledCacheTime < ANALYTICS_CACHE_TTL_MS) {
    return analyticsEnabledCache;
  }

  try {
    const { settings } = await chrome.storage.sync.get(['settings']);
    const enabled =
      settings?.general?.analyticsEnabled === undefined
        ? ANALYTICS_ENABLED_DEFAULT
        : !!settings.general.analyticsEnabled;

    analyticsEnabledCache = enabled;
    analyticsEnabledCacheTime = now;
    return enabled;
  } catch {
    return ANALYTICS_ENABLED_DEFAULT;
  }
}

function sanitizeParams(params) {
  if (!params || typeof params !== 'object') {
    return {};
  }

  const sanitized = {};
  for (const [key, value] of Object.entries(params)) {
    if (!ALLOWED_PARAMS.has(key) || value === undefined || value === null) {
      continue;
    }

    if (typeof value === 'number') {
      if (Number.isFinite(value)) {
        sanitized[key] = value;
      }
      continue;
    }

    if (typeof value === 'boolean') {
      sanitized[key] = value;
      continue;
    }

    if (typeof value === 'string') {
      sanitized[key] = value.slice(0, 100);
    }
  }

  return sanitized;
}

async function sendAnalyticsEvent(name, params) {
  if (!ALLOWED_EVENTS.has(name)) {
    return;
  }

  if (await isFixtureAutomationMode()) {
    return;
  }

  if (!(await isAnalyticsEnabled())) {
    return;
  }

  const clientId = await getOrCreateClientId();
  const sessionId = await getOrCreateSessionId();
  const eventParams = sanitizeParams(params);

  eventParams.session_id = sessionId;
  eventParams.engagement_time_msec = GA4_ENGAGEMENT_TIME_MS;
  eventParams.app_version = chrome.runtime.getManifest().version;

  const body = {
    client_id: clientId,
    events: [
      {
        name,
        params: eventParams,
      },
    ],
  };

  const url = `${GA4_ENDPOINT}?measurement_id=${GA4_MEASUREMENT_ID}&api_secret=${GA4_API_SECRET}`;

  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function normalizeConversationUrl(rawUrl) {
  if (!rawUrl) {
    return '';
  }

  try {
    const url = new URL(rawUrl);
    return `${url.origin}${url.pathname}`;
  } catch {
    return String(rawUrl);
  }
}

function isNewChatPathname(pathname = '') {
  return pathname === '/new' || pathname.endsWith('/new');
}

function isNewConversationUrl(rawUrl) {
  if (!rawUrl) {
    return false;
  }

  try {
    const url = new URL(rawUrl, 'https://claude.ai');
    return isNewChatPathname(url.pathname);
  } catch {
    return String(rawUrl).endsWith('/new');
  }
}

function normalizeSnapshotText(value) {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

function isActiveSchedule(record) {
  return !!record && ACTIVE_SCHEDULE_STATUSES.has(record.status);
}

function isRetryableCode(code) {
  return RETRYABLE_ERROR_CODES.has(code);
}

function createEmptyScheduleStore() {
  return { items: [] };
}

async function readScheduleStore() {
  const stored = await chrome.storage.local.get([SCHEDULE_STORAGE_KEY]);
  const rawStore = stored[SCHEDULE_STORAGE_KEY];
  if (!rawStore || !Array.isArray(rawStore.items)) {
    return createEmptyScheduleStore();
  }
  return { items: rawStore.items };
}

async function writeScheduleStore(store) {
  await chrome.storage.local.set({
    [SCHEDULE_STORAGE_KEY]: {
      items: store.items,
    },
  });
}

function getScheduleIndex(store, conversationUrl) {
  return store.items.findIndex(
    item =>
      normalizeConversationUrl(item.conversationUrl) === normalizeConversationUrl(conversationUrl)
  );
}

function buildScheduleRecord(existingRecord, payload, sender) {
  const now = Date.now();
  return {
    id:
      existingRecord?.id ||
      (self.crypto?.randomUUID?.() ?? `sched_${now}_${Math.random().toString(16).slice(2)}`),
    conversationUrl: normalizeConversationUrl(payload.conversationUrl),
    snapshotText: normalizeSnapshotText(payload.snapshotText),
    scheduledForMs: Number(payload.scheduledForMs),
    hasAttachmentExpectation: payload.hasAttachmentExpectation === true,
    status: SCHEDULE_STATUS.PENDING,
    retryCount: 0,
    createdAt: existingRecord?.createdAt || now,
    updatedAt: now,
    lastErrorCode: null,
    sourceTabId: sender?.tab?.id ?? existingRecord?.sourceTabId ?? null,
  };
}

function getNextBackoffMs(retryCount) {
  return RETRY_BACKOFF_MS[retryCount - 1] || null;
}

function clearPendingExecutionWaiter(scheduleId) {
  const waiter = pendingExecutionWaiters.get(scheduleId);
  if (!waiter) {
    return;
  }
  clearTimeout(waiter.timeoutId);
  pendingExecutionWaiters.delete(scheduleId);
}

function clearCachedExecutionOutcome(scheduleId) {
  const cached = cachedExecutionOutcomes.get(scheduleId);
  if (!cached) {
    return;
  }

  clearTimeout(cached.timeoutId);
  cachedExecutionOutcomes.delete(scheduleId);
}

function cacheExecutionOutcome(scheduleId, outcome) {
  clearCachedExecutionOutcome(scheduleId);

  const timeoutId = setTimeout(() => {
    cachedExecutionOutcomes.delete(scheduleId);
  }, EXECUTION_OUTCOME_CACHE_MS);

  cachedExecutionOutcomes.set(scheduleId, {
    outcome,
    timeoutId,
  });
}

function takeCachedExecutionOutcome(scheduleId) {
  const cached = cachedExecutionOutcomes.get(scheduleId);
  if (!cached) {
    return null;
  }

  clearTimeout(cached.timeoutId);
  cachedExecutionOutcomes.delete(scheduleId);
  return cached.outcome;
}

function waitForExecutionResult(scheduleId) {
  clearPendingExecutionWaiter(scheduleId);
  const cachedOutcome = takeCachedExecutionOutcome(scheduleId);
  if (cachedOutcome) {
    return Promise.resolve(cachedOutcome);
  }

  return new Promise(resolve => {
    const timeoutId = setTimeout(() => {
      pendingExecutionWaiters.delete(scheduleId);
      resolve({
        status: SCHEDULE_STATUS.RETRYING,
        code: 'execute_timeout',
      });
    }, EXECUTION_TIMEOUT_MS);

    pendingExecutionWaiters.set(scheduleId, {
      resolve,
      timeoutId,
    });
  });
}

async function syncScheduleAlarm(storeOverride = null) {
  const store = storeOverride || (await readScheduleStore());
  const activeItems = store.items
    .filter(isActiveSchedule)
    .sort((left, right) => left.scheduledForMs - right.scheduledForMs);

  if (activeItems.length === 0) {
    await chrome.alarms?.clear?.(SCHEDULE_ALARM_NAME);
    return;
  }

  const nextSchedule = activeItems[0];
  await chrome.alarms?.clear?.(SCHEDULE_ALARM_NAME);
  chrome.alarms?.create?.(SCHEDULE_ALARM_NAME, {
    when: Math.max(Date.now() + 25, nextSchedule.scheduledForMs),
  });
}

function buildScheduleResponse(record) {
  return record ? { schedule: record } : { schedule: null };
}

async function adoptScheduleConversationUrl(store, index, conversationUrl) {
  const current = store.items[index];
  const normalizedConversationUrl = normalizeConversationUrl(conversationUrl);

  if (
    !normalizedConversationUrl ||
    normalizedConversationUrl === normalizeConversationUrl(current?.conversationUrl) ||
    isNewConversationUrl(normalizedConversationUrl)
  ) {
    return current || null;
  }

  const conflictingIndex = getScheduleIndex(store, normalizedConversationUrl);
  if (conflictingIndex >= 0 && conflictingIndex !== index) {
    return current || null;
  }

  const updated = {
    ...current,
    conversationUrl: normalizedConversationUrl,
    updatedAt: Date.now(),
  };

  store.items[index] = updated;
  await writeScheduleStore(store);
  return updated;
}

async function getScheduleForConversation(conversationUrl, senderTabId = null) {
  const store = await readScheduleStore();
  const index = getScheduleIndex(store, conversationUrl);
  if (index >= 0) {
    return store.items[index];
  }

  if (!senderTabId) {
    return null;
  }

  const fallbackIndex = store.items.findIndex(
    item =>
      isActiveSchedule(item) &&
      item.sourceTabId === senderTabId &&
      isNewConversationUrl(item.conversationUrl)
  );
  if (fallbackIndex < 0) {
    return null;
  }

  return adoptScheduleConversationUrl(store, fallbackIndex, conversationUrl);
}

async function createOrUpdateSchedule(message, sender) {
  const conversationUrl = normalizeConversationUrl(message.conversationUrl);
  if (!conversationUrl) {
    throw new Error('Conversation URL is required');
  }

  const scheduledForMs = Number(message.scheduledForMs);
  if (!Number.isFinite(scheduledForMs) || scheduledForMs <= Date.now()) {
    throw new Error('scheduledForMs must be a future timestamp');
  }

  const snapshotText = normalizeSnapshotText(message.snapshotText);
  if (!snapshotText && message.hasAttachmentExpectation !== true) {
    throw new Error('snapshotText or attachment is required');
  }

  const store = await readScheduleStore();
  const index = getScheduleIndex(store, conversationUrl);
  const existingRecord = index >= 0 ? store.items[index] : null;
  const wasActive = isActiveSchedule(existingRecord);
  const record = buildScheduleRecord(existingRecord, message, sender);

  if (index >= 0) {
    store.items[index] = record;
  } else {
    store.items.push(record);
  }

  await writeScheduleStore(store);
  await syncScheduleAlarm(store);

  void sendAnalyticsEvent(wasActive ? 'scheduled_message_reschedule' : 'scheduled_message_create', {
    module: 'scheduledMessage',
    method: 'background',
    state: record.status,
  });

  return buildScheduleResponse(record);
}

async function cancelSchedule(message, sender) {
  let store = await readScheduleStore();
  const conversationUrl = normalizeConversationUrl(message.conversationUrl);
  let index = message.id
    ? store.items.findIndex(item => item.id === message.id)
    : getScheduleIndex(store, conversationUrl);

  if (index < 0 && !message.id) {
    const schedule = await getScheduleForConversation(conversationUrl, sender?.tab?.id);
    if (schedule?.id) {
      store = await readScheduleStore();
      index = store.items.findIndex(item => item.id === schedule.id);
    }
  }

  if (index < 0) {
    return { cancelled: false };
  }

  const [removed] = store.items.splice(index, 1);
  await writeScheduleStore(store);
  await syncScheduleAlarm(store);

  if (removed && isActiveSchedule(removed)) {
    void sendAnalyticsEvent('scheduled_message_cancel', {
      module: 'scheduledMessage',
      method: 'background',
      state: removed.status,
    });
  }

  return { cancelled: true };
}

async function findMatchingClaudeTab(conversationUrl, preferredTabId = null) {
  const normalizedTarget = normalizeConversationUrl(conversationUrl);

  if (preferredTabId && chrome.tabs?.get) {
    try {
      const preferredTab = await chrome.tabs.get(preferredTabId);
      if (normalizeConversationUrl(preferredTab?.url) === normalizedTarget) {
        return preferredTab;
      }
    } catch {
      // Fall back to query.
    }
  }

  const tabs = await chrome.tabs.query({ url: ['https://claude.ai/*'] });
  const matchingTabs = tabs.filter(tab => normalizeConversationUrl(tab.url) === normalizedTarget);
  matchingTabs.sort((left, right) => Number(Boolean(right.active)) - Number(Boolean(left.active)));
  return matchingTabs[0] || null;
}

async function dispatchExecutionRequest(schedule, tabId, reason) {
  const outcomePromise = waitForExecutionResult(schedule.id);

  try {
    await chrome.tabs.sendMessage(tabId, {
      type: SCHEDULE_MESSAGE_TYPES.EXECUTE,
      schedule,
      reason,
    });
  } catch {
    clearPendingExecutionWaiter(schedule.id);
    return {
      status: SCHEDULE_STATUS.RETRYING,
      code: 'content_unavailable',
    };
  }

  return outcomePromise;
}

async function markScheduleFailure(scheduleId, conversationUrl, errorCode) {
  const store = await readScheduleStore();
  const index = scheduleId
    ? store.items.findIndex(item => item.id === scheduleId)
    : getScheduleIndex(store, conversationUrl);

  if (index < 0) {
    return { schedule: null };
  }

  const current = store.items[index];
  const updated = {
    ...current,
    status:
      errorCode === 'expired_session' ? SCHEDULE_STATUS.EXPIRED_SESSION : SCHEDULE_STATUS.FAILED,
    updatedAt: Date.now(),
    lastErrorCode: errorCode,
  };

  store.items[index] = updated;
  await writeScheduleStore(store);
  await syncScheduleAlarm(store);

  void sendAnalyticsEvent('scheduled_message_fail', {
    module: 'scheduledMessage',
    method: 'background',
    result: errorCode,
    count: updated.retryCount,
  });

  return { schedule: updated };
}

async function applyExecutionOutcome(schedule, outcome, { manual = false, eventName = null } = {}) {
  const store = await readScheduleStore();
  const index = store.items.findIndex(item => item.id === schedule.id);
  if (index < 0) {
    return { status: SCHEDULE_STATUS.CANCELLED };
  }

  const current = store.items[index];
  const code = outcome?.code || null;
  const status = outcome?.status || SCHEDULE_STATUS.FAILED;

  if (status === SCHEDULE_STATUS.SENT) {
    store.items.splice(index, 1);
    await writeScheduleStore(store);
    await syncScheduleAlarm(store);

    void sendAnalyticsEvent(eventName || 'scheduled_message_sent', {
      module: 'scheduledMessage',
      method: manual ? 'send_now' : 'background',
      result: code || 'sent',
    });

    return { status: SCHEDULE_STATUS.SENT };
  }

  if (manual) {
    const updated = {
      ...current,
      updatedAt: Date.now(),
      lastErrorCode: code || current.lastErrorCode,
    };
    store.items[index] = updated;
    await writeScheduleStore(store);
    await syncScheduleAlarm(store);
    return {
      status: updated.status,
      schedule: updated,
      errorCode: code,
    };
  }

  if (status === SCHEDULE_STATUS.RETRYING && isRetryableCode(code)) {
    if (current.retryCount >= RETRY_BACKOFF_MS.length) {
      const failed = {
        ...current,
        status: SCHEDULE_STATUS.FAILED,
        updatedAt: Date.now(),
        lastErrorCode: 'retry_exhausted',
      };
      store.items[index] = failed;
      await writeScheduleStore(store);
      await syncScheduleAlarm(store);

      void sendAnalyticsEvent('scheduled_message_fail', {
        module: 'scheduledMessage',
        method: 'background',
        result: 'retry_exhausted',
        count: failed.retryCount,
      });

      return { status: SCHEDULE_STATUS.FAILED, schedule: failed };
    }

    const nextRetryCount = current.retryCount + 1;
    const updated = {
      ...current,
      status: SCHEDULE_STATUS.RETRYING,
      retryCount: nextRetryCount,
      scheduledForMs: Date.now() + getNextBackoffMs(nextRetryCount),
      updatedAt: Date.now(),
      lastErrorCode: code,
    };

    store.items[index] = updated;
    await writeScheduleStore(store);
    await syncScheduleAlarm(store);

    void sendAnalyticsEvent('scheduled_message_retry', {
      module: 'scheduledMessage',
      method: 'background',
      result: code,
      count: updated.retryCount,
    });

    return { status: SCHEDULE_STATUS.RETRYING, schedule: updated };
  }

  const failed = {
    ...current,
    status: code === 'expired_session' ? SCHEDULE_STATUS.EXPIRED_SESSION : SCHEDULE_STATUS.FAILED,
    updatedAt: Date.now(),
    lastErrorCode: code || 'send_failed',
  };

  store.items[index] = failed;
  await writeScheduleStore(store);
  await syncScheduleAlarm(store);

  void sendAnalyticsEvent('scheduled_message_fail', {
    module: 'scheduledMessage',
    method: 'background',
    result: failed.lastErrorCode,
    count: failed.retryCount,
  });

  return { status: failed.status, schedule: failed };
}

async function executeSchedule(schedule, options = {}) {
  const targetTab = await findMatchingClaudeTab(schedule.conversationUrl, options.preferredTabId);
  if (!targetTab) {
    return applyExecutionOutcome(
      schedule,
      {
        status: SCHEDULE_STATUS.RETRYING,
        code: 'matching_tab_missing',
      },
      options
    );
  }

  const outcome = await dispatchExecutionRequest(
    schedule,
    targetTab.id,
    options.manual ? 'send_now' : 'scheduled'
  );

  return applyExecutionOutcome(schedule, outcome, options);
}

async function sendNow(message, sender) {
  const schedule = await getScheduleForConversation(message.conversationUrl, sender?.tab?.id);
  if (!schedule || !isActiveSchedule(schedule)) {
    return { status: SCHEDULE_STATUS.CANCELLED };
  }

  if (message.native === true) {
    const store = await readScheduleStore();
    const index = store.items.findIndex(item => item.id === schedule.id);
    if (index >= 0) {
      store.items.splice(index, 1);
      await writeScheduleStore(store);
      await syncScheduleAlarm(store);
    }

    void sendAnalyticsEvent('scheduled_message_send_now', {
      module: 'scheduledMessage',
      method: 'native_send',
      result: 'sent',
    });

    return { status: SCHEDULE_STATUS.SENT };
  }

  return executeSchedule(schedule, {
    manual: true,
    preferredTabId: sender?.tab?.id ?? schedule.sourceTabId,
    eventName: 'scheduled_message_send_now',
  });
}

async function processDueSchedules() {
  const store = await readScheduleStore();
  const dueSchedules = store.items
    .filter(schedule => isActiveSchedule(schedule) && schedule.scheduledForMs <= Date.now())
    .sort((left, right) => left.scheduledForMs - right.scheduledForMs);

  for (const schedule of dueSchedules) {
    await executeSchedule(schedule, {
      manual: false,
      preferredTabId: schedule.sourceTabId,
    });
  }
}

async function expirePendingSchedulesOnStartup() {
  const store = await readScheduleStore();
  let changed = false;

  store.items = store.items.map(item => {
    if (!isActiveSchedule(item)) {
      return item;
    }

    changed = true;
    return {
      ...item,
      status: SCHEDULE_STATUS.EXPIRED_SESSION,
      updatedAt: Date.now(),
      lastErrorCode: 'expired_session',
    };
  });

  if (changed) {
    await writeScheduleStore(store);
  }

  await syncScheduleAlarm(store);
}

function handleScheduleExecuteResult(message) {
  const outcome = message.outcome || {};
  const waiter = pendingExecutionWaiters.get(message.id);
  if (waiter) {
    clearTimeout(waiter.timeoutId);
    pendingExecutionWaiters.delete(message.id);
    waiter.resolve(outcome);
    return { acknowledged: true };
  }

  cacheExecutionOutcome(message.id, outcome);

  if (
    outcome.status === SCHEDULE_STATUS.FAILED ||
    outcome.status === SCHEDULE_STATUS.EXPIRED_SESSION
  ) {
    return markScheduleFailure(message.id, message.conversationUrl, outcome.code || 'send_failed');
  }

  return { acknowledged: true };
}

function isScheduleMessage(message) {
  return Object.values(SCHEDULE_MESSAGE_TYPES).includes(message?.type);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === ANALYTICS_MESSAGE_TYPE) {
    sendAnalyticsEvent(message.name, message.params)
      .then(() => sendResponse({ ok: true }))
      .catch(error => {
        console.warn('Analytics send failed:', error);
        sendResponse({ ok: false });
      });
    return true;
  }

  if (!isScheduleMessage(message)) {
    return false;
  }

  Promise.resolve()
    .then(async () => {
      switch (message.type) {
        case SCHEDULE_MESSAGE_TYPES.GET_FOR_CONVERSATION:
          return buildScheduleResponse(
            await getScheduleForConversation(message.conversationUrl, sender?.tab?.id)
          );
        case SCHEDULE_MESSAGE_TYPES.CREATE_OR_UPDATE:
          return createOrUpdateSchedule(message, sender);
        case SCHEDULE_MESSAGE_TYPES.CANCEL:
          return cancelSchedule(message, sender);
        case SCHEDULE_MESSAGE_TYPES.SEND_NOW:
          return sendNow(message, sender);
        case SCHEDULE_MESSAGE_TYPES.EXECUTE_RESULT:
          return handleScheduleExecuteResult(message);
        default:
          return { error: `Unhandled message type: ${message.type}` };
      }
    })
    .then(response => sendResponse(response))
    .catch(error => {
      console.warn('Scheduled message action failed:', error);
      sendResponse({ error: error.message });
    });

  return true;
});

chrome.runtime.onInstalled.addListener(details => {
  void isFixtureAutomationMode().then(isFixtureRun => {
    if (isFixtureRun) {
      return;
    }

    if (details.reason === 'install') {
      openTab(WELCOME_URL);
    }

    if (details.reason === 'update') {
      const currentVersion = chrome.runtime.getManifest().version;
      if (details.previousVersion && details.previousVersion !== currentVersion) {
        openTab(buildChangelogUrl(details.previousVersion, currentVersion));
      }
    }
  });
});

chrome.runtime.onStartup?.addListener?.(() => {
  void expirePendingSchedulesOnStartup();
});

chrome.alarms?.onAlarm?.addListener?.(alarm => {
  if (alarm?.name !== SCHEDULE_ALARM_NAME) {
    return;
  }

  void processDueSchedules();
});

chrome.runtime.onUpdateAvailable.addListener(() => {
  chrome.runtime.reload();
});
