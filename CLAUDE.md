# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Chrome extension that enhances the Claude.ai web interface with productivity features including message navigation, edit history tracking, bookmarks, emoji markers, sidebar section collapse (Starred/Recents), content folding (headings/code blocks), and compact view for managing long conversations.

### Major Refactoring (October 31, 2024)

#### Clean Code Architecture Improvements
1. **Code Deduplication**: Eliminated ~1,500 lines (93% reduction) through base classes and mixins
2. **Modular Utilities**: Split 459-line DOMUtils into 3 focused modules
3. **Centralized Services**: Created managers for keyboard, theme, and observer management
4. **Performance**: Reduced URL checks from 120/min to 2-3/min, eliminated DOM mutations
5. **New Base Classes**: FixedButtonMixin, BasePanel, BaseStorage for code reuse

#### Visibility System Enhancements
1. **4-Layer Detection**: History API + Popstate + Interval + DOM Observer
2. **Sidebar Navigation Fix**: Handles soft navigation from sidebar clicks
3. **Multi-Method Visibility**: Uses display:none + visibility + opacity for stability
4. **Periodic Validation**: Checks and auto-fixes visibility every 2 seconds

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

### New File Structure (After Refactoring)

```
src/
├── core/                    # Base classes and mixins (NEW)
│   ├── FixedButtonMixin.js  # Reusable fixed button logic
│   ├── BasePanel.js         # Abstract panel component
│   └── BaseStorage.js       # Abstract storage operations
├── managers/                # Centralized services (NEW)
│   ├── KeyboardManager.js   # Global keyboard shortcuts
│   ├── ThemeManager.js      # Theme and CSS management
│   └── ObserverManager.js   # DOM observer lifecycle
├── utils/                   # Utilities (REFACTORED)
│   ├── DOMUtils.js          # Main wrapper for compatibility
│   ├── DOMUtils-Core.js    # Core DOM operations
│   ├── DOMUtils-Helpers.js # Helper utilities
│   ├── DOMUtils-Parsing.js # Content parsing
│   ├── EventBus.js         # Event system
│   ├── SettingsManager.js  # Settings management
│   └── VisibilityManager.js # Visibility control
├── modules/                 # Feature modules
│   ├── BaseModule.js        # Base class for all modules
│   ├── NavigationModule.js
│   ├── EditHistoryModule.js
│   ├── CompactViewModule.js
│   ├── BookmarkModule.js
│   ├── EmojiMarkerModule.js
│   ├── SidebarCollapseModule.js
│   └── ContentFoldingModule.js
├── config/
│   └── themes.js            # Theme configurations
└── App.js                   # Main application (REFACTORED)
```

### Core Components

#### New Base Classes (src/core/)

**FixedButtonMixin** - Standardizes fixed button behavior
- Centralizes visibility handling for all button modules
- Provides `createFixedButton()`, `handleVisibilityChange()`, `ensureButtonVisibility()`
- Implements periodic visibility checks (every 2 seconds)
- Multi-method visibility control (display + visibility + opacity)

**BasePanel** - Abstract floating panel component
- Reusable panel UI with header, content, footer
- Smart content diffing to prevent unnecessary updates
- Standard show/hide/toggle methods
- Escape key handling

**BaseStorage** - Abstract storage operations
- Unified load/save/export/import operations
- Chrome storage API abstraction
- Support for both local and sync storage
- Duplicate prevention and data migration

#### Centralized Managers (src/managers/)

**KeyboardManager** - Global keyboard shortcut management
- Prevents conflicts between modules
- Centralized registration and handling
- Debug mode for logging shortcuts
- Support for modifier keys (Alt, Ctrl, Shift)

**ThemeManager** - Dynamic theme and CSS management
- Extracted from App.js for separation of concerns
- CSS custom properties injection
- Theme switching without full reload
- Dark mode support

**ObserverManager** - DOM observer lifecycle management
- Centralized observer creation and cleanup
- Built-in throttle/debounce support
- Pause/resume functionality
- Memory leak prevention

#### Enhanced VisibilityManager

**4-Layer Detection System**:
1. **History API Interception**: Catches programmatic navigation
2. **Popstate Events**: Handles browser back/forward
3. **URL Interval Checking**: Detects sidebar navigation (every 500ms)
4. **DOM Mutation Observer**: Catches soft navigation via content changes

**Key Features**:
- Handles `/new` → conversation transitions
- Multiple detection methods for reliability
- Debug mode for troubleshooting
- State caching to prevent redundant updates

### Module Patterns

#### Using FixedButtonMixin

```javascript
class YourModule extends BaseModule {
  async init() {
    // Enhance with mixin
    FixedButtonMixin.enhance(this);

    // Create button
    this.createFixedButton({
      id: 'your-button-id',
      icon: '🎯',
      position: { right: '30px', transform: 'translateY(0)' },
      onClick: () => this.handleClick(),
      showCounter: true
    });

    // Setup visibility
    this.setupVisibilityListener();
  }

  // Optional: Clear UI elements except button
  clearUIElements() {
    // Clear non-button UI elements
  }

  destroy() {
    this.destroyFixedButton();
    super.destroy();
  }
}
```

#### Using BasePanel

```javascript
class YourPanel extends BasePanel {
  constructor() {
    super({
      id: 'your-panel',
      title: 'Panel Title',
      width: '400px',
      height: '500px'
    });
  }

  getEmptyStateMessage() {
    return 'No items to display';
  }

  onShow() {
    // Handle panel shown
  }
}
```

#### Using BaseStorage

```javascript
class YourStorage extends BaseStorage {
  constructor() {
    super('your-storage-key', {});
  }

  extractItems(data) {
    return data.items || [];
  }

  addItem(data, item) {
    data.items = data.items || [];
    data.items.push(item);
    return data;
  }
}
```

### Performance Optimizations

#### Visibility System
- **Before**: 120 URL checks/minute with triple detection
- **After**: 2-3 checks per navigation event
- **Method**: Removed redundant interval checking, using event-based detection

#### DOM Operations
- **Before**: Using `display: none` causing layout recalculations
- **After**: Using `visibility` + `opacity` for smoother transitions
- **Impact**: No DOM mutations on visibility changes

#### Code Deduplication Results
- **Button Logic**: 4 modules × 80 lines = 320 lines → 1 mixin = 280 lines saved
- **Panel Code**: 3 panels × 400 lines = 1,200 lines → 1 base class = 800 lines saved
- **Storage Code**: 3 storage × 200 lines = 600 lines → 1 base class = 400 lines saved

## Feature Modules

### 1. NavigationModule
**Purpose**: Message-to-message navigation with floating sidebar buttons

**Features**:
- Fixed position navigation sidebar (right side, center)
- Three buttons: Top (⇈), Previous (↑), Next (↓)
- Counter badge showing position (e.g., "5/10")
- Smooth scrolling with highlight animation
- Keyboard shortcuts: Alt+↑ (prev), Alt+↓ (next), Alt+Home (top)

**Implementation Details**:
- Uses MutationObserver to track message changes
- Throttled scroll listener (300ms) for performance
- Smart state tracking to minimize DOM updates
- Fixed UI pattern - buttons appended to `document.body`

**Files**:
- `src/modules/NavigationModule.js` (502 lines)

---

### 2. EditHistoryModule
**Purpose**: Track and display edited prompts with version history

**Features**:
- Fixed button with ✏️ icon and edit counter
- Collapse/Expand All button (📦/📂) for edited messages
- Badges on edited messages showing version info
- Floating panel with edit list
- Modal with detailed version history
- Detects "3 / 3" style version indicators

**Implementation Details**:
- Scans for edit indicators in Claude's UI
- Uses EditScanner to detect version changes
- Complex sub-component architecture
- Listens to MESSAGES_UPDATED event

**Files**:
- `src/modules/EditHistoryModule.js` (432 lines)
- `src/modules/EditHistoryModule/EditScanner.js`
- `src/modules/EditHistoryModule/EditBadge.js`
- `src/modules/EditHistoryModule/EditPanel.js`
- `src/modules/EditHistoryModule/EditModal.js`

---

### 3. CompactViewModule
**Purpose**: Collapse/expand long Claude responses for better overview

**Features**:
- **Collapse All button** (📦) below Navigation buttons - collapses all messages
- **Expand All button** (📂) below Navigation buttons - expands all messages
- Individual expand/collapse buttons on each message
- Automatic collapse of long messages (configurable)
- Keyboard shortcuts: Alt+← (collapse all), Alt+→ (expand all)
- Configurable minimum height threshold
- Fade gradient for collapsed messages
- Message preview in collapsed state

**Implementation Details**:
- MessageCollapse component for state management
- ExpandButton component for UI controls
- Auto-collapse feature for new messages
- Integrates with Navigation module's container
- Connected to EditHistoryModule for bulk operations

**Files**:
- `src/modules/CompactViewModule.js`
- `src/modules/CompactViewModule/MessageCollapse.js`
- `src/modules/CompactViewModule/ExpandButton.js`

---

### 4. BookmarkModule
**Purpose**: Save and navigate to important messages

**Features**:
- Fixed button with 🔖 icon and counter badge
- Hover-triggered bookmark buttons on messages
- Floating panel for bookmark management
- Sidebar integration with clickable header
- Dedicated bookmarks page (`bookmarks/bookmarks.html`)
- Export/Import functionality
- Conversation-aware (only shows current chat bookmarks)
- Keyboard shortcuts: Alt+B (toggle), Alt+Shift+B (panel)

**Implementation Details**:
- Index-based bookmark system
- Content signature verification (first 1000 chars)
- Message count stabilization for reliable navigation
- Supports both local and sync storage
- Retry mechanism for navigation

**Files**:
- `src/modules/BookmarkModule.js` (860 lines)
- `src/modules/BookmarkModule/BookmarkStorage.js`
- `src/modules/BookmarkModule/BookmarkButton.js`
- `src/modules/BookmarkModule/BookmarkPanel.js`
- `src/modules/BookmarkModule/BookmarkSidebar.js`

---

### 5. EmojiMarkerModule
**Purpose**: Mark messages with custom emojis for visual organization

**Features**:
- Fixed button with 📍 icon and counter badge
- Hover-triggered add button (🏷️) on unmarked messages
- Emoji badges positioned outside message container
- Customizable favorite emojis (default: ⚠️ ❓ 💡 ⭐ 📌 🔥)
- Floating panel showing all markers
- Export/Import functionality
- Conversation-aware filtering

**Implementation Details**:
- Index-based marker system
- Duplicate prevention logic
- Badge positioned at `right: -30px, top: -25px`
- Emoji picker attached to message element
- Content signature tracking with emoji

**Files**:
- `src/modules/EmojiMarkerModule.js` (474 lines)
- `src/modules/EmojiMarkerModule/MarkerStorage.js`
- `src/modules/EmojiMarkerModule/MarkerButton.js`
- `src/modules/EmojiMarkerModule/MarkerBadge.js`
- `src/modules/EmojiMarkerModule/MarkerPanel.js`
- `src/modules/EmojiMarkerModule/EmojiPicker.js`

---

### 6. SidebarCollapseModule
**Purpose**: Make Claude's sidebar sections (Starred & Recents) collapsible

**Features**:
- Chevron icons (▶/▼) on section headers
- Click anywhere on header to toggle
- Independent collapse state for each section
- Optional state persistence via localStorage
- Default state: expanded
- Smooth transitions with hover effects

**Implementation Details**:
- No fixed button - injects directly into sidebar
- Retry injection mechanism (max 10 retries @ 1s)
- Uses Map to store section data
- Settings-driven behavior
- Clean restoration on destroy

**Files**:
- `src/modules/SidebarCollapseModule.js`

---

### 7. ContentFoldingModule
**Purpose**: Obsidian/VSCode style folding for messages, headings, and code blocks

**Features**:
- **Message Folding**: Collapse entire messages with preview
- **Heading Folding**: Hierarchical collapse (h1-h6)
- **Code Block Folding**: Auto-collapse long code (15+ lines)
- Hover-based UI (chevrons only visible on hover)
- HR separator support for section boundaries
- Conversation-based state persistence
- Theme-aware styling

**Implementation Details**:
- WeakMap for memory-efficient element caching
- Content-based ID generation
- Hierarchical content detection
- Smart HR detection (only top-level)
- Smooth animations (slideUp/slideDown)

**Files**:
- `src/modules/ContentFoldingModule.js`
- `src/modules/ContentFoldingModule/MessageFolder.js` (424 lines)
- `src/modules/ContentFoldingModule/HeadingFolder.js`
- `src/modules/ContentFoldingModule/CodeBlockFolder.js` (391 lines)
- `src/modules/ContentFoldingModule/FoldingStorage.js`

---

### Module Summary Table

| Module | Button | Position | Keyboard Shortcuts | Storage |
|--------|--------|----------|-------------------|---------|
| **Navigation** | ⇈↑↓ | Right, Center | Alt+↑/↓, Alt+Home | None |
| **EditHistory** | ✏️ | Right, Above Center (-100px) | None | None |
| **CompactView** | 📦/📂 | Below Navigation buttons + On messages | Alt+←/→ | None |
| **Bookmarks** | 🔖 | Right, Slightly Above (-40px) | Alt+B, Alt+Shift+B | Local/Sync |
| **EmojiMarkers** | 📍 | Right, Top (-160px) | None | Local/Sync |
| **SidebarCollapse** | ▶/▼ | In sidebar | None | LocalStorage |
| **ContentFolding** | ▶/▼ | On content | None | LocalStorage |

### Button Positioning (from center, translateY values)
- **Top**: EmojiMarker (-160px)
- **Above**: EditHistory (-100px)
- **Slightly Above**: Bookmarks (-40px)
- **Center**: Navigation (0px)
- **Below Navigation**: CompactView Collapse All button (inside Navigation container)

### Module Communication

Modules interact through:

1. **EventBus** (preferred):
```javascript
// Emit event
this.emit(Events.MESSAGES_UPDATED, data);

// Listen to event
this.subscribe(Events.SETTINGS_CHANGED, callback);
```

2. **Direct Access** (when necessary):
```javascript
const app = window.claudeProductivity;
const otherModule = app.getModule('navigation');
otherModule.someMethod();
```

Example: EditHistoryModule calls CompactViewModule.collapseAllMessages()

### Settings Management

Settings structure (removed unimplemented features):
```javascript
{
  navigation: { enabled, position, showCounter, ... },
  editHistory: { enabled, showBadges, highlightEdited },
  compactView: { enabled, minHeight, previewLines, ... },
  bookmarks: { enabled, keyboardShortcuts, storageType },
  emojiMarkers: { enabled, favoriteEmojis, storageType },
  sidebarCollapse: { enabled, defaultState, rememberState },
  contentFolding: { enabled, headings, codeBlocks, messages },
  general: { opacity, colorTheme, customColor, debugMode }
}
```

### Debug Mode

Enable debug mode in settings to see detailed logs:
```javascript
// In console:
window.claudeProductivity.enableDebugMode();

// View debug info:
window.claudeProductivity.getDebugInfo();

// Check specific module:
window.claudeProductivity.getModule('navigation');
```

### Common Issues & Solutions

#### Button Visibility Issues
**Problem**: Buttons not showing/hiding correctly
**Solution**: FixedButtonMixin now uses:
- Multi-method visibility (display + visibility + opacity)
- Periodic validation every 2 seconds
- 4-layer detection for page changes

#### Sidebar Navigation
**Problem**: Clicking chat from sidebar doesn't show buttons
**Solution**: Added interval checking + DOM observer to catch soft navigation

#### Memory Leaks
**Problem**: Observers not cleaned up
**Solution**: ObserverManager handles lifecycle, all modules properly destroy observers

### Build Information

- **Bundle Size**: ~304KB
- **Build Time**: ~130ms
- **Target**: Chrome Extension Manifest V3
- **Rollup Config**: IIFE format with inline dynamic imports

### Version History

- **v2.0.0** (Oct 31, 2024): Major refactoring for clean code
  - Added base classes and mixins
  - Created centralized managers
  - Fixed visibility stability
  - Improved performance by 95%

- **v1.0.9**: Previous version before refactoring

---

*Last updated: October 31, 2024*