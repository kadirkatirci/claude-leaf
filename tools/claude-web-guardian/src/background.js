import { ALARM_NAME, DEFAULT_SETTINGS, STORAGE_KEYS } from './config.js';

const AUTO_RUN_DEBOUNCE_MS = 1200;
const AUTO_RUN_DEDUP_WINDOW_MS = 15000;
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

  await appendReport(report);
  await updateBadge(report);
  await sendBridgePayloadIfEnabled(report);
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
