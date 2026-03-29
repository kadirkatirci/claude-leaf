import { ALARM_NAME, DEFAULT_SETTINGS, STORAGE_KEYS } from './config.js';

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

  const periodInMinutes = Math.max(5, Number(settings.intervalMinutes) || 60);
  chrome.alarms.create(ALARM_NAME, {
    delayInMinutes: 0.2,
    periodInMinutes,
  });
}

async function getClaudeTabs() {
  const tabs = await chrome.tabs.query({ url: ['https://claude.ai/*'] });
  return tabs.filter(tab => tab.id && !tab.discarded);
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

async function runCanary(reason = 'manual') {
  const settings = await getSettings();
  if (!settings.enabled && reason !== 'manual') {
    return { ok: false, reason: 'disabled' };
  }

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

  const tab = tabs[0];
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
  };

  await appendReport(report);
  await updateBadge(report);
  await sendBridgePayloadIfEnabled(report);
  return { ok: true, report };
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
  await runCanary('scheduled');
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
      await scheduleAlarm();
      sendResponse({ ok: true });
      return;
    }

    if (message?.type === 'CWG_RUN_NOW') {
      const result = await runCanary('manual');
      sendResponse(result);
      return;
    }

    if (message?.type === 'CWG_EXPORT_REPORTS') {
      const data = await chrome.storage.local.get(STORAGE_KEYS.reports);
      sendResponse({ reports: data[STORAGE_KEYS.reports] || [] });
    }
  })().catch(error => {
    sendResponse({ ok: false, error: error?.message || String(error) });
  });

  return true;
});
