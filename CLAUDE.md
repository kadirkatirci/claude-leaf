# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Chrome extension that enhances the Claude.ai web interface with productivity features including message navigation, edit history tracking, and compact view for managing long conversations.

## Development Commands

### Build & Development
```bash
npm install              # Install dependencies
npm run build            # Build for production (creates dist/content.bundle.js)
npm run watch            # Watch mode for development
npm run dev              # Alias for watch mode
```

### Testing Extension
1. Run `npm run build` or `npm run watch`
2. Open Chrome Extensions at `chrome://extensions`
3. Enable "Developer mode"
4. Click "Load unpacked" and select the extension folder
5. Navigate to https://claude.ai to test changes

## Architecture

### Module-Based System

The extension uses a **modular architecture** where each feature is a self-contained module extending `BaseModule`. All modules are coordinated by the `ClaudeProductivityApp` singleton.

**Key Architecture Principles:**
- **Loose coupling**: Modules communicate via `EventBus` (event-driven)
- **Module lifecycle**: Each module has `init()`, `destroy()`, and `restart()` methods
- **Settings-driven**: All modules respond to settings changes dynamically
- **DOM observation**: Modules watch for DOM changes to handle Claude's dynamic UI

### Core Components

**App.js** - Main application coordinator
- Registers and initializes all modules
- Manages global CSS injection based on theme settings
- Exposes `window.claudeProductivity` for debugging
- Handles application lifecycle (init, restart, destroy)

**BaseModule** (`src/modules/BaseModule.js`)
- Base class all feature modules extend
- Provides common functionality: settings access, event subscriptions, DOM utilities, theme management
- Auto-manages event listener cleanup via `unsubscribers` array
- Modules automatically disabled/enabled when settings change

**EventBus** (`src/utils/EventBus.js`)
- Singleton event system for module communication
- Standard events defined in `Events` constant (MESSAGES_UPDATED, SETTINGS_CHANGED, etc.)
- Pattern: `eventBus.on(event, callback)` returns unsubscribe function

**SettingsManager** (`src/utils/SettingsManager.js`)
- Singleton managing Chrome storage for user preferences
- Uses `chrome.storage.sync` API
- Automatically merges user settings with defaults
- Emits `SETTINGS_CHANGED` event on updates

**DOMUtils** (`src/utils/DOMUtils.js`)
- Helper utilities for DOM manipulation specific to Claude's UI
- Key methods: `findMessages()`, `scrollToElement()`, `observeDOM()`, `flashClass()`
- Handles Claude-specific selectors and DOM structure

### Module Structure

Each feature module follows this pattern:

```
src/modules/
├── NavigationModule.js           # Main module file (extends BaseModule)
├── EditHistoryModule.js          # Main module file
├── CompactViewModule.js          # Main module file
└── EditHistoryModule/            # Sub-components (if complex)
    ├── EditScanner.js
    ├── EditBadge.js
    ├── EditPanel.js
    └── EditModal.js
```

**Current Modules:**

1. **NavigationModule** - Floating navigation buttons for message-to-message navigation
   - Keyboard shortcuts: Alt+↑ (prev), Alt+↓ (next), Alt+Home (top)
   - Finds messages via `[data-is-streaming="false"]` selector
   - Updates button states based on scroll position

2. **EditHistoryModule** - Tracks and displays edited prompts
   - Uses `EditScanner` to detect edit indicators in Claude's UI
   - Shows badges on edited messages, panel with edit list, modal with version history
   - Complex sub-component architecture

3. **CompactViewModule** - Collapse/expand long Claude responses
   - Uses `MessageCollapse` to manage collapse state
   - `ExpandButton` component for UI controls
   - Keyboard shortcuts: Alt+← (collapse all), Alt+→ (expand all)
   - Auto-collapse feature for new messages

### Settings System

Settings are organized by module with a shared `general` section:

```javascript
{
  navigation: { enabled, position, showCounter, smoothScroll, ... },
  editHistory: { enabled, showBadges, highlightEdited },
  compactView: { enabled, minHeight, autoCollapse, autoCollapseEnabled, ... },
  general: { opacity, colorTheme, customColor }  // Shared across modules
}
```

**Important**: Theme settings (`colorTheme`, `customColor`) are in `general`, not per-module.

### Inter-Module Communication

Modules can interact in two ways:

1. **Events** (preferred for loose coupling):
   ```javascript
   this.emit(Events.MESSAGES_UPDATED, data);
   this.subscribe(Events.SETTINGS_CHANGED, callback);
   ```

2. **Direct access** (when necessary):
   ```javascript
   const app = window.claudeProductivity;
   const otherModule = app.getModule('moduleName');
   otherModule.someMethod();
   ```

Example: `EditHistoryModule` calls `CompactViewModule.collapseAllMessages()` for the "Collapse All" button.

### Build System

Uses **Rollup** to bundle ES6 modules into single `dist/content.bundle.js`:
- Input: `src/content.js`
- Output format: IIFE (Immediately Invoked Function Expression)
- `inlineDynamicImports: true` to handle dynamic imports
- Plugin: `@rollup/plugin-node-resolve` for module resolution

The content script is injected at `document_idle` on `https://claude.ai/*` pages only.

### Theming System

Themes are defined in `src/config/themes.js` and managed centrally:
- Built-in themes: `native` (Claude orange), `purple` (default)
- Custom theme: User-defined color with auto-generated gradient
- Theme colors injected as CSS custom properties in `App.js`
- All modules access theme via `this.getTheme()` from BaseModule

### DOM Interaction Patterns

**Finding Messages**: Claude uses `[data-is-streaming="false"]` for completed messages

**User vs Assistant**: User messages have `[data-testid="user-message"]`, assistant messages don't

**Edit Detection**: EditHistoryModule scans for version indicators like "Edited X time(s)" text

**Observation Pattern**: All modules use `DOMUtils.observeDOM()` with MutationObserver and throttling

### CSS Management

- Global styles injected by `App.js` in `<style id="claude-productivity-global-styles">`
- Module-specific inline styles created programmatically
- CSS animations defined globally: `fadeIn`, `fadeOut`, `slideUp`, `claude-highlight-pulse`
- Highlight classes: `.claude-nav-highlight`, `.claude-edit-highlighted`

## Common Patterns

### Adding a New Module

1. Create class extending `BaseModule` in `src/modules/YourModule.js`
2. Implement `async init()` - check `if (!this.enabled) return;` early
3. Override `onSettingsChanged()` if module responds to settings updates
4. Override `destroy()` to clean up (call `super.destroy()`)
5. Register in `App.js` `registerModules()`: `this.registerModule('yourModule', new YourModule())`
6. Add default settings to `SettingsManager.defaults`

### Keyboard Shortcuts

Register in module's `init()`:
```javascript
const handleKeydown = (e) => {
  if (e.altKey && e.key === 'SomeKey') {
    e.preventDefault();
    this.yourAction();
  }
};
document.addEventListener('keydown', handleKeydown);
this.unsubscribers.push(() => document.removeEventListener('keydown', handleKeydown));
```

### Responding to Settings Changes

Modules automatically receive `onSettingsChanged(settings)` callback:
- Check if specific setting changed
- Update UI or behavior accordingly
- Theme changes trigger full UI recreation via `recreateUI()`

## Extension Manifest

- Manifest v3
- Permissions: `storage`, `activeTab`
- Host: `https://claude.ai/*` only
- Popup UI at `popup/popup.html` for settings
- Content script: `dist/content.bundle.js` + `styles.css`

## Debugging

- All modules log via `this.log()`, `this.warn()`, `this.error()` helpers
- Access app in console: `window.claudeProductivity`
- Get debug info: `window.claudeProductivity.getDebugInfo()`
- Check module state: `window.claudeProductivity.getModule('moduleName')`
- Restart app: `window.claudeProductivity.restart()`
