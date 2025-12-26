# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Chrome extension (Manifest V3) that enhances the Claude.ai web interface with productivity features: message navigation, edit history tracking, bookmarks, emoji markers, sidebar section collapse, content folding, and compact view for managing long conversations.

### Target Users
- Power users who have long conversations with Claude
- Users who want to track edited prompts and their history
- Anyone who needs to bookmark or mark important messages

### Key Features
| Feature | Description |
|---------|-------------|
| **Message Navigation** | Jump between messages with keyboard shortcuts (J/K) |
| **Edit History** | Track all prompt edits with version comparison |
| **Bookmarks** | Save and categorize important messages |
| **Emoji Markers** | Mark messages with emojis for quick reference |
| **Compact View** | Collapse long messages to manageable previews |
| **Sidebar Collapse** | Collapsible sidebar sections for cleaner UI |
| **Content Folding** | Fold code blocks and headings |

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
│   ├── MessageRegistry.js        # DOM message tracking
│   ├── storage/                  # Storage layer
│   │   ├── Store.js              # Base store class
│   │   └── adapters/             # Storage adapters
│   └── ...
├── managers/               # Centralized managers
│   ├── AsyncManager.js     # Timer/interval management
│   ├── DOMManager.js       # DOM operations
│   ├── KeyboardManager.js  # Keyboard shortcuts
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
└── components/             # UI components
    ├── primitives/         # Basic UI elements
    └── theme/              # Theme utilities
```

### Entry Point & Initialization

- **[src/content.js](src/content.js)** - Entry point, imports NavigationInterceptor FIRST (critical order)
- **[src/App.js](src/App.js)** - Main application manager, 7-step initialization sequence

The initialization order is critical:
1. NavigationInterceptor (must be on `window` before other imports)
2. Settings load
3. DOM ready check
4. Core infrastructure (DOMUtils, AsyncManager, DOMManager, ButtonFactory)
5. Managers (Theme, Keyboard, Observer)
6. Cross-tab sync
7. Feature modules (topologically sorted by dependencies)

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
| **CompactViewModule** | Collapse/expand long responses | Inside Navigation container |
| **BookmarkModule** | Save important messages | Yes |
| **EmojiMarkerModule** | Mark messages with emojis | Yes |
| **SidebarCollapseModule** | Collapsible sidebar sections | No (injects into sidebar) |
| **ContentFoldingModule** | Fold headings/code blocks | No (per-element UI) |

### Core Infrastructure

**Managers (`src/managers/`)**:
- **KeyboardManager** - Global keyboard shortcuts, prevents conflicts
- **ThemeManager** - Dynamic CSS custom properties
- **ObserverManager** - MutationObserver lifecycle
- **AsyncManager** - Centralized timer/interval management
- **DOMManager** - Single MutationObserver, safe HTML methods

**State Management (`src/stores/`)**:
- **SettingsStore** - Global settings with caching
- **BookmarkStore** - Bookmark data per conversation
- **MarkerStore** - Emoji marker data
- **ConversationStateStore** - Per-conversation UI state

Stores use adapters (`src/core/storage/adapters/`) for Chrome Local/Sync/IndexedDB storage.

### Storage Layer

```
Store (src/core/storage/Store.js)
  ├── ChromeLocalAdapter   # chrome.storage.local
  ├── ChromeSyncAdapter    # chrome.storage.sync
  └── IndexedDBAdapter     # IndexedDB for large data
```

**Store Configuration:** All store definitions are centralized in `src/config/storeConfig.js`. This file is the single source of truth - rollup generates `popup/storeConfig.json` from it during build.

**Current Storage Types:**
- `settings` - `chrome.storage.sync` (syncs across devices)
- `bookmarks`, `markers`, `editHistory` - IndexedDB (unlimited storage)
- `conversation-states` - IndexedDB with cache TTL

**Choosing an Adapter:**
- `sync` - Settings that sync across devices, 100KB limit
- `indexeddb` - Large data like bookmarks with full HTML content (recommended for data stores)
- `local` - Legacy, 5MB limit (avoid for new stores)

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
- `MESSAGES_UPDATED` - Message list changed
- `SETTINGS_CHANGED` - Settings modified
- `THEME_CHANGED` - Theme updated
- `NAVIGATION_CHANGED` - Page navigation occurred

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
