# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Chrome extension (Manifest V3) that enhances the Claude.ai web interface with productivity features: message navigation, edit history tracking, bookmarks, emoji markers, sidebar section collapse, content folding, and compact view for managing long conversations.

## Development Commands

```bash
npm install       # Install dependencies
npm run build     # Build for production (creates dist/content.bundle.js)
npm run watch     # Watch mode for development
npm run dev       # Alias for watch mode
```

### Testing the Extension
1. Run `npm run build` or `npm run watch`
2. Open `chrome://extensions` with Developer mode enabled
3. Click "Load unpacked" and select this folder
4. Navigate to https://claude.ai to test

## Architecture Overview

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

### Module Pattern

All feature modules extend **[BaseModule](src/modules/BaseModule.js)** which provides:
- Settings access via `settingsStore`
- Event subscription lifecycle management
- Theme access (`getTheme()`)
- URL change handling for SPA navigation

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

## Debug Commands

In browser console:
```javascript
window.claudeProductivity.verifyArchitecture()  // System health check
window.claudeProductivity.healthCheck()         // Initialization status
window.__navigationInterceptor.getState()       // Current page state
window.__visibilityManager.getStatus()          // Visibility state
```

## Build Info

- **Bundler**: Rollup with `@rollup/plugin-node-resolve`
- **Output**: `dist/content.bundle.js` (IIFE format, ~300KB)
- **Styles**: `styles.css` loaded via manifest
