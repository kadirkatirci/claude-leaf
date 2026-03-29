import { ALARM_NAME, DEFAULT_SETTINGS, STORAGE_KEYS } from './config.js';

const AUTO_RUN_DEBOUNCE_MS = 1200;
const AUTO_RUN_DEDUP_WINDOW_MS = 15000;
const FAILURE_ALERT_ALARM_PREFIX = 'cwg_failure_alert:';
const FAILURE_ALERT_REPEAT_COUNT = 3;
const FAILURE_ALERT_REPEAT_DELAY_MINUTES = 0.5;
const FAILURE_ALERT_RETENTION_MS = 6 * 60 * 60 * 1000;
const FAILURE_ALERT_ICON_URL = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" rx="24" fill="#D32F2F"/><path fill="#fff" d="M56 24h16l-3 54H59zm8 84a10 10 0 1 1 0-20 10 10 0 0 1 0 20"/></svg>'
)}`;
const pendingAutoRuns = new Map();
const recentAutoRuns = new Map();

function isClaudeUrl(url) {
  return typeof url === 'string' && url.startsWith('https://claude.ai/');
}

function detectPageType(pathname = '') {
  if (pathname === '/new' || pathname.endsWith('/new')) {
    return 'new_chat';
  }
  if (pathname === '/code' || pathname.startsWith('/code/')) {
    return 'code';
  }
  if (/\/project\/[^/]+\/chat\/[^/]+/.test(pathname)) {
    return 'project_chat';
  }
  if (/\/project\/[^/]+/.test(pathname) && !pathname.includes('/chat/')) {
    return 'project';
  }
  if (/\/chat\/[^/]+/.test(pathname)) {
    return 'conversation';
  }
  if (pathname.startsWith('/settings')) {
    return 'settings';
  }
  return 'other';
}

function isMonitoredPageType(pageType) {
  return pageType !== 'code';
}

function buildSignalFromUrl(url, trigger) {
  if (!isClaudeUrl(url)) {
    return null;
  }

  const parsedUrl = new URL(url);
  const pageType = detectPageType(parsedUrl.pathname);
  if (!isMonitoredPageType(pageType)) {
    return null;
  }

  return {
    trigger,
    href: url,
    pathname: parsedUrl.pathname,
    pageType,
    signalledAt: Date.now(),
    source: 'web_navigation',
  };
}

async function getSettings() {
  const result = await chrome.storage.local.get(STORAGE_KEYS.settings);
  return { ...DEFAULT_SETTINGS, ...(result[STORAGE_KEYS.settings] || {}) };
}

async function saveSettings(settings) {
  await chrome.storage.local.set({ [STORAGE_KEYS.settings]: settings });
}

async function scheduleAlarm() {
  const settings = await getSettings();
  await chrome.alarms.clear(ALARM_NAME);

  if (!settings.enabled) {
    return;
  }

  const periodInMinutes = Math.max(
    5,
    Number(settings.intervalMinutes) || DEFAULT_SETTINGS.intervalMinutes
  );
  chrome.alarms.create(ALARM_NAME, {
    delayInMinutes: periodInMinutes,
    periodInMinutes,
  });
}

async function getClaudeTabs() {
  const tabs = await chrome.tabs.query({ url: ['https://claude.ai/*'] });
  return tabs.filter(tab => {
    if (!tab.id || tab.discarded || !tab.url) {
      return false;
    }

    try {
      const pageType = detectPageType(new URL(tab.url).pathname);
      return isMonitoredPageType(pageType);
    } catch {
      return false;
    }
  });
}

function buildSummary(report) {
  const total = report?.checks?.length || 0;
  const failures = (report?.checks || []).filter(check => !check.pass).length;
  return {
    total,
    failures,
    status: failures === 0 ? 'healthy' : failures <= 2 ? 'warning' : 'critical',
  };
}

function getFailedChecks(report) {
  return (report?.checks || []).filter(check => !check.pass);
}

function getReportPathname(report) {
  if (report?.pageMeta?.pathname) {
    return report.pageMeta.pathname;
  }

  if (!report?.url) {
    return 'unknown';
  }

  try {
    return new URL(report.url).pathname;
  } catch {
    return 'unknown';
  }
}

function buildFailureSignature(report) {
  const failedChecks = getFailedChecks(report);
  if (failedChecks.length === 0 || !report?.url) {
    return null;
  }

  return `${getReportPathname(report)}|${failedChecks.map(check => check.id || 'unknown').join(',')}`;
}

function shouldScheduleFailureNotifications(report, previousReport) {
  const currentSignature = buildFailureSignature(report);
  if (!currentSignature) {
    return false;
  }

  return currentSignature !== buildFailureSignature(previousReport);
}

function buildFailureAlertPayload(report) {
  const failedChecks = getFailedChecks(report);
  if (failedChecks.length === 0 || !report?.url) {
    return null;
  }

  return {
    createdAt: Date.now(),
    tabId: report.tabId || null,
    url: report.url,
    pathname: getReportPathname(report),
    failureCount: failedChecks.length,
    failures: failedChecks.slice(0, 3).map(check => ({
      id: check.id || 'unknown',
      message: check.message || 'Check failed',
      severity: check.severity || 'unknown',
    })),
  };
}

function buildFailureNotificationTitle(payload, attempt, totalAttempts) {
  const failureLabel =
    payload.failureCount === 1 ? '1 failing check' : `${payload.failureCount} failing checks`;
  return `Claude Web Guardian Alert (${attempt}/${totalAttempts}) • ${failureLabel}`;
}

function buildFailureNotificationMessage(payload) {
  const lines = [payload.pathname];

  payload.failures.slice(0, 2).forEach(failure => {
    lines.push(`${failure.id}: ${failure.message}`);
  });

  if (payload.failureCount > 2) {
    lines.push(`+${payload.failureCount - 2} more failing checks`);
  }

  return lines.join('\n');
}

function buildFailureAlertBatchId(report) {
  return `${report.timestamp}-${report.tabId || 'no-tab'}`;
}

function buildFailureAlertAlarmName(batchId, attempt) {
  return `${FAILURE_ALERT_ALARM_PREFIX}${batchId}:${attempt}`;
}

function parseFailureAlertAlarmName(alarmName = '') {
  if (!alarmName.startsWith(FAILURE_ALERT_ALARM_PREFIX)) {
    return null;
  }

  const payload = alarmName.slice(FAILURE_ALERT_ALARM_PREFIX.length);
  const separatorIndex = payload.lastIndexOf(':');
  if (separatorIndex < 0) {
    return null;
  }

  return {
    batchId: payload.slice(0, separatorIndex),
    attempt: Number(payload.slice(separatorIndex + 1)),
  };
}

async function getPendingAlerts() {
  const result = await chrome.storage.local.get(STORAGE_KEYS.pendingAlerts);
  const alerts = result[STORAGE_KEYS.pendingAlerts] || {};
  const prunedAlerts = Object.fromEntries(
    Object.entries(alerts).filter(([, payload]) => {
      return Date.now() - (payload?.createdAt || 0) < FAILURE_ALERT_RETENTION_MS;
    })
  );

  if (Object.keys(prunedAlerts).length !== Object.keys(alerts).length) {
    await chrome.storage.local.set({ [STORAGE_KEYS.pendingAlerts]: prunedAlerts });
  }

  return prunedAlerts;
}

async function savePendingAlerts(alerts) {
  await chrome.storage.local.set({ [STORAGE_KEYS.pendingAlerts]: alerts });
}

async function showFailureNotification(batchId, payload, attempt, totalAttempts) {
  if (!chrome.notifications?.create) {
    return;
  }

  const notificationId = buildFailureAlertAlarmName(batchId, attempt);
  await chrome.notifications.create(notificationId, {
    type: 'basic',
    iconUrl: FAILURE_ALERT_ICON_URL,
    title: buildFailureNotificationTitle(payload, attempt, totalAttempts),
    message: buildFailureNotificationMessage(payload),
    priority: 2,
    requireInteraction: true,
  });
}

async function scheduleFailureNotifications(report, previousReport) {
  if (!shouldScheduleFailureNotifications(report, previousReport)) {
    return;
  }

  const payload = buildFailureAlertPayload(report);
  if (!payload) {
    return;
  }

  const batchId = buildFailureAlertBatchId(report);
  const pendingAlerts = await getPendingAlerts();
  pendingAlerts[batchId] = payload;
  await savePendingAlerts(pendingAlerts);

  await showFailureNotification(batchId, payload, 1, FAILURE_ALERT_REPEAT_COUNT);

  for (let attempt = 2; attempt <= FAILURE_ALERT_REPEAT_COUNT; attempt += 1) {
    chrome.alarms.create(buildFailureAlertAlarmName(batchId, attempt), {
      delayInMinutes: FAILURE_ALERT_REPEAT_DELAY_MINUTES * (attempt - 1),
    });
  }
}

async function handleFailureAlertAlarm(alarmName) {
  const parsed = parseFailureAlertAlarmName(alarmName);
  if (!parsed) {
    return false;
  }

  const pendingAlerts = await getPendingAlerts();
  const payload = pendingAlerts[parsed.batchId];
  if (!payload) {
    return true;
  }

  await showFailureNotification(
    parsed.batchId,
    payload,
    parsed.attempt,
    FAILURE_ALERT_REPEAT_COUNT
  );
  return true;
}

async function focusFailureAlertTarget(notificationId) {
  const parsed = parseFailureAlertAlarmName(notificationId);
  if (!parsed) {
    return;
  }

  const pendingAlerts = await getPendingAlerts();
  const payload = pendingAlerts[parsed.batchId];
  if (!payload) {
    return;
  }

  if (payload.tabId) {
    try {
      const tab = await chrome.tabs.get(payload.tabId);
      await chrome.tabs.update(tab.id, { active: true });
      if (typeof tab.windowId === 'number' && chrome.windows?.update) {
        await chrome.windows.update(tab.windowId, { focused: true });
      }
      return;
    } catch {
      // Fall through to opening a new tab below.
    }
  }

  if (payload.url) {
    await chrome.tabs.create({ url: payload.url });
  }
}

async function appendReport(report) {
  const settings = await getSettings();
  const { [STORAGE_KEYS.reports]: existing = [] } = await chrome.storage.local.get(
    STORAGE_KEYS.reports
  );
  const updated = [report, ...existing].slice(
    0,
    settings.historyLimit || DEFAULT_SETTINGS.historyLimit
  );
  await chrome.storage.local.set({
    [STORAGE_KEYS.reports]: updated,
    [STORAGE_KEYS.lastRunAt]: report.timestamp,
  });

  return existing[0] || null;
}

async function updateBadge(report) {
  const summary = buildSummary(report);
  const text = summary.failures === 0 ? 'OK' : String(summary.failures);
  const color =
    summary.status === 'healthy' ? '#2E7D32' : summary.status === 'warning' ? '#ED6C02' : '#D32F2F';

  await chrome.action.setBadgeText({ text });
  await chrome.action.setBadgeBackgroundColor({ color });
  await chrome.action.setTitle({
    title: `Claude Web Guardian\nStatus: ${summary.status}\nChecks: ${summary.total}\nFailures: ${summary.failures}`,
  });
}

async function sendBridgePayloadIfEnabled(report) {
  const settings = await getSettings();
  if (!settings.bridge?.enabled || !settings.bridge?.webhookUrl) {
    return;
  }

  try {
    await fetch(settings.bridge.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'claude-web-guardian', report }),
    });
  } catch (error) {
    console.warn('[CWG] Bridge webhook failed:', error?.message || error);
  }
}

function clearPendingAutoRun(tabId) {
  const pending = pendingAutoRuns.get(tabId);
  if (pending?.timeoutId) {
    clearTimeout(pending.timeoutId);
  }
  pendingAutoRuns.delete(tabId);
}

function clearPendingAutoRuns() {
  for (const tabId of pendingAutoRuns.keys()) {
    clearPendingAutoRun(tabId);
  }
}

function buildAutoRunSignature(signal = {}) {
  return `${signal.pageType || 'unknown'}|${signal.pathname || 'unknown'}`;
}

async function runCanaryForTab(tab, reason = 'manual', monitorMeta = null) {
  if (!tab?.id) {
    return { ok: false, reason: 'tab_missing' };
  }

  const settings = await getSettings();
  if (!settings.enabled && reason !== 'manual') {
    return { ok: false, reason: 'disabled' };
  }

  const response = await chrome.tabs.sendMessage(tab.id, {
    type: 'CWG_RUN_CANARY',
    payload: {
      reason,
      checks: settings.checks,
    },
  });

  const report = {
    timestamp: Date.now(),
    reason,
    tabId: tab.id,
    url: tab.url,
    checks: response?.checks || [],
    pageMeta: response?.pageMeta || null,
    monitorMeta,
  };

  const previousReport = await appendReport(report);
  await updateBadge(report);
  await sendBridgePayloadIfEnabled(report);
  await scheduleFailureNotifications(report, previousReport);
  return { ok: true, report };
}

async function runCanary(reason = 'manual') {
  const tabs = await getClaudeTabs();
  if (tabs.length === 0) {
    const noTabReport = {
      timestamp: Date.now(),
      reason,
      tabId: null,
      url: null,
      checks: [
        {
          id: 'tab_available',
          pass: false,
          severity: 'high',
          message: 'No active Claude tab found',
        },
      ],
    };
    await appendReport(noTabReport);
    await updateBadge(noTabReport);
    return { ok: false, reason: 'no_tab' };
  }

  return runCanaryForTab(tabs[0], reason);
}

async function runManualCanaryForPreferredTab(preferredTabId = null) {
  if (preferredTabId) {
    const targetedResult = await runCanaryForTabId(preferredTabId, 'manual');
    if (targetedResult?.ok || targetedResult?.reason !== 'tab_unreachable') {
      return targetedResult;
    }
  }

  return runCanary('manual');
}

async function runCanaryForTabId(tabId, reason = 'manual', monitorMeta = null) {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab?.url) {
      return { ok: false, reason: 'tab_missing_url' };
    }

    const pageType = detectPageType(new URL(tab.url).pathname);
    if (!isMonitoredPageType(pageType)) {
      return { ok: false, reason: 'unsupported_tab', pageType };
    }

    return await runCanaryForTab(tab, reason, monitorMeta);
  } catch (error) {
    return { ok: false, reason: 'tab_unreachable', error: error?.message || String(error) };
  }
}

function queueAutoRunForTab(tabId, signal = {}) {
  if (!tabId) {
    return { ok: false, reason: 'tab_missing' };
  }

  const signature = buildAutoRunSignature(signal);
  const recent = recentAutoRuns.get(tabId);
  const now = Date.now();

  if (
    recent &&
    recent.signature === signature &&
    now - recent.timestamp < AUTO_RUN_DEDUP_WINDOW_MS
  ) {
    return { ok: true, queued: false, reason: 'duplicate_signal' };
  }

  clearPendingAutoRun(tabId);

  const timeoutId = setTimeout(async () => {
    const pending = pendingAutoRuns.get(tabId);
    if (!pending) {
      return;
    }

    pendingAutoRuns.delete(tabId);
    const result = await runCanaryForTabId(tabId, 'page_change', pending.signal);
    if (result?.ok) {
      recentAutoRuns.set(tabId, {
        signature: pending.signature,
        timestamp: Date.now(),
      });
    }
  }, AUTO_RUN_DEBOUNCE_MS);

  pendingAutoRuns.set(tabId, {
    timeoutId,
    signature,
    signal,
  });

  return { ok: true, queued: true };
}

chrome.runtime.onInstalled.addListener(async () => {
  const result = await chrome.storage.local.get(STORAGE_KEYS.settings);
  if (!result[STORAGE_KEYS.settings]) {
    await saveSettings(DEFAULT_SETTINGS);
  }
  await scheduleAlarm();
});

chrome.runtime.onStartup.addListener(scheduleAlarm);

chrome.alarms.onAlarm.addListener(async alarm => {
  if (await handleFailureAlertAlarm(alarm.name)) {
    return;
  }

  if (alarm.name !== ALARM_NAME) {
    return;
  }
  await runCanary('heartbeat');
});

chrome.webNavigation.onHistoryStateUpdated.addListener(details => {
  const signal = buildSignalFromUrl(details.url, 'history_state_updated');
  if (!signal) {
    return;
  }

  queueAutoRunForTab(details.tabId, signal);
});

chrome.tabs.onRemoved.addListener(tabId => {
  clearPendingAutoRun(tabId);
  recentAutoRuns.delete(tabId);
});

chrome.notifications.onClicked.addListener(notificationId => {
  void focusFailureAlertTarget(notificationId);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    if (message?.type === 'CWG_GET_STATE') {
      const settings = await getSettings();
      const data = await chrome.storage.local.get([STORAGE_KEYS.reports, STORAGE_KEYS.lastRunAt]);
      sendResponse({
        settings,
        reports: data[STORAGE_KEYS.reports] || [],
        lastRunAt: data[STORAGE_KEYS.lastRunAt] || null,
      });
      return;
    }

    if (message?.type === 'CWG_SAVE_SETTINGS') {
      const nextSettings = { ...DEFAULT_SETTINGS, ...(message.payload || {}) };
      await saveSettings(nextSettings);
      if (!nextSettings.enabled) {
        clearPendingAutoRuns();
      }
      await scheduleAlarm();
      sendResponse({ ok: true });
      return;
    }

    if (message?.type === 'CWG_RUN_NOW') {
      const result = await runManualCanaryForPreferredTab(message.payload?.tabId || null);
      sendResponse(result);
      return;
    }

    if (message?.type === 'CWG_EXPORT_REPORTS') {
      const data = await chrome.storage.local.get(STORAGE_KEYS.reports);
      sendResponse({ reports: data[STORAGE_KEYS.reports] || [] });
      return;
    }

    if (message?.type === 'CWG_PAGE_SIGNAL') {
      const settings = await getSettings();
      if (!settings.enabled) {
        sendResponse({ ok: false, queued: false, reason: 'disabled' });
        return;
      }
      const queued = queueAutoRunForTab(_sender?.tab?.id, message.payload || {});
      sendResponse(queued);
      return;
    }
  })().catch(error => {
    sendResponse({ ok: false, error: error?.message || String(error) });
  });

  return true;
});
