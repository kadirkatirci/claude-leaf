function $(id) {
  return document.getElementById(id);
}

function toIso(ts) {
  if (!ts) {
    return 'never';
  }
  return new Date(ts).toLocaleString();
}

function reportSummary(report) {
  if (!report) {
    return 'No report yet.';
  }
  const failures = (report.checks || []).filter(item => !item.pass);
  return JSON.stringify(
    {
      timestamp: toIso(report.timestamp),
      reason: report.reason,
      url: report.url,
      monitorMeta: report.monitorMeta,
      pageMeta: report.pageMeta,
      totalChecks: report.checks?.length || 0,
      failedChecks: failures.map(f => ({ id: f.id, message: f.message, severity: f.severity })),
    },
    null,
    2
  );
}

async function sendMessage(type, payload = null) {
  return chrome.runtime.sendMessage({ type, payload });
}

async function findClaudeTab() {
  const tabs = await chrome.tabs.query({ url: ['https://claude.ai/*'] });
  return tabs.find(tab => tab.active) || tabs[0] || null;
}

async function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function readForm() {
  return {
    enabled: $('enabled').checked,
    intervalMinutes: Number($('intervalMinutes').value) || 60,
    checks: {
      domCore: $('check_domCore').checked,
      editHistory: $('check_editHistory').checked,
      sidebar: $('check_sidebar').checked,
      theme: $('check_theme').checked,
      routes: $('check_routes').checked,
    },
    bridge: {
      enabled: $('bridgeEnabled').checked,
      webhookUrl: $('webhookUrl').value.trim(),
    },
  };
}

function writeForm(settings) {
  $('enabled').checked = !!settings.enabled;
  $('intervalMinutes').value = settings.intervalMinutes || 60;
  $('check_domCore').checked = !!settings.checks?.domCore;
  $('check_editHistory').checked = !!settings.checks?.editHistory;
  $('check_sidebar').checked = !!settings.checks?.sidebar;
  $('check_theme').checked = !!settings.checks?.theme;
  $('check_routes').checked = !!settings.checks?.routes;
  $('bridgeEnabled').checked = !!settings.bridge?.enabled;
  $('webhookUrl').value = settings.bridge?.webhookUrl || '';
}

function setStatus(text, tone = 'info') {
  const el = $('statusBox');
  el.textContent = text;
  el.style.borderColor = tone === 'error' ? '#a33' : tone === 'ok' ? '#2d6a4f' : '#333';
}

async function refresh() {
  const state = await sendMessage('CWG_GET_STATE');
  writeForm(state.settings);

  const last = (state.reports || [])[0] || null;
  const failed = (last?.checks || []).filter(x => !x.pass).length;

  if (!last) {
    setStatus('No report yet');
  } else if (failed === 0) {
    setStatus(`Healthy • last run ${toIso(last.timestamp)}`, 'ok');
  } else {
    setStatus(`${failed} checks failing • last run ${toIso(last.timestamp)}`, 'error');
  }

  $('reportBox').textContent = reportSummary(last);
}

$('saveBtn').addEventListener('click', async () => {
  await sendMessage('CWG_SAVE_SETTINGS', readForm());
  setStatus('Settings saved', 'ok');
  await refresh();
});

$('runNowBtn').addEventListener('click', async () => {
  setStatus('Running canary...');
  const tab = await findClaudeTab();
  const result = await sendMessage('CWG_RUN_NOW', { tabId: tab?.id || null });
  if (!result?.ok) {
    if (result?.reason === 'no_tab') {
      setStatus('Run skipped: no Claude tab available', 'error');
    } else {
      setStatus(`Run failed: ${result?.reason || result?.error || 'unknown'}`, 'error');
    }
  } else {
    setStatus('Run completed', 'ok');
  }
  await refresh();
});

$('exportBtn').addEventListener('click', async () => {
  const data = await sendMessage('CWG_EXPORT_REPORTS');
  await downloadJson(`claude-web-guardian-reports-${Date.now()}.json`, data.reports || []);
});

$('captureFixtureBtn').addEventListener('click', async () => {
  const tab = await findClaudeTab();
  if (!tab?.id) {
    setStatus('No Claude tab available for fixture capture', 'error');
    return;
  }

  try {
    const fixture = await chrome.tabs.sendMessage(tab.id, { type: 'CWG_CAPTURE_FIXTURE' });
    await downloadJson(
      `claude-fixture-${fixture.pageType}-${Date.now()}.json`,
      fixture || { error: 'no fixture payload' }
    );
    setStatus('Fixture captured & downloaded', 'ok');
  } catch (error) {
    setStatus(`Fixture capture failed: ${error?.message || error}`, 'error');
  }
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local') {
    return;
  }

  if (changes.cwg_reports || changes.cwg_last_run_at || changes.cwg_settings) {
    refresh().catch(error => setStatus(error?.message || String(error), 'error'));
  }
});

refresh().catch(error => setStatus(error?.message || String(error), 'error'));
