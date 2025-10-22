# 📊 Tümünü Daralt - Visual Diyagramlar

## 1️⃣ UI Layout

```
┌─────────────────────────────────────────────────────────────┐
│                    Claude.ai Chat Header                     │
│ ┌───────────────────────────────────────────────────────────┤
│ │ 🔙 Chat Title                 ✏️ 3 Edits │ 📦 Daralt  │
│ └───────────────────────────────────────────────────────────┤
└─────────────────────────────────────────────────────────────┘

Button Details:
┌──────────────────────────────────────────┐
│ 📦 Tümünü Daralt                         │
│ ─────────────────────────────────────────│
│ • ID: claude-collapse-all-btn            │
│ • Position: inline-flex                  │
│ • Margin: 8px left of edit button        │
│ • Padding: 4px 12px                      │
│ • Border Radius: 8px                     │
│ • Background: Gradient (theme color)     │
│ • Font Size: 12px, Bold                  │
│ • Cursor: pointer                        │
│ • Shadow: 0 2px 8px rgba(0,0,0,0.15)   │
│ • Hover: scale(1.05) + shadow increase   │
│ • Active: scale(0.95)                    │
└──────────────────────────────────────────┘
```

---

## 2️⃣ State Diagram

```
                    Button States
                         │
         ┌───────────────┴───────────────┐
         ▼                               ▼
    🟢 EXPANDED                      🔴 COLLAPSED
 "📦 Tümünü Daralt"           "📦 Tümünü Genişlet"
         │                               │
         │ click                         │ click
         └───────────────┬───────────────┘
                         ▼
                  Toggle Handler
                         │
         ┌───────────────┴───────────────┐
         ▼                               ▼
    Call expandAll()              Call collapseAll()
         │                               │
         └───────────────┬───────────────┘
                         ▼
                   DOM Updated
```

---

## 3️⃣ Module Communication Architecture

```
┌────────────────────────────────────────────────────────────┐
│                  Window Global Scope                        │
│  window.claudeProductivity (ClaudeProductivityApp)         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  modules: Map {                                      │  │
│  │    'navigation' → NavigationModule                   │  │
│  │    'editHistory' → EditHistoryModule                 │  │
│  │    'compactView' → CompactViewModule ◄─────┐         │  │
│  │  }                                         │         │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
                                                    │
                                                    │
                        ┌───────────────────────────┘
                        │
                        ▼
        ┌───────────────────────────────────────┐
        │     EditHistoryModule                  │
        │ ┌─────────────────────────────────────┤
        │ │ handleCollapseAll(shouldCollapse)   │
        │ │  ├─ app.getModule('compactView')    │
        │ │  └─ call collapse/expandAll()       │
        │ └─────────────────────────────────────┤
        │                                       │
        │     EditUI                            │
        │ ┌─────────────────────────────────────┤
        │ │ createCollapseAllButton()           │
        │ │ ├─ Button ID: claude-collapse-all-btn
        │ │ ├─ onClick: handleCollapseAll()     │
        │ │ ├─ showCollapseAllButton()          │
        │ │ └─ resetCollapseAllButton()         │
        │ └─────────────────────────────────────┤
        └───────────────────────────────────────┘
                        │
                        │ calls
                        ▼
        ┌───────────────────────────────────────┐
        │     CompactViewModule                  │
        │ ┌─────────────────────────────────────┤
        │ │ collapseAllMessages()               │
        │ │  └─ return: count                   │
        │ │                                     │
        │ │ expandAllMessages()                 │
        │ │  └─ return: count                   │
        │ │                                     │
        │ │ processMessage(element)             │
        │ │  └─ (handle single message)         │
        │ └─────────────────────────────────────┤
        │                                       │
        │  this.collapse (MessageCollapse)      │
        │ ┌─────────────────────────────────────┤
        │ │ collapseMessage(element)            │
        │ │  ├─ Create wrapper div              │
        │ │  ├─ Create fade overlay             │
        │ │  ├─ Insert into DOM                 │
        │ │  └─ Update collapsedMessages Map    │
        │ │                                     │
        │ │ expandMessage(element)              │
        │ │  ├─ Set max-height: none            │
        │ │  ├─ Hide fade overlay               │
        │ │  ├─ Remove wrapper (setTimeout)     │
        │ │  └─ Delete from Map                 │
        │ └─────────────────────────────────────┤
        └───────────────────────────────────────┘
```

---

## 4️⃣ Data Flow - User Click

```
User clicks "📦 Tümünü Daralt"
            │
            ▼
    ┌───────────────────┐
    │ EditUI            │
    │ .button click     │
    │ event handler     │
    └─────────┬─────────┘
              │
              ▼
    ┌───────────────────────────────┐
    │ this.isAllCollapsed =          │
    │ !this.isAllCollapsed           │
    │ (toggle)                       │
    └─────────┬───────────────────────┘
              │
              ▼
    ┌────────────────────────────────────────┐
    │ Update button text:                     │
    │ "Tümünü Daralt" → "Tümünü Genişlet"   │
    │         OR                             │
    │ "Tümünü Genişlet" → "Tümünü Daralt"   │
    └─────────┬────────────────────────────────┘
              │
              ▼
    ┌──────────────────────────────┐
    │ this.onCollapseAllClick()     │
    │ [callback function]           │
    └─────────┬────────────────────┘
              │
              ▼ (EditHistoryModule.handleCollapseAll)
    ┌──────────────────────────────┐
    │ app.getModule('compactView')  │
    └─────────┬────────────────────┘
              │
         ┌────┴────┐
         ▼         ▼
    (IF collapse) (IF expand)
         │         │
         ▼         ▼
  collapseAll() expandAll()
         │         │
         └────┬────┘
              ▼
    ┌────────────────────────┐
    │ For each message:       │
    │ if (!isCollapsed) {     │
    │   collapseMessage()     │
    │ }                       │
    └─────────┬──────────────┘
              │
              ▼ (repeat for all messages)
    ┌────────────────────────────────┐
    │ MessageCollapse.               │
    │ collapseMessage(element)        │
    │                                 │
    │ 1. Save scroll position          │
    │ 2. Create wrapper div            │
    │ 3. Create fade overlay           │
    │ 4. Insert element into wrapper   │
    │ 5. Store in collapsedMessages    │
    │ 6. Restore scroll position       │
    │ 7. Emit onStateChange event      │
    └─────────┬──────────────────────┘
              │
              ▼
    ┌────────────────────────────┐
    │ UI Updates:                │
    │ ✅ Mesajlar daraltılı      │
    │ ✅ Button text güncellendi │
    │ ✅ State kaydedildi        │
    └────────────────────────────┘
```

---

## 5️⃣ Auto Collapse Flow

```
Page Load
   │
   ▼
App.init()
   │
   ├─ SettingsManager.load()
   │
   ├─ CompactViewModule.init()
   │     │
   │     ├─ this.getSetting('enabled') ✅
   │     │
   │     ├─ this.processMessages()
   │     │
   │     ├─ [IF] autoCollapseEnabled === true
   │     │     │
   │     │     ├─ setTimeout(500ms)
   │     │     │
   │     │     ▼
   │     │   collapseAllMessages()
   │     │     │
   │     │     └─ All messages collapsed ✅
   │     │
   │     └─ observeMessages()
   │
   └─ EditHistoryModule.init()
         │
         └─ showCollapseAllButton()
```

---

## 6️⃣ Message Selection & Processing

```
Message Discovery (DOM Query)
         │
         ▼
document.querySelectorAll('[data-is-streaming="false"]')
         │
    ┌────┴────────────────────┐
    ▼                         ▼
Message 1                Message 2
    │                         │
    ├─ Has [data-testid]? ├─ Has [data-testid]?
    │ Yes → SKIP          │ No → PROCESS
    │                         │
    │                         ▼
    │                 shouldCollapse()?
    │                     │
    │         ┌───────────┴───────────┐
    │         ▼                       ▼
    │      YES (long)             NO (short)
    │         │                       │
    │         ▼                       │
    │    Process:                     SKIP
    │    - Check if collapsed
    │    - Collapse if needed
    │    - Add expand button
    │    - Add to processedMessages
    │
    └─────────────────────────────┘
            │
            ▼
    Result: Only Claude's
    long messages processed
```

---

## 7️⃣ State Machine - Message Lifecycle

```
                    Initial State
                         │
                         ▼
                 DISCOVERED
                    (DOM found)
                         │
         ┌───────────────┴───────────────┐
         ▼                               ▼
    shouldCollapse()           (skip - too short)
    No              Yes
     │               │
     │               ▼
     │         QUEUED_FOR_COLLAPSE
     │               │
     │         ┌─────┴─────┐
     │         ▼           ▼
     │    AUTO_COLLAPSE  MANUAL_COLLAPSE
     │    (setting)      (button/individual)
     │         │           │
     │         └─────┬─────┘
     │               ▼
     │           COLLAPSED ◄─────┐
     │          (visible)        │
     │               │           │
     │      User expands?        │
     │               │ Yes       │ No
     │               ▼           │
     └────────── EXPANDED        │
              (visible)       (stays)
                               │
                           refresh?
                               ▼
                         DISCOVERED (restart)
```

---

## 8️⃣ Settings Hierarchy

```
SettingsManager
    │
    └─ defaults: {
         │
         ├─ navigation: {
         │    enabled: true
         │    position: 'right'
         │    showCounter: true
         │    ...
         │  }
         │
         ├─ editHistory: {
         │    enabled: false
         │    showBadges: true
         │    ...
         │  }
         │
         ├─ compactView: {
         │    enabled: false
         │    minHeight: 300
         │    previewLines: 10
         │    fadeHeight: 50
         │    autoCollapse: true
         │    autoCollapseEnabled: false ◄─ NEW
         │    keyboardShortcuts: true
         │  }
         │
         ├─ general: {
         │    opacity: 0.7
         │    colorTheme: 'purple'
         │    customColor: '#667eea'
         │  }
         │
         └─ ...
    }
```

---

## 9️⃣ DOM Structure - Collapsed Message

```
Original:
┌─────────────────────────────────────┐
│ Message Content                     │
│ Lorem ipsum dolor sit amet...       │
│ [many lines]                        │
│ ...                                 │
└─────────────────────────────────────┘

After Collapse:
┌─────────────────────────────────────┐
│ .claude-message-collapsed           │
│ (max-height: 192px)                 │
│ ┌───────────────────────────────────┤
│ │ Message Content                   │
│ │ Lorem ipsum dolor sit amet...     │
│ │ [preview - max 8 lines]           │
│ │ ...                               │
│ ├───────────────────────────────────┤
│ │ .claude-collapse-fade (overlay)   │
│ │ gradient(rgba(r,g,b,0) → 0.95)   │
│ └───────────────────────────────────┤
└─────────────────────────────────────┘
```

---

## 🔟 Performance Timeline

```
User clicks button
        │
        ├─ 0ms: Click event fires
        │
        ├─ 5ms: Toggle isAllCollapsed
        │
        ├─ 10ms: Update button text
        │
        ├─ 15ms: Call handleCollapseAll()
        │
        ├─ 20ms: Get compactViewModule
        │
        ├─ 25ms: Call collapseAllMessages()
        │
        ├─ 30-500ms: Loop through all messages
        │   └─ For each: Create wrapper, fade, update DOM
        │
        ├─ 500-1000ms: DOM Rendering
        │   └─ Browser repaint/reflow
        │
        └─ 1000ms: Complete!
           
For 10 messages:  ~50ms
For 50 messages:  ~200ms
For 100+ messages: ~500ms (acceptable)
```

---

**Diagrams Version:** 1.0  
**Created:** December 2024  
**Status:** ✅ Complete
