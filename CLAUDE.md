# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Chrome extension (Manifest V3) that enhances the Claude.ai web interface with productivity features such as message navigation, edit history tracking, bookmarks, and emoji markers. Compact view, sidebar collapse, and content folding remain in development and are currently dev-disabled.

### Target Users
- Power users who have long conversations with Claude
- Users who want to track edited prompts and their history
- Anyone who needs to bookmark or mark important messages

### Key Features
| Feature | Description |
|---------|-------------|
| **Message Navigation** | Jump between messages with on-screen navigation controls |
| **Edit History** | Track all prompt edits with version comparison |
| **Bookmarks** | Save and categorize important messages |
| **Emoji Markers** | Mark messages with emojis for quick reference |
| **Compact View** | In development, currently dev-disabled |
| **Sidebar Collapse** | In development, currently dev-disabled |
| **Content Folding** | In development, currently dev-disabled |

## Development Commands

```bash
npm install        # Install dependencies
npm run build      # Build for production (creates dist/content.bundle.js)
npm run watch      # Watch mode for development
npm run dev        # Alias for watch mode
npm run lint       # Run ESLint
npm run lint:fix   # Run ESLint with auto-fix
npm run format     # Format code with Prettier
```

### Testing the Extension
1. Run `npm run build` or `npm run watch`
2. Open `chrome://extensions` with Developer mode enabled
3. Click "Load unpacked" and select this folder
4. Navigate to https://claude.ai to test

### Standalone Guardian Tool

The repo also contains `tools/claude-web-guardian/`, a separate MV3 unpacked extension for live-page canary monitoring on `claude.ai`.

- It is not bundled into the main Claude Leaf extension or release zip.
- It auto-runs on monitored page changes, keeps a heartbeat fallback, and sends up to three desktop notifications for new failures.
- It ignores `https://claude.ai/code/...` routes.
- Manual `Run now` targets the active Claude tab from the popup.

Guardian-specific tests:

```bash
node --test test/claude-web-guardian.test.js test/claude-web-guardian-background.test.js
```

### Pre-commit Hooks
The project uses Husky + lint-staged for pre-commit validation:
- ESLint runs on staged `.js` files
- Prettier formats all staged files

## Architecture Overview

### Directory Structure
```
src/
├── content.js              # Entry point (loads NavigationInterceptor first!)
├── App.js                  # Main application manager
├── config/                 # Configuration files
│   ├── debug.js            # Debug flags and debugLog utility
│   ├── DevConfig.js        # Development feature flags
│   ├── ModuleConstants.js  # Module-related constants
│   ├── storeConfig.js      # Single source of truth for store definitions
│   └── themes.js           # Theme definitions
├── core/                   # Core infrastructure
│   ├── NavigationInterceptor.js  # SPA navigation handling
│   ├── FixedButtonMixin.js       # Sidebar button behavior
│   ├── MessageHub.js             # Message coordination
│   ├── MessageCache.js           # Shared message query cache
│   ├── storage/                  # Storage layer
│   │   ├── Store.js              # Base store class
│   │   └── adapters/             # Storage adapters
│   └── ...
├── managers/               # Centralized managers
│   ├── AsyncManager.js     # Deprecated compatibility manager
│   ├── DOMManager.js       # Deprecated compatibility manager
│   ├── KeyboardManager.js  # Internal keyboard shortcut infrastructure
│   ├── ObserverManager.js  # MutationObserver lifecycle
│   └── ThemeManager.js     # Dynamic theming
├── stores/                 # State management
│   ├── SettingsStore.js    # Global settings
│   ├── BookmarkStore.js    # Bookmark data
│   ├── MarkerStore.js      # Emoji marker data
│   └── ...
├── modules/                # Feature modules
│   ├── BaseModule.js       # Base class for all modules
│   ├── NavigationModule.js
│   ├── BookmarkModule/
│   ├── EditHistoryModule/
│   └── ...
├── utils/                  # Utility functions
│   ├── EventBus.js         # Pub/sub event system
│   ├── DOMUtils.js         # DOM helpers
│   └── ...
├── components/             # UI components
│   ├── primitives/         # Basic UI elements
│   └── theme/              # Theme utilities
└── tools/
    └── claude-web-guardian/ # Standalone monitoring extension
```

### Entry Point & Initialization

- **[src/content.js](src/content.js)** - Entry point, imports NavigationInterceptor FIRST (critical order)
- **[src/App.js](src/App.js)** - Main application manager with staged startup and SPA-safe restarts

The initialization order is critical:
1. NavigationInterceptor (must be on `window` before other imports)
2. Settings load
3. DOM ready check
4. Core infrastructure (`DOMUtils`, legacy compatibility managers, fixed-button factory wiring)
5. Core services start (`panelManager`, `messageHub`)
6. Managers (Theme, Keyboard, Observer)
7. Cross-tab sync (settings store)
8. Feature modules (topologically sorted by dependencies)
9. Global listeners + session tracking

### Module System

All feature modules extend **[BaseModule](src/modules/BaseModule.js)** which provides:
- Settings access via `settingsStore`
- Event subscription lifecycle management
- Theme access (`getTheme()`)
- URL change handling for SPA navigation
- Automatic cleanup on destroy

#### Module Lifecycle
```javascript
class MyModule extends BaseModule {
  constructor() {
    super('myModule');  // Module name for settings
  }

  async init() {
    await super.init();      // Load settings, check enabled
    if (!this.enabled) return;

    // Initialize module...
    this.setupEventListeners();
  }

  destroy() {
    // Cleanup resources...
    super.destroy();  // Cleanup subscriptions
  }
}
```

Modules with fixed sidebar buttons use **[FixedButtonMixin](src/core/FixedButtonMixin.js)** for standardized visibility handling.

### Feature Modules (`src/modules/`)

| Module | Purpose | Fixed Button |
|--------|---------|--------------|
| **NavigationModule** | Message-to-message navigation | Yes (container with 3 buttons) |
| **EditHistoryModule** | Track edited prompts with version history | Yes |
| **CompactViewModule** | In development, currently dev-disabled | Inside Navigation container |
| **BookmarkModule** | Save important messages | Yes |
| **EmojiMarkerModule** | Mark messages with emojis | Yes |
| **SidebarCollapseModule** | In development, currently dev-disabled | No (injects into sidebar) |
| **ContentFoldingModule** | In development, currently dev-disabled | No (per-element UI) |

### Edit History Flow (Current)

Edit history and branch map now use a two-layer capture pipeline:

1. **MessageHub detection**
   - Detects edit textarea sessions and emits `HUB_EDIT_SESSION_CHANGED`
   - Emits `HUB_VERSION_CHANGED` when version counters change

2. **Draft + immediate promotion**
   - `EditDraftCaptureService` listens edit click/submit and textarea input
   - Captures draft snapshots (`type: draft`) while editing
   - Promotes pre-edit content immediately to history on save

3. **History + snapshot persistence**
   - `HistoryCaptureService.captureHistory()` stores canonical edited versions
   - `HistoryCaptureService.captureSnapshot()` stores conversation snapshot paths
   - `HistoryCaptureService.captureVersionSnapshot(entry)` forces a version-aware snapshot
     on immediate promotion so Branch Map and Edit Modal stay aligned (first-edit case)

4. **Branch Map rendering**
   - `BranchMapModal` loads `snapshots + history`
   - `BranchTreeBuilder` builds branch columns from snapshots and resolves full content via history

### Core Infrastructure

**Managers (`src/managers/`)**:
- **KeyboardManager** - Global keyboard shortcuts, prevents conflicts
- **ThemeManager** - Dynamic CSS custom properties
- **ObserverManager** - MutationObserver lifecycle
- **AsyncManager** - Deprecated compatibility manager, removal planned
- **DOMManager** - Deprecated compatibility manager, removal planned

> **Note:** `AsyncManager` and `DOMManager` remain in the codebase for staged removal only. Do not add new usages.

**State Management (`src/stores/`)**:
- **SettingsStore** - Global settings with caching
- **BookmarkStore** - Bookmark data per conversation
- **MarkerStore** - Emoji marker data
- **ConversationStateStore** - Per-conversation UI state

Stores use adapters (`src/core/storage/adapters/`) for Chrome Local/Sync/IndexedDB storage.

### Storage Layer

```
Store (src/core/storage/Store.js)
  ├── ChromeSyncAdapter    # chrome.storage.sync (settings)
  └── IndexedDBAdapter     # IndexedDB for large data (bookmarks, markers, etc.)
```

> **Note:** ChromeLocalAdapter exists but is not currently used. Cross-tab sync via StorageSync only works for chrome.storage-based stores (settings).

**Store Configuration:** All store definitions are centralized in `src/config/storeConfig.js`. This file is the single source of truth - rollup generates `popup/storeConfig.json` from it during build.

**Current Storage Types:**
- `settings` - `chrome.storage.sync` (syncs across devices)
- `bookmarks`, `markers`, `editHistory` - IndexedDB (unlimited storage)
- `conversation-states` - IndexedDB with cache TTL

**Choosing an Adapter:**
- `sync` - Settings that sync across devices, 100KB limit, cross-tab sync supported
- `indexeddb` - Large data like bookmarks (recommended for data stores, no cross-tab sync currently)

### Popup-Content Script Communication

Popup and content script run in different contexts:
- **Popup**: `chrome-extension://` origin
- **Content script**: `https://claude.ai` origin

IndexedDB is origin-specific, so popup cannot directly access content script's IndexedDB. Solution:

1. **Content script** (App.js) registers message handlers in constructor via `setupChromeMessageListener()`
2. **Popup** (dataService.js) sends messages via `chrome.tabs.sendMessage()`

Message types:
- `STORE_READ` - Read data from IndexedDB store
- `STORE_WRITE` - Write data to IndexedDB store
- `STORE_CLEAR` - Clear IndexedDB store

### Visibility & Navigation

The extension handles Claude.ai's SPA navigation through:
- **[NavigationInterceptor](src/core/NavigationInterceptor.js)** - Intercepts History API, detects page type
- **[VisibilityManager](src/utils/VisibilityManager.js)** - 4-layer detection (History + Popstate + Interval + DOM)

Buttons hide on non-conversation pages and show on conversation pages automatically via `FixedButtonMixin`.

### Event System

Uses **[EventBus](src/utils/EventBus.js)** for cross-module communication:
```javascript
// Emit
this.emit(Events.MESSAGES_UPDATED, data);
// Subscribe (auto-cleanup via BaseModule)
this.subscribe(Events.SETTINGS_CHANGED, callback);
```

**Available Events:**
- `HUB_MESSAGE_COUNT_CHANGED` - Message count changed
- `HUB_VERSION_CHANGED` - Edit version changed
- `HUB_CONTENT_CHANGED` - Content changed (hub-level)
- `HUB_EDIT_SESSION_CHANGED` - Inline edit session started/ended/switched
- `URL_CHANGED` - SPA URL/page changed
- `SETTINGS_CHANGED` - Settings modified
- `FEATURE_TOGGLED` - Feature toggled
- `MESSAGES_UPDATED` - Legacy compatibility event

## Key Patterns

### Creating a New Module with Fixed Button
```javascript
class YourModule extends BaseModule {
  async init() {
    await super.init();
    if (!this.enabled) return;

    FixedButtonMixin.enhance(this);
    await this.createFixedButton({
      id: 'your-button-id',
      icon: '...',
      position: { right: '30px', transform: 'translateY(0)' },
      onClick: () => this.handleClick(),
      showCounter: true
    });
    this.setupVisibilityListener();
  }

  destroy() {
    this.destroyFixedButton();
    super.destroy();
  }
}
```

### Module Communication
```javascript
// Direct access when needed
const app = window.claudeProductivity;
const navigation = app.getModule('navigation');
```

### Debug Logging
Use `debugLog` from `src/config/debug.js` instead of `console.log`:
```javascript
import { debugLog, DEBUG_FLAGS } from '../config/debug.js';

// Conditional logging
debugLog('navigation', 'Page changed:', newPath);

// Check if debugging is enabled
if (DEBUG_FLAGS.navigation) {
  // expensive debug operation
}
```

## Debug Commands

In browser console:
```javascript
// System health
window.claudeProductivity.verifyArchitecture()  // System health check
window.claudeProductivity.healthCheck()         // Initialization status

// Navigation state
window.__navigationInterceptor.getState()       // Current page state
window.__visibilityManager.getStatus()          // Visibility state

// Module access
window.claudeProductivity.getModule('navigation')  // Get module instance
window.claudeProductivity.modules                  // All modules

// Storage
window.__stateManager.getStorageInfo()          // Storage statistics
```

## Analytics

This extension includes **Google Analytics 4 (GA4)** tracking using the Measurement Protocol. All analytics events are whitelisted and sanitized before transmission to prevent data leakage.

**Key Features:**
- ✅ 66 whitelisted events across all modules
- ✅ User-controlled: Can be disabled in settings
- ✅ Privacy-first: Full parameter sanitization + whitelist validation
- ✅ Performance monitoring: Initialization and UI scan metrics
- ✅ HTTPS-only: GA4 Measurement Protocol endpoint

**See:** [ANALYTICS.md](ANALYTICS.md) for complete reference including:
- Event catalog and parameter definitions
- Security & privacy implementation
- API reference for adding new events
- GA4 configuration and debugging

**Quick Start:**
```javascript
import { trackEvent, trackPerfScan } from '../analytics/Analytics.js';

// Basic event
trackEvent('nav_next', {
  method: 'button',
  from_index: 5,
  to_index: 6,
  total_messages: 20,
});

// Performance metric (throttled)
trackPerfScan({
  module: 'myModule',
  method: 'update_ui',
  scan_ms: 45,
  item_count: 12,
}, { minIntervalMs: 5000 });
```

## Build Info

- **Bundler**: Rollup with `@rollup/plugin-node-resolve`
- **Output**: `dist/content.bundle.js` (IIFE format, ~300KB)
- **Styles**: `styles.css` loaded via manifest
- **Linting**: ESLint v9 (flat config)
- **Formatting**: Prettier

## Common Tasks

### Adding a New Setting
1. Add default value in `src/core/SettingsCache.js` → `getDefaults()`
2. Add to popup UI in `popup/popup.html` and `popup/popup.js`
3. Use in module: `this.getSetting('yourSetting')`

### Adding a New Store

1. **Add to storeConfig.js** (single source of truth):
```javascript
// In src/config/storeConfig.js
export const STORE_CONFIG = {
  // ... existing stores
  yourStore: {
    storageType: 'indexeddb',  // or 'sync', 'local'
    version: 1,
    defaultData: { items: [] },
    exportable: true,  // Include in export/import
    label: 'Your Store',
  },
};
```

2. **Create the store file**:
```javascript
// In src/stores/YourStore.js
import { stateManager } from '../core/StateManager.js';
import { getStoreConfig } from '../config/storeConfig.js';

const CONFIG = getStoreConfig('yourStore');

export class YourStore {
  constructor() {
    this.store = stateManager.createStore('yourStore', {
      adapter: CONFIG.storageType,
      version: CONFIG.version,
      defaultData: CONFIG.defaultData,
    });
  }
  // Add your methods...
}

export const yourStore = new YourStore();
```

3. **If using IndexedDB**, add to App.js message handler:
```javascript
// In setupChromeMessageListener()
const storeMap = {
  // ... existing stores
  yourStore: yourStore,
};
```

### Handling SPA Navigation
```javascript
import navigationInterceptor from '../core/NavigationInterceptor.js';

// Subscribe to navigation events
const unsubscribe = navigationInterceptor.onNavigate(event => {
  if (event.isConversationPage) {
    // Handle conversation page
  }
});

// Get current state
const state = navigationInterceptor.getState();
```

## Troubleshooting

### Extension Not Loading
1. Check `chrome://extensions` for errors
2. Verify `npm run build` completed successfully
3. Check browser console for initialization errors

### Buttons Not Showing
1. Verify you're on a conversation page (`/chat/...`)
2. Check `window.__visibilityManager.getStatus()`
3. Ensure module is enabled in settings

### Settings Not Saving
1. Check `chrome.storage.local.get(null, console.log)`
2. Verify no storage quota exceeded
3. Check for errors in background script

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes following the patterns above
4. Run `npm run lint` to check for issues
5. Submit a pull request

### Code Style
- Use `debugLog` instead of `console.log`
- Extend `BaseModule` for new features
- Use `FixedButtonMixin` for sidebar buttons
- Clean up resources in `destroy()` methods
