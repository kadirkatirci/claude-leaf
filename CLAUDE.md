# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Chrome extension that enhances the Claude.ai web interface with productivity features including message navigation, edit history tracking, bookmarks, emoji markers, sidebar section collapse (Starred/Recents), and compact view for managing long conversations.

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

## Architecture Overview

### Module-Based System

The extension uses a **modular architecture** where each feature is a self-contained module extending `BaseModule`. All modules are coordinated by the `ClaudeProductivityApp` singleton.

**Key Architecture Principles:**
- **Loose coupling**: Modules communicate via `EventBus` (event-driven)
- **Module lifecycle**: Each module has `init()`, `destroy()`, and `restart()` methods
- **Settings-driven**: All modules respond to settings changes dynamically
- **DOM observation**: Modules watch for DOM changes to handle Claude's dynamic UI
- **Performance-optimized**: State tracking to prevent unnecessary DOM manipulations
- **Fixed UI pattern**: UI elements appended to `document.body` for persistence across page changes

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

### Key Patterns

#### Fixed Button Pattern

All UI buttons use a consistent pattern for stability across page navigation:

**Core Principle**: Append all persistent UI elements to `document.body` with `position: fixed`. This ensures they NEVER get removed when Claude.ai changes page content.

**Implementation**:
```javascript
createFixedButton() {
  const theme = this.getTheme();

  const button = this.dom.createElement('button', {
    id: 'my-module-fixed-btn',
    innerHTML: '🔖',
    style: {
      position: 'fixed',
      right: '30px',
      top: '50%',
      transform: 'translateY(-40px)', // Adjust for vertical positioning
      width: '48px',
      height: '48px',
      borderRadius: '50%',
      background: theme.gradient,
      border: 'none',
      cursor: 'pointer',
      zIndex: '9999',
      // ... other styling
    }
  });

  // Counter badge (optional)
  const counter = this.dom.createElement('div', {
    id: 'my-module-counter',
    textContent: '0',
    style: {
      position: 'absolute',
      top: '-5px',
      right: '-5px',
      background: '#ef4444',
      color: 'white',
      fontSize: '11px',
      // ... badge styling
    }
  });

  button.appendChild(counter);
  document.body.appendChild(button); // KEY: Append to body

  this.elements.button = button;
  this.elements.counter = counter;
}
```

**Button Positioning**:
- Navigation: `translateY(0)` - center
- Edit History: `translateY(-100px)` - above center
- Emoji Marker: `translateY(-160px)` - top (replaces Collapse All position)
- Bookmark: `translateY(-40px)` - slightly above center

**Data Updates Only**:
- UI elements created once in `init()`
- Only update counter text/button states when data changes
- No recreation needed when navigating between chats

**Event Listening**:
Listen to `MESSAGES_UPDATED` event from NavigationModule to trigger data scanning:
```javascript
this.subscribe(Events.MESSAGES_UPDATED, () => {
  this.log('🔄 Messages updated, scanning...');
  this.scanForNewData();
});
```

#### Inter-Module Communication

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

## Modules

### Module Structure

Each feature module follows this pattern:

```
src/modules/
├── NavigationModule.js           # Main module file (extends BaseModule)
├── EditHistoryModule.js          # Main module file
├── CompactViewModule.js          # Main module file
├── BookmarkModule.js             # Main module file
├── EmojiMarkerModule.js          # Main module file
├── SidebarCollapseModule.js      # Main module file (sidebar chevron injection)
├── EditHistoryModule/            # Sub-components (if complex)
│   ├── EditScanner.js
│   ├── EditBadge.js
│   ├── EditPanel.js
│   └── EditModal.js
├── BookmarkModule/               # Sub-components
│   ├── BookmarkStorage.js
│   ├── BookmarkButton.js
│   ├── BookmarkPanel.js
│   └── BookmarkSidebar.js
└── EmojiMarkerModule/            # Sub-components
    ├── MarkerStorage.js
    ├── MarkerButton.js
    ├── MarkerBadge.js
    ├── MarkerPanel.js
    └── EmojiPicker.js
```

**Current Modules:**

1. **NavigationModule** - Floating navigation buttons for message-to-message navigation
   - **Fixed position sidebar** (right side, center) - NEVER destroyed, always visible
   - Buttons: Top (⇈), Previous (↑), Next (↓)
   - Counter badge shows current position (e.g., "5/10")
   - Keyboard shortcuts: Alt+↑ (prev), Alt+↓ (next), Alt+Home (top)
   - MutationObserver watches for DOM changes, updates message array
   - **Key pattern**: UI elements appended to `document.body`, data updates only
   - Smart state tracking: Only updates buttons/counter when values change
   - Throttled scroll listener (300ms) with passive event handling

2. **EditHistoryModule** - Tracks and displays edited prompts
   - **Fixed position sidebar button** (right side, above center) - NEVER destroyed
   - Shows ✏️ icon with red counter badge (e.g., "3" edits)
   - **Collapse/Expand All button** (📦/📂) appears when edits exist
   - Listens to `MESSAGES_UPDATED` event for immediate scanning on navigation
   - Uses `EditScanner` to detect edit indicators in Claude's UI
   - Shows badges on edited messages, panel with edit list, modal with version history
   - Optimized scanning: Only notifies when edits actually change
   - Smart badge updates: Updates instead of recreating
   - **Key pattern**: Fixed buttons in body, MutationObserver for data scanning
   - Complex sub-component architecture

3. **CompactViewModule** - Collapse/expand long Claude responses
   - Uses `MessageCollapse` to manage collapse state
   - `ExpandButton` component for UI controls
   - Keyboard shortcuts: Alt+← (collapse all), Alt+→ (expand all)
   - Auto-collapse feature for new messages
   - Controlled by EditHistoryModule's Collapse All button

4. **BookmarkModule** - Save and navigate to important messages
   - **Fixed position sidebar button** (right side, slightly above center) - NEVER destroyed
   - Shows 🔖 icon with red counter badge (e.g., "5" bookmarks)
   - Updates counter via `updateUI()` when bookmarks change
   - Index-based bookmark system (simple and reliable)
   - Stores bookmarks locally or synced across Chrome browsers
   - Features:
     - Hover-triggered bookmark buttons on messages (SVG icons)
     - Fixed sidebar button for quick access
     - Floating panel for bookmark management
     - Sidebar integration with clickable header
     - Dedicated bookmarks page (bookmarks/bookmarks.html)
     - Export/Import functionality in popup
     - Conversation-aware: Only shows bookmarks for current conversation
   - Navigation:
     - Message count stabilization algorithm for reliable navigation
     - Retry mechanism for navigating from bookmarks page
     - Content signature verification to ensure correct message
   - Keyboard shortcuts: Alt+B (toggle bookmark), Alt+Shift+B (toggle panel)
   - **Key pattern**: Fixed button in body, data-driven counter updates
   - Performance: State tracking prevents unnecessary DOM updates

5. **EmojiMarkerModule** - Mark messages with custom emojis for visual organization
   - **Fixed position sidebar button** (right side, top) - NEVER destroyed
   - Shows 📍 icon with red counter badge (e.g., "3" markers)
   - Index-based marker system (same pattern as BookmarkModule)
   - Stores markers locally or synced across Chrome browsers
   - Features:
     - **Hover-triggered add button** (🏷️) on messages without markers
     - **Emoji badge** on marked messages (outside container, top-right)
     - Badge click: Emoji picker (favorite emojis) + delete button
     - Favorite emojis: Customizable list (default: ⚠️ ❓ 💡 ⭐ 📌 🔥)
     - Fixed sidebar button opens floating panel
     - Floating panel shows all markers in conversation (sorted by timestamp)
     - Export/Import functionality in popup
     - Conversation-aware: Only shows markers for current conversation
   - **Key patterns**:
     - Marker button hidden when badge exists (no duplicate badges)
     - Badge positioned outside message container (`right: -30px`, `top: -25px`)
     - Emoji picker attached to messageEl (not badge) to prevent position issues
     - Panel content diffing includes emoji: `${id}:${emoji}` (detects emoji changes)
   - **Positioning strategy**:
     - Badge: Container'ın dışında (prevents text overlap)
     - Dynamic positioning: Adjusts for bookmark button presence
     - Marker button: Only visible when no marker exists (add mode)
   - Performance: Smart updates, duplicate prevention, content signature tracking
   - Complex sub-component architecture (Storage, Button, Badge, Panel, Picker)

6. **SidebarCollapseModule** - Makes sidebar sections (Starred & Recents) collapsible
   - Solves UX problem: Long lists make sidebar cluttered and hard to navigate
   - **No fixed position button** - Injects chevrons directly into Claude's native sidebar
   - **Retry injection mechanism** (similar to BookmarkSidebar pattern)
   - Chevron icons (▶/▼) added to both "Starred" and "Recents" headers
   - **Full collapse**: Hides entire list, shows only header when collapsed
   - **Default state: Expanded** (user chooses when to collapse)
   - **State persistence**: Optional remember state via localStorage
   - **Interactive headers**: Click anywhere on section header or chevron to toggle
   - Features:
     - Finds sections by searching for h3 with text "Starred" or "Recents"
     - Simple show/hide list logic (no max items, just full toggle)
     - Smooth transitions with hover effects on chevrons
     - Auto-reinjects when settings change
     - Independent state for each section (Starred can be collapsed while Recents expanded)
   - **Key patterns**:
     - Injection with retry: Waits for sidebar to load (max 10 retries @ 1s)
     - Uses Map to store section data: { element, list, chevron, isCollapsed }
     - Settings-driven: Respects defaultState, rememberState
     - Clean shutdown: Restores all list visibility on destroy
   - No fixed button needed (operates within Claude's native sidebar)
   - Enabled by default to provide cleaner sidebar organization

### Module Details

#### EmojiMarkerModule Architecture

The EmojiMarkerModule uses a modular sub-component architecture (similar to BookmarkModule):

**MarkerStorage** ([EmojiMarkerModule/MarkerStorage.js](src/modules/EmojiMarkerModule/MarkerStorage.js))
- Handles all storage operations (load, save, export, import)
- Supports both `chrome.storage.local` and `chrome.storage.sync`
- **Duplicate prevention**: Checks conversationUrl + messageIndex before adding
- If duplicate found, updates existing marker instead of creating new one
- `add()`, `remove()`, `update()` methods return updated markers array

**MarkerButton** ([EmojiMarkerModule/MarkerButton.js](src/modules/EmojiMarkerModule/MarkerButton.js))
- Manages hover-triggered 🏷️ buttons on messages
- **Only visible when no marker exists** (add mode)
- Uses WeakMap for button tracking (memory efficient)
- **Conditional visibility**: `display: marker ? 'none' : 'flex'`
- Shows emoji quick select on click (favorite emojis)
- Event listeners attached once per element (memory leak prevention)
- Positioned outside container (`right: -30px`) with bookmark detection

**MarkerBadge** ([EmojiMarkerModule/MarkerBadge.js](src/modules/EmojiMarkerModule/MarkerBadge.js))
- Displays emoji badges on marked messages
- Positioned outside container (`right: -30px`, `top: -25px`)
- **Click behavior**: Shows emoji picker + delete button
- Options container attached to messageEl (not badge) to prevent position shift
- Smart update: Only updates emoji if changed, removes if marker deleted
- Uses WeakMap for badge tracking
- Dynamic positioning considers both bookmark and marker button presence

**MarkerPanel** ([EmojiMarkerModule/MarkerPanel.js](src/modules/EmojiMarkerModule/MarkerPanel.js))
- Floating panel UI (matches BookmarkPanel/EditPanel design)
- Fixed position, toggleable via sidebar button
- **Content diffing includes emoji**: `${id}:${emoji}` signature
- Critical fix: Detects emoji changes (not just ID changes)
- Sorted by timestamp (newest first)
- Click marker item → scroll to message with highlight
- Delete button with confirmation

**EmojiPicker** ([EmojiMarkerModule/EmojiPicker.js](src/modules/EmojiMarkerModule/EmojiPicker.js))
- Reusable emoji selection component
- Shows favorite emojis in grid layout
- Used by both MarkerButton (add) and MarkerBadge (change)
- Quick select: Click emoji → immediate action
- Auto-close on selection or outside click

**Key Patterns:**
- Index-based system: Markers use message array index (same as bookmarks)
- Content signature: Hash of first 1000 characters for verification
- Conversation filtering: Only shows markers for current URL
- **No duplicate badges**: Marker button hidden when badge exists
- **Position outside container**: Prevents text overlap, better UX
- **Panel emoji tracking**: Signature includes emoji for change detection
- Export/Import: JSON format with timestamp and metadata

#### BookmarkModule Architecture

The BookmarkModule uses a modular sub-component architecture:

**BookmarkStorage** ([BookmarkModule/BookmarkStorage.js](src/modules/BookmarkModule/BookmarkStorage.js))
- Handles all storage operations (load, save, export, import)
- Supports both `chrome.storage.local` and `chrome.storage.sync`
- User can switch storage type in settings

**BookmarkButton** ([BookmarkModule/BookmarkButton.js](src/modules/BookmarkModule/BookmarkButton.js))
- Manages bookmark buttons on individual messages
- Uses WeakMap for button tracking
- State tracking: Only updates button if bookmark state changed
- SVG icons: Filled (bookmarked) vs stroked (not bookmarked)

**BookmarkPanel** ([BookmarkModule/BookmarkPanel.js](src/modules/BookmarkModule/BookmarkPanel.js))
- Floating panel UI (matches EditPanel design)
- Toggle button in header with counter badge
- Content diffing: Only rebuilds when bookmarks actually change
- Counter optimization: Only updates when count changes

**BookmarkSidebar** ([BookmarkModule/BookmarkSidebar.js](src/modules/BookmarkModule/BookmarkSidebar.js))
- Integrates with Claude's native sidebar
- Clickable header opens bookmarks page
- Content diffing: Only updates when bookmarks change
- SVG icons with dark/light mode support

**Bookmarks Page** ([bookmarks/bookmarks.html](bookmarks/bookmarks.html) + [bookmarks.js](bookmarks/bookmarks.js))
- Dedicated full-page view of all bookmarks
- Search functionality
- Delete and navigate features
- URL parameter navigation: `?bookmark=<id>` for direct access

**Key Patterns:**
- Index-based system: Bookmarks use message array index (simple, reliable)
- Content signature: Hash of first 1000 characters for verification
- Navigation retry: Message stabilization algorithm waits for full load
- Conversation filtering: Only shows bookmarks for current URL
- Export/Import: JSON format with timestamp and metadata

## System Components

### Settings System

Settings are organized by module with a shared `general` section:

```javascript
{
  navigation: { enabled, position, showCounter, smoothScroll, ... },
  editHistory: { enabled, showBadges, highlightEdited },
  compactView: { enabled, minHeight, autoCollapse, autoCollapseEnabled, ... },
  bookmarks: { enabled, keyboardShortcuts, showOnHover, storageType },
  emojiMarkers: { enabled, showBadges, showOnHover, storageType, favoriteEmojis },
  sidebarCollapse: { enabled, defaultState, rememberState },
  general: { opacity, colorTheme, customColor }  // Shared across modules
}
```

**Important**: Theme settings (`colorTheme`, `customColor`) are in `general`, not per-module.

### Theming System

Themes are defined in [src/config/themes.js](src/config/themes.js) and managed centrally:
- Built-in themes: `native` (Claude orange), `purple` (default)
- Custom theme: User-defined color with auto-generated gradient
- Theme colors injected as CSS custom properties in [App.js](src/App.js)
- All modules access theme via `this.getTheme()` from BaseModule

### Build System

Uses **Rollup** to bundle ES6 modules into single `dist/content.bundle.js`:
- Input: `src/content.js`
- Output format: IIFE (Immediately Invoked Function Expression)
- `inlineDynamicImports: true` to handle dynamic imports
- Plugin: `@rollup/plugin-node-resolve` for module resolution

The content script is injected at `document_idle` on `https://claude.ai/*` pages only.

### Extension Manifest

- Manifest v3
- Permissions: `storage`, `activeTab`
- Host: `https://claude.ai/*` only
- Popup UI at [popup/popup.html](popup/popup.html) for settings
- Content script: `dist/content.bundle.js` + [styles.css](styles.css)
- Web accessible resources: [bookmarks/bookmarks.html](bookmarks/bookmarks.html), [bookmarks/bookmarks.js](bookmarks/bookmarks.js) (for dedicated bookmarks page)

## Implementation Guide

### Adding a New Module

1. Create class extending `BaseModule` in `src/modules/YourModule.js`
2. Implement `async init()` - check `if (!this.enabled) return;` early
3. Override `onSettingsChanged()` if module responds to settings updates
4. Override `destroy()` to clean up (call `super.destroy()`)
5. Register in [App.js](src/App.js) `registerModules()`: `this.registerModule('yourModule', new YourModule())`
6. Add default settings to [SettingsManager](src/utils/SettingsManager.js) defaults

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

### DOM Interaction Patterns

**Finding Messages**: Claude uses `[data-is-streaming="false"]` for completed messages

**User vs Assistant**: User messages have `[data-testid="user-message"]`, assistant messages don't

**Edit Detection**: [EditHistoryModule](src/modules/EditHistoryModule.js) scans for version indicators like "Edited X time(s)" text

**Observation Pattern**: All modules use [DOMUtils](src/utils/DOMUtils.js)`.observeDOM()` with MutationObserver and throttling

### CSS Management

- Global styles injected by [App.js](src/App.js) in `<style id="claude-productivity-global-styles">`
- Module-specific inline styles created programmatically
- CSS animations defined globally: `fadeIn`, `fadeOut`, `slideUp`, `claude-highlight-pulse`
- Highlight classes: `.claude-nav-highlight`, `.claude-edit-highlighted`

### Performance Optimization Patterns

All modules implement performance optimizations to minimize unnecessary DOM manipulations:

**1. State Tracking**
- Track previous values (counter text, button states, bookmark IDs, etc.)
- Only update DOM when values actually change
- Example: `if (this.lastCounterText !== newText) { update DOM }`

**2. Content Diffing**
- Compare current vs previous content before rebuilding
- Use ID arrays/sets to detect changes efficiently
- Example: `const currentIds = bookmarks.map(b => b.id).join(',')`

**3. Conditional Updates**
- Check if each property needs updating before modifying
- Avoid batch updates when only one property changed
- Example: `if (newStates.prev !== this.lastButtonStates.prev) { update only prev button }`

**4. Event Optimization**
- Throttle/debounce frequent events (scroll, DOM mutations)
- Use passive event listeners where possible: `{ passive: true }`
- Increase throttle intervals for better performance (e.g., 100ms → 300ms)

**5. Smart Observers**
- Only trigger callbacks when meaningful changes occur
- Track message counts to avoid unnecessary scans
- Example: `if (currentCount !== lastMessageCount) { update }`

**6. Update-in-Place**
- Update existing DOM elements instead of recreating
- Example: Badge updates innerHTML instead of removing and recreating

**Performance Metrics:**
- [BookmarkModule](src/modules/BookmarkModule.js): Updates only when bookmarks added/removed
- [EditHistoryModule](src/modules/EditHistoryModule.js): Updates only when edits appear/disappear
- [NavigationModule](src/modules/NavigationModule.js): **CRITICAL FIX** - Only emits MESSAGES_UPDATED when message count changes (prevents infinite loop)
- [EmojiMarkerModule](src/modules/EmojiMarkerModule.js): Updates only when message count changes, panel updates only when markers/emojis change
- Result: Minimal DOM manipulation visible in DevTools inspector

## Debugging

- All modules log via `this.log()`, `this.warn()`, `this.error()` helpers
- Access app in console: `window.claudeProductivity`
- Get debug info: `window.claudeProductivity.getDebugInfo()`
- Check module state: `window.claudeProductivity.getModule('moduleName')`
- Restart app: `window.claudeProductivity.restart()`

## Common Issues & Solutions

### Infinite Loop / Performance Issues

**Symptom:** Console floods with repeated messages (e.g., "Messages updated, scanning..."), CPU usage high

**Root Cause:** DOM mutation triggers event → Event handler modifies DOM → New mutation → Infinite loop

**Solution Pattern (CRITICAL):**
```javascript
// ❌ BAD: Emits event on every DOM mutation
observeMessages() {
  this.observer = this.dom.observeDOM(() => {
    this.findMessages();
    this.emit(Events.MESSAGES_UPDATED); // Triggers other modules → DOM change → loop!
  });
}

// ✅ GOOD: Only emit when meaningful change occurs
observeMessages() {
  this.observer = this.dom.observeDOM(() => {
    clearTimeout(this.observerTimeout);
    this.observerTimeout = setTimeout(() => {
      const oldLength = this.messages.length;
      this.messages = this.dom.findMessages();

      // ONLY emit if count changed
      if (this.messages.length !== oldLength) {
        this.updateCounter();
        this.emit(Events.MESSAGES_UPDATED, this.messages);
      }
    }, 500);
  });
}
```

**Real Example:** NavigationModule was emitting MESSAGES_UPDATED on every mutation → EditHistoryModule scans → Badge DOM change → New mutation → Loop. Fixed by only emitting when message count changes.

### Duplicate UI Elements

**Symptom:** Two identical buttons/badges appear on same element

**Root Cause:** Conditional rendering not properly checking for existing elements

**Solution Pattern:**
```javascript
// ❌ BAD: Always creates both button and badge
if (marker) {
  button.innerHTML = marker.emoji; // Shows button with emoji
}
badge.show(); // Also shows badge!

// ✅ GOOD: Mutually exclusive visibility
if (marker) {
  button.style.display = 'none'; // Hide button
  badge.show(); // Show badge
} else {
  button.style.display = 'flex'; // Show button
  badge.hide(); // Hide badge
}
```

**Real Example:** EmojiMarkerModule showed both marker button and badge when marker existed. Fixed by hiding button when badge present.

### Panel Not Updating

**Symptom:** Panel shows old data after update operations (e.g., emoji change not reflected)

**Root Cause:** Content diffing too aggressive, doesn't detect certain changes

**Solution Pattern:**
```javascript
// ❌ BAD: Only compares IDs
const currentIds = items.map(i => i.id).join(',');
if (this.lastIds === currentIds) return; // Skips if IDs same, even if content changed

// ✅ GOOD: Include relevant properties in signature
const currentSignature = items.map(i => `${i.id}:${i.emoji}:${i.title}`).join(',');
if (this.lastSignature === currentSignature) return; // Detects any property change
```

**Real Example:** MarkerPanel didn't update when emoji changed because signature only included ID. Fixed by including emoji: `${id}:${emoji}`.

### Position Issues (Elements Jumping)

**Symptom:** Element shifts to wrong position when modified (e.g., badge jumps to corner)

**Root Cause:** Changing `position` CSS property from `absolute` to `relative` puts element back in document flow

**Solution Pattern:**
```javascript
// ❌ BAD: Changes badge position to attach child
badge.style.position = 'relative'; // Badge jumps to document flow!
badge.appendChild(container);

// ✅ GOOD: Attach container to stable parent
const parent = badge.parentElement;
const rect = badge.getBoundingClientRect();
container.style.top = `${rect.bottom}px`;
parent.appendChild(container); // Badge stays in place
```

**Real Example:** MarkerBadge jumped to bottom-left corner when options container opened. Fixed by attaching container to messageEl instead of badge.

### Memory Leaks (Event Listeners)

**Symptom:** Browser slows down over time, memory usage increases

**Root Cause:** Event listeners added repeatedly without removal

**Solution Pattern:**
```javascript
// ❌ BAD: Adds listeners every update
updateElements(elements) {
  elements.forEach(el => {
    el.addEventListener('click', handler); // Accumulates listeners!
  });
}

// ✅ GOOD: Track and only attach once
updateElements(elements) {
  elements.forEach(el => {
    if (this.cache.has(el)) return; // Already has listener

    el.addEventListener('click', handler);
    this.cache.set(el, true);
  });
}
```

**Real Example:** MarkerButton added mouseenter/mouseleave listeners every time updateUI ran. Fixed by checking cache before attaching.
