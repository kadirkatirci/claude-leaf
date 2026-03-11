# Google Analytics Implementation Guide

## 📊 Overview

This extension implements **GA4 Measurement Protocol** for comprehensive analytics tracking across all features. The system captures user interactions, performance metrics, and feature usage while respecting privacy and user consent.

**Key Facts:**
- **73 whitelisted events** with pre-defined parameters
- **51 allowed parameters** to prevent PII leakage
- **User-controlled**: Analytics can be disabled in settings
- **Privacy-first**: Full sanitization + whitelist validation
- **Performance-monitored**: Init time and UI scan metrics tracked

---

## 🏗️ Architecture

### Data Flow

```
Content Script/Popup
     ↓ chrome.runtime.sendMessage()
Analytics.js / popup/analytics.js
     ↓ MESSAGE_TYPE: ANALYTICS_EVENT
Background Service Worker (src/background.js)
     ↓ Validation + Sanitization + Session Management
GA4 Measurement Protocol
     ↓ HTTPS POST
GA4 Endpoint (https://www.google-analytics.com/mp/collect)
```

### Components

| Component | File | Responsibility |
|-----------|------|-----------------|
| **Content Analytics** | `src/analytics/Analytics.js` | Event emission + performance tracking |
| **Popup Analytics** | `popup/analytics.js` | Popup-specific event tracking |
| **GA4 Integration** | `src/background.js` | Event validation, sanitization, GA4 protocol |

---

## 🔐 GA4 Configuration

### Credentials
```javascript
const GA4_MEASUREMENT_ID = 'G-75M7YXJ9X7';
const GA4_API_SECRET = 'F7JQkyp9QY2_lc9LbrE2dA';
const GA4_ENDPOINT = 'https://www.google-analytics.com/mp/collect';
```

### Session Management
```javascript
// Client ID: Device-specific, persisted in chrome.storage.local
// Session ID: 30-minute timeout, stored in chrome.storage.session
const GA4_SESSION_EXPIRATION_MINUTES = 30;
const GA4_ENGAGEMENT_TIME_MS = 100;  // Auto-added to all events
```

### Required Permissions (manifest.json)
```json
{
  "permissions": ["storage", "activeTab", "alarms"],
  "host_permissions": [
    "https://claude.ai/*",
    "https://www.google-analytics.com/*",
    "https://region1.google-analytics.com/*"
  ]
}
```

---

## 📡 Events Reference

### 1. Navigation Events (3 events)

Triggered when users navigate between messages using keyboard shortcuts or buttons.

| Event | Parameters | Description |
|-------|-----------|-------------|
| `nav_prev` | `method`, `from_index`, `to_index`, `total_messages` | Navigate to previous message |
| `nav_next` | `method`, `from_index`, `to_index`, `total_messages` | Navigate to next message |
| `nav_top` | `method`, `from_index`, `to_index`, `total_messages` | Jump to first message |

**Location:** `src/modules/NavigationModule.js`

**Example:**
```javascript
trackEvent('nav_prev', {
  module: 'navigation',
  method: 'button',  // or 'keyboard'
  from_index: 5,
  to_index: 4,
  total_messages: 20,
});
```

---

### 2. Bookmark Events (18 events)

Comprehensive tracking for all bookmark-related interactions.

| Event | When Triggered |
|-------|----------------|
| `bookmark_add` | User saves a message as bookmark |
| `bookmark_remove` | User deletes a bookmark |
| `bookmark_category_change` | Bookmark moved to different category |
| `bookmark_panel_toggle` | Bookmark panel opened/closed |
| `bookmark_navigate` | User navigates to bookmarked message |
| `bookmark_manager_open` | Full bookmark manager opened |
| `bookmark_manager_close` | Bookmark manager closed |
| `bookmark_manager_category_select` | Category selected in manager |
| `bookmark_manager_sender_filter` | Filter by sender (user/assistant) |
| `bookmark_manager_view_change` | Switch between grid/list view |
| `bookmark_manager_search` | Search query entered |
| `bookmark_manager_bookmark_open` | Individual bookmark preview |
| `bookmark_manager_bookmark_delete` | Bookmark deleted from manager |
| `bookmark_manager_bookmark_navigate` | Navigate to bookmark from manager |
| `bookmark_manager_list_select` | List item selected |
| `bookmark_manager_category_create_open` | Create category modal opened |
| `bookmark_manager_category_create` | New category created |
| `bookmark_manager_category_delete` | Category deleted |

**Location:** `src/modules/BookmarkModule.js`, `src/modules/BookmarkModule/BookmarkManagerModal.js`

**Example:**
```javascript
trackEvent('bookmark_add', {
  module: 'bookmarks',
  method: 'button',
  category_id: 'work',
  sender: 'assistant',
  message_index: 12,
});
```

---

### 3. Emoji Marker Events (6 events)

Track emoji marker functionality.

| Event | Parameters |
|-------|-----------|
| `marker_add` | `method`, `emoji`, `sender`, `message_index` |
| `marker_remove` | `method` |
| `marker_update` | `method`, `from_emoji`, `to_emoji` |
| `marker_panel_toggle` | `method`, `state` |
| `marker_navigate` | `method`, `result`, `message_index` |

**Location:** `src/modules/EmojiMarkerModule.js`

---

### 4. Edit History Events (5 events)

Track message edit detection and history browsing.

| Event | When Triggered |
|-------|----------------|
| `edit_detected` | Edit detected in user message |
| `edit_panel_toggle` | Edit history panel opened/closed |
| `edit_modal_open` | Full edit history modal opened |
| `edit_branch_map_open` | Edit tree/branch map opened |
| `edit_scroll` | User scrolls in edit history |

**Location:** `src/modules/EditHistoryModule.js`

---

### 5. Performance Events (2 events)

Critical for monitoring extension health and performance.

#### `perf_init`
Emitted once per module during initialization.

```javascript
trackEvent('perf_init', {
  module: 'navigation',  // Module name
  init_ms: 145,          // Initialization time in ms
});
```

**All modules emit this on init:**
- NavigationModule
- BookmarkModule
- EditHistoryModule
- EmojiMarkerModule
- CompactViewModule
- SidebarCollapseModule
- ContentFoldingModule

#### `perf_scan`
Emitted regularly (throttled) during UI updates.

```javascript
trackEvent('perf_scan', {
  module: 'bookmarks',
  method: 'update_ui',
  scan_ms: 45,
  item_count: 12,
  bookmark_count: 12,
});
```

**Throttling:** 5-second minimum interval per `(module:method)` key to prevent spam.

---

### 6. Popup Events (12 events)

Track user interactions in the extension popup.

| Event | When Triggered |
|-------|----------------|
| `popup_open` | Popup opened |
| `popup_tab_view` | Tab viewed in popup |
| `popup_module_toggle` | Module enabled/disabled |
| `popup_settings_save` | Settings saved |
| `popup_settings_reset` | Settings reset to defaults |
| `popup_data_export` | Data exported to JSON |
| `popup_data_import` | Data imported from JSON |
| `popup_data_clear` | All data cleared |
| `popup_help_click` | Help link clicked |
| `popup_emoji_picker_open` | Emoji picker opened |
| `popup_emoji_favorite_add` | Emoji marked as favorite |
| `popup_emoji_favorite_remove` | Favorite emoji removed |

**Location:** `popup/popup.js`

---

### 7. Error Tracking Events (1 event)

Critical for production debugging and monitoring extension health.

| Event | When Triggered | Parameters |
|-------|----------------|------------|
| `error_occurred` | Uncaught error, promise rejection, or module failure | `error_type`, `error_message`, `error_stack`, `error_location`, `fatal`, `module`, `method` |

**Error Types:**
- `uncaught_error` - Global window.onerror
- `unhandled_promise` - Unhandled promise rejections
- `module_error` - Module initialization/runtime errors
- `runtime_error` - General runtime errors

**Location:** `src/utils/ErrorTracker.js` + global handlers in `src/content.js`

**Features:**
- Global error handlers (`window.onerror`, `unhandledrejection`)
- Automatic error sanitization (200 char messages, 500 char stacks)
- Throttling to prevent spam (same error max 1 per 5 seconds)
- Circuit breaker (max 50 errors per session)

**Example:**
```javascript
// Automatic capture
window.onerror = ...  // Caught automatically

// Manual tracking
import errorTracker from '../utils/ErrorTracker.js';
errorTracker.captureError({
  message: 'Failed to load bookmarks',
  error: err,
  type: 'runtime_error',
  module: 'bookmarks',
  method: 'load',
  fatal: false,
});
```

---

### 8. Session Lifecycle Events (2 events)

Track user sessions from initialization to cleanup.

| Event | When Triggered | Parameters |
|-------|----------------|------------|
| `session_start` | Extension initialized | `browser_name`, `browser_version`, `os_name`, `os_version`, `screen_width`, `screen_height` |
| `session_end` | Extension destroyed (page navigation/close) | `session_duration_ms`, `total_actions` |

**Location:** `src/utils/SessionTracker.js` + integration in `src/App.js`

**Browser/OS Detection:**
- Browsers: Chrome, Edge, Firefox
- OS: Windows, macOS, Linux
- Screen resolution capture
- Automatic context injection into all events

**Example:**
```javascript
// session_start event
{
  module: 'app',
  browser_name: 'chrome',
  browser_version: '120',
  os_name: 'macos',
  os_version: '14.2',
  screen_width: 1920,
  screen_height: 1080,
}

// session_end event
{
  module: 'app',
  session_duration_ms: 145000,
  total_actions: 42,
}
```

---

### 9. Funnel Tracking Events (1 event)

Track multi-step user flows to identify drop-off points.

| Event | When Triggered | Parameters |
|-------|----------------|------------|
| `funnel_step` | User progresses through multi-step flow | `funnel_name`, `step_number`, `step_name`, `step_status` |

**Supported Funnels:**
- `bookmark_creation` - 4 steps: initiate → select_message → choose_category → save_bookmark
- `edit_browsing` - Browse edit history
- `marker_creation` - Add emoji marker

**Step Status:**
- `started` - User initiated step
- `completed` - User finished step
- `abandoned` - User left flow without completing

**Location:** `trackFunnelStep()` in `src/analytics/Analytics.js`, integrated in modules

**Example:**
```javascript
import { trackFunnelStep } from '../analytics/Analytics.js';

// Bookmark creation flow
trackFunnelStep('bookmark_creation', 1, 'initiate', 'started', { module: 'bookmarks' });
trackFunnelStep('bookmark_creation', 2, 'select_message', 'completed', { message_index: 5 });
trackFunnelStep('bookmark_creation', 3, 'choose_category', 'completed', { category_id: 'work' });
trackFunnelStep('bookmark_creation', 4, 'save_bookmark', 'completed', { sender: 'assistant' });
```

**GA4 Funnel Analysis:**
1. Open GA4 Dashboard
2. Create custom report: Events → Group by funnel_name and step_number
3. Analyze drop-off rates between steps
4. Identify optimization opportunities

---

### 10. User Engagement Events (1 event)

Measure feature adoption breadth and power user behavior.

| Event | When Triggered | Parameters |
|-------|----------------|------------|
| `user_engagement_summary` | Session end or periodic summary | `modules_used_count`, `feature_breadth`, `power_user_score`, `total_actions` |

**Metrics:**
- `modules_used_count` - Number of distinct features user interacted with
- `feature_breadth` - Same as modules_used_count
- `power_user_score` - Engagement intensity (modules × avg_actions_per_module)
- `total_actions` - Total feature interactions in session

**Location:** `src/utils/EngagementTracker.js`

---

### 11. Frustration Detection Events (1 event)

Detect user frustration through rapid repeated actions.

| Event | When Triggered | Parameters |
|-------|----------------|------------|
| `rapid_action_detected` | 5+ identical actions within 2 seconds | `action_type`, `action_count`, `time_window_ms` |

**Patterns:**
- Rapid button clicks (5+ in 2 seconds)
- Repeated keyboard shortcuts
- Feature toggle spam

**Location:** `src/utils/FrustrationDetector.js`

**Example:**
```javascript
import frustrationDetector from '../utils/FrustrationDetector.js';

// In button click handler
frustrationDetector.recordAction('button_click');
// If 5+ clicks in 2 seconds, automatically emits:
// { action_type: 'button_click', action_count: 5, time_window_ms: 2000 }
```

---

## 🎯 Parameter Reference

### Allowed Parameters (51 total - Updated with Phase 1-4 additions)

All events go through sanitization to prevent sensitive data leakage.

| Parameter | Type | Max Length | Example | Purpose |
|-----------|------|-----------|---------|---------|
| `module` | string | 100 | "bookmarks" | Which module emitted |
| `method` | string | 100 | "button" | How it was triggered |
| `state` | string | 100 | "open" | State change |
| `count` | number | - | 5 | Item count |
| `total_messages` | number | - | 20 | Total message count |
| `from_index` | number | - | 5 | Start position |
| `to_index` | number | - | 6 | End position |
| `message_index` | number | - | 10 | Message position |
| `category_id` | string | 100 | "work" | Category identifier |
| `from_category` | string | 100 | "default" | Previous category |
| `to_category` | string | 100 | "work" | New category |
| `sender` | string | 100 | "assistant" | Message sender |
| `emoji` | string | 100 | "🔥" | Emoji character |
| `from_emoji` | string | 100 | "🔥" | Previous emoji |
| `to_emoji` | string | 100 | "❤️" | New emoji |
| `result` | string | 100 | "found" | Operation result |
| `page_type` | string | 100 | "conversation" | Current page type |
| `view_mode` | string | 100 | "grid" | UI view mode |
| `query_length` | number | - | 15 | Search query length |
| `tab_id` | string | 100 | "features" | Active tab |
| `data_type` | string | 100 | "bookmarks" | Data being imported/exported |
| `link_id` | string | 100 | "help-nav" | Link identifier |
| `init_ms` | number | - | 145 | Initialization time |
| `scan_ms` | number | - | 45 | Scan/update time |
| `item_count` | number | - | 12 | Total items |
| `bookmark_count` | number | - | 8 | Bookmark count |
| `marker_count` | number | - | 5 | Marker count |
| `edit_count` | number | - | 3 | Edit count |
| **Error Tracking** | | | | |
| `error_type` | string | 100 | "uncaught_error" | Error category |
| `error_message` | string | 200 | "Cannot read property" | Sanitized error message |
| `error_stack` | string | 500 | "at Function.js:42" | Error stack trace |
| `error_location` | string | 100 | "Analytics.js:15:3" | File location |
| `fatal` | number | - | 1 | Is error fatal (0 or 1) |
| **Session Tracking** | | | | |
| `session_duration_ms` | number | - | 3600000 | Session length in milliseconds |
| `total_actions` | number | - | 42 | Total actions in session |
| `browser_name` | string | 100 | "chrome" | Browser type |
| `browser_version` | string | 100 | "120" | Browser version |
| `os_name` | string | 100 | "macos" | Operating system |
| `os_version` | string | 100 | "14.2" | OS version |
| `screen_width` | number | - | 1920 | Screen width in pixels |
| `screen_height` | number | - | 1080 | Screen height in pixels |
| **Funnel Tracking** | | | | |
| `funnel_name` | string | 100 | "bookmark_creation" | Funnel identifier |
| `step_number` | number | - | 2 | Step position in funnel |
| `step_name` | string | 100 | "select_message" | Step name |
| `step_status` | string | 100 | "completed" | Step status (started/completed/abandoned) |
| **User Engagement** | | | | |
| `modules_used_count` | number | - | 5 | Number of modules used |
| `feature_breadth` | number | - | 0.71 | Feature breadth score (0-1) |
| `power_user_score` | number | - | 0.85 | Power user score (0-1) |
| **Frustration Detection** | | | | |
| `action_type` | string | 100 | "click" | Type of repeated action |
| `action_count` | number | - | 7 | Count of rapid actions |
| `time_window_ms` | number | - | 2000 | Time window for action detection |

### Auto-Injected Parameters

These are automatically added by the background service worker:

```javascript
{
  session_id: 1707638400000,           // Session ID
  engagement_time_msec: 100,           // GA4 required
  app_version: "1.0.0"                 // From manifest
}
```

---

## 💻 API Reference

### Content Script: `src/analytics/Analytics.js`

#### `trackEvent(name, params = {})`

Emit an analytics event from content script.

```javascript
import { trackEvent } from '../analytics/Analytics.js';

trackEvent('nav_prev', {
  method: 'button',
  from_index: 5,
  to_index: 4,
  total_messages: 20,
});
```

**Behavior:**
- Automatically adds `page_type` (from NavigationInterceptor)
- Silently fails if message cannot be sent
- No retry mechanism

---

#### `trackPerfScan(params = {}, { key, minIntervalMs = 5000 } = {})`

Emit a performance scan event with throttling.

```javascript
const scanStart = performance.now();
// ... perform work ...
trackPerfScan(
  {
    module: 'navigation',
    method: 'update_ui',
    scan_ms: Math.round(performance.now() - scanStart),
    item_count: this.messages.length,
  },
  { key: 'navigation:update_ui', minIntervalMs: 5000 }
);
```

**Parameters:**
- `params` - Event parameters (required)
- `key` - Unique key for throttling (defaults to `${module}:${method}`)
- `minIntervalMs` - Minimum milliseconds between emissions (default: 5000ms)

**Behavior:**
- Throttles identical metrics to prevent spam
- Useful for DOM scan/update operations
- Automatically deduplicates

---

### Popup: `popup/analytics.js`

Automatically creates `window.PopupAnalytics` object.

```javascript
window.PopupAnalytics.trackEvent(name, params);

// Usage in popup.js
trackEvent('popup_open', { tab_id: 'features' });
```

---

## 🛡️ Security & Privacy

### Whitelist-Based Architecture

**Event Whitelist:**
```javascript
const ALLOWED_EVENTS = new Set([
  'nav_prev', 'nav_next', 'nav_top',
  'bookmark_add', 'bookmark_remove', /* ... 64 more ... */
]);
```

Only events in this set are transmitted. Any other event name is rejected.

**Parameter Whitelist:**
```javascript
const ALLOWED_PARAMS = new Set([
  'module', 'method', 'state', /* ... 25 more ... */
]);
```

Only these parameters are transmitted. Unknown parameters are stripped.

---

### Sanitization Pipeline

```javascript
function sanitizeParams(params) {
  const sanitized = {};

  for (const [key, value] of Object.entries(params)) {
    // 1. Whitelist check
    if (!ALLOWED_PARAMS.has(key)) {
      continue;
    }

    // 2. Null/undefined removal
    if (value === undefined || value === null) {
      continue;
    }

    // 3. Type validation
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) continue;
      sanitized[key] = value;
    } else if (typeof value === 'boolean') {
      sanitized[key] = value;
    } else if (typeof value === 'string') {
      // 4. Length limit
      sanitized[key] = value.slice(0, 100);
    }
  }

  return sanitized;
}
```

---

### User Consent

Analytics can be disabled globally in settings:

```javascript
// settings.general.analyticsEnabled (default: true)

async function isAnalyticsEnabled() {
  const { settings } = await chrome.storage.sync.get(['settings']);

  const enabled = settings?.general?.analyticsEnabled === undefined
    ? ANALYTICS_ENABLED_DEFAULT
    : !!settings.general.analyticsEnabled;

  return enabled;
}
```

**Cache:** Setting is cached for 5 minutes to reduce storage access.

---

### Client Identification

**Client ID** is device-specific and persistent:

```javascript
async function getOrCreateClientId() {
  const stored = await chrome.storage.local.get(['ga4_client_id']);

  if (stored.ga4_client_id) {
    return stored.ga4_client_id;
  }

  const newClientId =
    (self.crypto?.randomUUID?.()) ||
    `${Date.now()}.${Math.random().toString(16).slice(2)}`;

  await chrome.storage.local.set({ ga4_client_id: newClientId });
  return newClientId;
}
```

**Note:** Client ID is NOT tied to user identity - it's purely for session tracking.

---

### Session Management

**Session ID** resets after 30 minutes of inactivity:

```javascript
async function getOrCreateSessionId() {
  const stored = await chrome.storage.session.get(['ga4_session']);
  const now = Date.now();
  const sessionData = stored.ga4_session;

  if (
    sessionData &&
    sessionData.session_id &&
    now - sessionData.timestamp < GA4_SESSION_EXPIRATION_MINUTES * 60 * 1000
  ) {
    return sessionData.session_id;
  }

  const newSession = { session_id: now, timestamp: now };
  await chrome.storage.session.set({ ga4_session: newSession });
  return newSession.session_id;
}
```

---

## 📊 Data Examples

### Navigation Event
```json
{
  "client_id": "550e8400-e29b-41d4-a716-446655440000",
  "events": [{
    "name": "nav_next",
    "params": {
      "page_type": "conversation",
      "module": "navigation",
      "method": "button",
      "from_index": 5,
      "to_index": 6,
      "total_messages": 20,
      "session_id": 1707638400000,
      "engagement_time_msec": 100,
      "app_version": "1.0.0"
    }
  }]
}
```

### Bookmark Event
```json
{
  "name": "bookmark_add",
  "params": {
    "page_type": "conversation",
    "module": "bookmarks",
    "method": "button",
    "category_id": "work",
    "sender": "assistant",
    "message_index": 12,
    "session_id": 1707638400000,
    "engagement_time_msec": 100,
    "app_version": "1.0.0"
  }
}
```

### Performance Event
```json
{
  "name": "perf_scan",
  "params": {
    "page_type": "conversation",
    "module": "bookmarks",
    "method": "update_ui",
    "scan_ms": 45,
    "item_count": 12,
    "bookmark_count": 8,
    "session_id": 1707638400000,
    "engagement_time_msec": 100,
    "app_version": "1.0.0"
  }
}
```

---

## 🔧 Implementation Guide

### Adding a New Event

1. **Add event name to ALLOWED_EVENTS** (src/background.js):
```javascript
const ALLOWED_EVENTS = new Set([
  // ... existing events ...
  'my_new_event',  // Add here
]);
```

2. **Add any new parameters to ALLOWED_PARAMS** (src/background.js):
```javascript
const ALLOWED_PARAMS = new Set([
  // ... existing params ...
  'my_param',  // Add here
]);
```

3. **Emit the event** in your module:
```javascript
import { trackEvent } from '../analytics/Analytics.js';

trackEvent('my_new_event', {
  module: 'myModule',
  method: 'button',
  my_param: 'value',
});
```

4. **Test** in GA4 Real-time Dashboard

---

### Performance Monitoring Pattern

```javascript
async init() {
  const initStart = performance.now();

  // ... initialization code ...

  trackEvent('perf_init', {
    module: 'myModule',
    init_ms: Math.round(performance.now() - initStart),
  });
}

updateUI() {
  const scanStart = performance.now();

  // ... UI update code ...

  trackPerfScan(
    {
      module: 'myModule',
      method: 'update_ui',
      scan_ms: Math.round(performance.now() - scanStart),
      item_count: items.length,
    },
    { key: 'myModule:update_ui', minIntervalMs: 5000 }
  );
}
```

---

## 🐛 Debugging

### Check Analytics Status

```javascript
// In browser console on claude.ai:

// Is analytics enabled?
chrome.storage.sync.get('settings', result => {
  console.log('Analytics:', result.settings?.general?.analyticsEnabled);
});

// What's my client ID?
chrome.storage.local.get('ga4_client_id', result => {
  console.log('Client ID:', result.ga4_client_id);
});

// Current session?
chrome.storage.session.get('ga4_session', result => {
  console.log('Session:', result.ga4_session);
});

// Storage usage?
chrome.storage.local.getBytesInUse(bytes => {
  console.log('Used:', bytes, 'bytes');
});
```

### Monitor Events

Open DevTools Network tab and look for requests to:
```
https://www.google-analytics.com/mp/collect
```

Each request contains the analytics event payload.

### Enable Debug Mode

Check `src/config/debug.js` for analytics-specific flags (if added):

```javascript
const DEBUG_FLAGS = {
  analytics: false,  // Set to true to see analytics logs
};
```

---

## 📈 Analytics Dashboard

### GA4 Real-time Dashboard
- **View:** Analytics Dashboard → Real-time
- **See:** Events as they're sent
- **Check:** Parameters and values

### GA4 Events Report
- **View:** Analytics Dashboard → Events
- **See:** Event frequency over time
- **Filter:** By event name or parameter

### Custom Reports
Create reports by:
- Event name (e.g., "nav_prev" usage)
- Parameter values (e.g., "bookmark_add" by category)
- Page type (conversation vs. other)
- Module performance metrics

---

## ⚠️ Known Limitations

| Limitation | Impact | Notes |
|-----------|--------|-------|
| **No Offline Caching** | Events lost if offline | No retry mechanism |
| **No PII Allowed** | Privacy protected | Sanitization prevents leaks |
| **30-min Session Timeout** | Sessions reset | GA4 standard |
| **5-min Setting Cache** | Delay in disabling | Optimizes storage access |
| **Device-Level Tracking** | No cross-device | Can't track users across devices |
| **No Event Deduplication** | Some duplication possible | 5-sec throttle for perf_scan helps |

---

## 🔄 Event Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│ User Action (click button, press key, etc.)             │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│ Module calls: trackEvent('event_name', { params })      │
│ Location: src/modules/*.js                              │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│ Analytics.js:                                           │
│ - Add page_type                                         │
│ - Send via chrome.runtime.sendMessage()                 │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│ Background Service Worker (src/background.js):          │
│ 1. Check if event in ALLOWED_EVENTS ✓                   │
│ 2. Check if analytics enabled in settings ✓             │
│ 3. Get/create client ID & session ID                    │
│ 4. Sanitize params (whitelist + validation)             │
│ 5. Build GA4 payload                                    │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│ Fetch to GA4 Endpoint:                                  │
│ POST https://www.google-analytics.com/mp/collect        │
│ ?measurement_id=G-75M7YXJ9X7                            │
│ &api_secret=F7JQkyp9QY2_lc9LbrE2dA                      │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│ GA4 Analytics Dashboard                                 │
│ - Real-time events                                      │
│ - Custom reports                                        │
│ - Performance metrics                                   │
└─────────────────────────────────────────────────────────┘
```

---

## 📚 References

- **GA4 Measurement Protocol:** https://developers.google.com/analytics/devguides/collection/protocol/ga4
- **Chrome Storage API:** https://developer.chrome.com/docs/extensions/reference/storage/
- **Manifest V3:** https://developer.chrome.com/docs/extensions/mv3/

---

## 📝 Changelog

### v1.0.0 (Current)
- ✅ Full GA4 Measurement Protocol integration
- ✅ 66 whitelisted events
- ✅ 28 allowed parameters
- ✅ User consent controls
- ✅ Performance monitoring (init + scan)
- ✅ Whitelist-based security architecture
