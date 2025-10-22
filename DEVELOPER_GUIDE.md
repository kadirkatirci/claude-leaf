# 🔧 Teknik Rehber - Tümünü Daralt Geliştirmesi

## 📚 Kaynak Kod Haritası

### 1. Settings Definition
**Dosya:** `src/utils/SettingsManager.js`

```javascript
compactView: {
  enabled: false,
  minHeight: 300,
  previewLines: 10,
  fadeHeight: 50,
  autoCollapse: true,
  autoCollapseEnabled: false,  // ← YENİ AYAR
  keyboardShortcuts: true,
}
```

**Path:** `compactView.autoCollapseEnabled`

---

### 2. UI Button
**Dosya:** `src/modules/EditHistoryModule/EditUI.js`

#### Yeni Class Properties:
```javascript
class EditUI {
  constructor(getTheme, onButtonClick, onCollapseAllClick) {
    this.onCollapseAllClick = onCollapseAllClick;
    this.collapseAllButton = null;
    this.isAllCollapsed = false;
  }
}
```

#### Yeni Metodlar:
```javascript
/**
 * Tümünü Daralt/Genişlet butonu oluştur
 */
createCollapseAllButton(titleContainer, theme)

/**
 * Tümünü Daralt buttonunu göster/gizle
 */
showCollapseAllButton(show)

/**
 * Tümünü Daralt buttonunun state'ini sıfırla
 */
resetCollapseAllButton()
```

#### Button HTML:
```html
<button id="claude-collapse-all-btn">
  📦 <span id="claude-collapse-all-label">Tümünü Daralt</span>
</button>
```

#### Styling:
- Inline styles ile uygulanır (gradient, shadow vb.)
- Hover efektleri: scale(1.05) + shadow artar
- Active state'de scale(0.95)

---

### 3. Module Integration
**Dosya:** `src/modules/EditHistoryModule.js`

#### Constructor Update:
```javascript
this.ui = new EditUI(
  () => this.getTheme(),
  () => this.panel.toggle(),
  (shouldCollapse) => this.handleCollapseAll(shouldCollapse)  // ← YENİ
);
```

#### Yeni Metod:
```javascript
/**
 * Tümünü Daralt/Genişlet işlemi
 * @param {boolean} shouldCollapse - true: daralt, false: genişlet
 */
handleCollapseAll(shouldCollapse) {
  const app = window.claudeProductivity;
  const compactViewModule = app.getModule('compactView');
  
  if (shouldCollapse) {
    compactViewModule.collapseAllMessages();
  } else {
    compactViewModule.expandAllMessages();
  }
}
```

#### Settings Change Handler Update:
```javascript
onSettingsChanged(settings) {
  // CompactView aktif mi kontrol et
  const compactViewEnabled = this.settings?.compactView?.enabled;
  
  if (compactViewEnabled && this.editedMessages.length > 0) {
    this.ui.showCollapseAllButton(true);
  } else {
    this.ui.showCollapseAllButton(false);
    this.ui.resetCollapseAllButton();
  }
}
```

---

### 4. CompactView Logic
**Dosya:** `src/modules/CompactViewModule.js`

#### Core Metodlar:

```javascript
/**
 * Tüm mesajları daralt
 * @returns {number} Daraltılan mesaj sayısı
 */
collapseAllMessages() {
  const messages = document.querySelectorAll('[data-is-streaming="false"]');
  let collapsedCount = 0;

  messages.forEach(message => {
    // User mesajlarını atla
    if (message.querySelector('[data-testid="user-message"]')) return;

    // Collapse edilmeli mi?
    if (this.collapse.shouldCollapse(message)) {
      if (!this.collapse.isCollapsed(message)) {
        this.collapse.collapseMessage(message);
        collapsedCount++;
      }
    }
  });

  return collapsedCount;
}

/**
 * Tüm mesajları genişlet
 * @returns {number} Genişletilen mesaj sayısı
 */
expandAllMessages() {
  // Similar logic...
}
```

#### Init Update:
```javascript
async init() {
  // ... existing code ...

  // Auto collapse açıksa tüm mesajları daralt
  if (this.getSetting('autoCollapseEnabled')) {
    setTimeout(() => {
      this.collapseAllMessages();
    }, 500);
  }

  // ... rest of init ...
}
```

---

## 🔗 Inter-Module Communication Flow

```
Window Global Scope
    ↓
window.claudeProductivity = app (ClaudeProductivityApp)
    ↓
app.getModule('compactView') → CompactViewModule instance
    ↓
compactViewModule.collapseAllMessages()
    ↓
MessageCollapse.collapseMessage() for each message
    ↓
wrapper + fadeOverlay DOM manipulations
```

---

## 🧩 Key Dependencies

### EditUI → EditHistoryModule
```
EditUI.onCollapseAllClick callback
    ↓
EditHistoryModule.handleCollapseAll()
    ↓
Global: window.claudeProductivity
```

### CompactViewModule Internal
```
CompactViewModule
    ↓
this.collapse (MessageCollapse instance)
    ├─ collapseMessage(element)
    ├─ expandMessage(element)
    ├─ isCollapsed(element)
    └─ shouldCollapse(element)
    ↓
this.expandButton (ExpandButton instance)
    └─ updateButtonState()
```

---

## 🎯 State Management

### Global State
```javascript
window.claudeProductivity {
  modules: Map {
    'navigation' → NavigationModule,
    'editHistory' → EditHistoryModule,
    'compactView' → CompactViewModule
  }
}
```

### EditUI Local State
```javascript
EditUI {
  collapseAllButton: HTMLElement,
  isAllCollapsed: boolean
}
```

### CompactViewModule State
```javascript
CompactViewModule {
  collapse: MessageCollapse {
    collapsedMessages: Map<Element, State>
  },
  processedMessages: WeakSet<Element>
}
```

---

## 🔄 Event Flow Diagram

```
User clicks "📦 Tümünü Daralt"
    ↓ (click event)
EditUI.button.addEventListener('click')
    ↓
this.isAllCollapsed = !this.isAllCollapsed
    ↓
this.onCollapseAllClick(this.isAllCollapsed)
    ↓ (callback)
EditHistoryModule.handleCollapseAll(shouldCollapse)
    ↓
window.claudeProductivity.getModule('compactView')
    ↓
compactViewModule.collapseAllMessages() or expandAllMessages()
    ↓
this.collapse.collapseMessage(messageElement) x N
    ↓
MessageCollapse.collapseMessage()
    ├─ Create wrapper div
    ├─ Create fade overlay
    ├─ Insert into DOM
    ├─ Store state in collapsedMessages Map
    └─ Emit Events.MESSAGE_COLLAPSED
    ↓
CompactViewModule.onMessageStateChanged()
    ├─ updateButtonState()
    └─ emit(Events.MESSAGE_COLLAPSED)
    ↓
UI Updated ✅
```

---

## 🧪 Testing Checklist

### Unit Tests

```javascript
// EditUI.js
describe('createCollapseAllButton', () => {
  test('should create button with correct ID')
  test('should set initial text to "Tümünü Daralt"')
  test('should toggle text on click')
  test('should call onCollapseAllClick with correct value')
})

describe('CompactViewModule', () => {
  test('collapseAllMessages should collapse all non-user messages')
  test('expandAllMessages should expand all collapsed messages')
  test('collapseAllMessages should return count')
  test('autoCollapseEnabled should work on init')
})
```

### Integration Tests

```javascript
describe('Collapse All Integration', () => {
  test('EditUI button should call EditHistoryModule.handleCollapseAll')
  test('EditHistoryModule should call CompactViewModule.collapseAllMessages')
  test('CompactViewModule should update MessageCollapse state')
  test('Settings change should show/hide button appropriately')
})
```

### E2E Tests

```javascript
// Scenario 1
test('should collapse all messages when button clicked')

// Scenario 2
test('should expand all messages when clicked again')

// Scenario 3
test('should show button only when both EditHistory and CompactView enabled')

// Scenario 4
test('autoCollapseEnabled should collapse all on page load')
```

---

## 🐛 Debugging Tips

### Chrome DevTools Console

```javascript
// Get CompactView module
const cv = window.claudeProductivity.getModule('compactView')

// Get state
cv.collapse.collapsedMessages  // Map of collapsed messages

// Manual collapse all
cv.collapseAllMessages()

// Manual expand all
cv.expandAllMessages()

// Check settings
cv.getSettings()

// Check if specific message is collapsed
cv.collapse.isCollapsed(messageElement)
```

### Logging

```javascript
// EditUI logs:
[EditUI] ✅ Tümünü Daralt butonu eklendi

// CompactViewModule logs:
📦 5 mesaj daraltıldı
📂 5 mesaj genişletildi
```

---

## 🔍 Code Review Points

1. **Memory Leaks**
   - WeakSet `processedMessages` kullanıyor (GC friendly)
   - Event listeners properly unsubscribed
   - DOM elements properly cleaned up

2. **Performance**
   - Debounced/throttled operations
   - No infinite loops
   - Efficient DOM queries (querySelector instead of loop)

3. **Error Handling**
   - null/undefined checks
   - Graceful fallbacks
   - console.warn for missing dependencies

4. **Accessibility**
   - Button has proper ID and classes
   - Hover/focus states visible
   - ARIA labels (future improvement)

---

## 📋 Modification Checklist

Eğer bu özelliği değiştirmek istersen:

- [ ] `SettingsManager.js` de default values kontrol et
- [ ] `EditUI.js` de button oluşturma kodu kontrol et
- [ ] `EditHistoryModule.js` de handleCollapseAll kodu kontrol et
- [ ] `CompactViewModule.js` de collapse/expand logic kontrol et
- [ ] Tüm test senaryoları çalıştır
- [ ] Console hataları kontrol et
- [ ] Memory profiler ile test et
- [ ] Cross-browser test et

---

## 🚀 Future Enhancements

```javascript
// Keyboard shortcut
if (e.altKey && e.key === 'c') {
  editHistoryModule.ui.collapseAllButton.click();
}

// Persist state in localStorage
// localStorage.setItem('collapseAllState', 'collapsed')

// Analytics
// eventBus.emit('analytics:collapse_all', { action, count })

// Animations
// Use CSS transitions for smoother collapse/expand
```

---

**Version:** 1.2.0
**Last Updated:** December 2024
**Maintainer:** Development Team
