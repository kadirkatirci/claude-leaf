/**
 * Background Service Worker
 * Handles extension-level events like installation and updates
 */

const WELCOME_URL = 'https://www.tedaitesnim.com/extensions/claude-extension/welcome';
const CHANGELOG_URL = 'https://www.tedaitesnim.com/extensions/claude-extension/changelog';
const UPDATE_CHECK_ALARM = 'update-check';
const UPDATE_CHECK_INTERVAL_MINUTES = 360; // 6 hours

// GA4 Measurement Protocol (background-only, no content access)
const GA4_MEASUREMENT_ID = 'G-75M7YXJ9X7';
const GA4_API_SECRET = 'F7JQkyp9QY2_lc9LbrE2dA';
const GA4_ENDPOINT = 'https://www.google-analytics.com/mp/collect';
const GA4_SESSION_EXPIRATION_MINUTES = 30;
const GA4_ENGAGEMENT_TIME_MS = 100;
const ANALYTICS_MESSAGE_TYPE = 'ANALYTICS_EVENT';
const ANALYTICS_ENABLED_DEFAULT = true;

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

function openTab(url) {
  chrome.tabs.create({ url });
}

function scheduleUpdateChecks() {
  chrome.alarms.create(UPDATE_CHECK_ALARM, {
    periodInMinutes: UPDATE_CHECK_INTERVAL_MINUTES,
  });
}

function checkForUpdates() {
  chrome.runtime.requestUpdateCheck((status, details) => {
    if (status === 'update_available') {
      chrome.runtime.reload();
      return;
    }
    if (status === 'throttled') {
      console.debug('Update check throttled:', details);
    }
  });
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
    if (!ALLOWED_PARAMS.has(key)) {
      continue;
    }
    if (value === undefined || value === null) {
      continue;
    }
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) {
        continue;
      }
      sanitized[key] = value;
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

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.type !== ANALYTICS_MESSAGE_TYPE) {
    return false;
  }

  sendAnalyticsEvent(message.name, message.params)
    .then(() => sendResponse({ ok: true }))
    .catch(error => {
      console.warn('Analytics send failed:', error);
      sendResponse({ ok: false });
    });

  return true;
});

// Open welcome page on first installation, changelog on real version updates
chrome.runtime.onInstalled.addListener(details => {
  if (details.reason === 'install') {
    openTab(WELCOME_URL);
  }

  if (details.reason === 'update') {
    const currentVersion = chrome.runtime.getManifest().version;
    if (details.previousVersion && details.previousVersion !== currentVersion) {
      openTab(CHANGELOG_URL);
    }
  }

  scheduleUpdateChecks();
  checkForUpdates();
});

// Check on browser startup
chrome.runtime.onStartup.addListener(() => {
  scheduleUpdateChecks();
  checkForUpdates();
});

// Periodic update checks
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === UPDATE_CHECK_ALARM) {
    checkForUpdates();
  }
});

// Apply updates as soon as they are ready
chrome.runtime.onUpdateAvailable.addListener(() => {
  chrome.runtime.reload();
});
