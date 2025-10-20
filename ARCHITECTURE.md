# Claude Productivity Extension - Teknik Dokümantasyon

## 📐 Mimari Genel Bakış

```
┌─────────────────────────────────────────────────────┐
│                  Claude.ai Web Page                  │
└─────────────────────────────────────────────────────┘
                         ↓
         ┌───────────────────────────────┐
         │      content.js (Entry)       │
         │   - Extension başlatma        │
         │   - URL kontrolü              │
         └───────────────┬───────────────┘
                         ↓
         ┌───────────────────────────────┐
         │          App.js               │
         │   - Modül koordinasyonu       │
         │   - Global event handling     │
         │   - CSS injection             │
         └───────────────┬───────────────┘
                         ↓
    ┌────────────────────┼────────────────────┐
    ↓                    ↓                    ↓
┌─────────┐      ┌─────────────┐      ┌─────────┐
│Settings │      │  EventBus   │      │DOMUtils │
│ Manager │      │             │      │         │
└─────────┘      └─────────────┘      └─────────┘
                         ↓
         ┌───────────────────────────────┐
         │       BaseModule (Abstract)   │
         │   - Lifecycle management      │
         │   - Settings integration      │
         │   - Event subscription        │
         └───────────────┬───────────────┘
                         ↓
    ┌────────────────────┼────────────────────┐
    ↓                    ↓                    ↓
┌─────────┐      ┌─────────────┐      ┌─────────┐
│Navigation│     │ TOC Module  │      │  Edit   │
│  Module  │     │  (Future)   │      │ History │
│          │     │             │      │ (Future)│
└─────────┘      └─────────────┘      └─────────┘
```

## 🔄 Veri Akışı

### 1. Extension Başlatma
```
User Opens Claude.ai
        ↓
content.js loaded
        ↓
App.init()
        ↓
SettingsManager.load()
        ↓
Modules registered
        ↓
Modules initialized (if enabled)
        ↓
Ready! 🎉
```

### 2. Kullanıcı Etkileşimi (Navigation Örneği)
```
User clicks ↑ button
        ↓
NavigationModule.navigatePrevious()
        ↓
DOMUtils.findMessages()
        ↓
DOMUtils.getCurrentVisibleMessageIndex()
        ↓
DOMUtils.scrollToElement()
        ↓
EventBus.emit(NAVIGATION_PREV)
        ↓
Message highlighted
```

### 3. Settings Değişikliği
```
User opens Popup UI
        ↓
popup.js loads settings
        ↓
User changes setting
        ↓
popup.js updates local state
        ↓
User clicks Save
        ↓
chrome.storage.sync.set()
        ↓
EventBus.emit(SETTINGS_CHANGED)
        ↓
Modules receive update
        ↓
Module.onSettingsChanged()
        ↓
UI updated
```

## 🧩 Modül Yaşam Döngüsü

```javascript
Module Created
    ↓
init() called
    ↓
loadSettings()
    ↓
isEnabled() check
    ↓
┌─────────────┐          ┌─────────────┐
│  if true    │          │  if false   │
│  continue   │          │  return     │
└──────┬──────┘          └─────────────┘
       ↓
createUI()
       ↓
setupListeners()
       ↓
subscribeToSettings()
       ↓
Module Active 🟢
       ↓
Settings Changed?
       ↓
onSettingsChanged()
       ↓
Still enabled?
    ↓     ↓
  Yes    No
    ↓     ↓
 Update destroy()
    ↓
Cleanup
```

## 🎨 CSS Scope Sistemi

```
Global Styles (styles.css)
    │
    ├─ .claude-nav-highlight (animation)
    ├─ .claude-nav-btn::after (tooltip)
    └─ .claude-nav-btn:disabled
    
Module Styles (inline or separate CSS)
    │
    ├─ NavigationModule
    │   ├─ .claude-nav-buttons (container)
    │   ├─ .claude-nav-btn (button)
    │   └─ .claude-nav-counter (badge)
    │
    ├─ TOCModule (future)
    │   └─ .claude-toc-*
    │
    └─ EditHistoryModule (future)
        └─ .claude-edit-*
```

## 🔐 Permission Sistemi

```json
{
  "storage": "Settings saklamak için",
  "activeTab": "Aktif tab'a erişim",
  "host_permissions": ["https://claude.ai/*"]
}
```

## 📡 Event Types

```javascript
// Message events
MESSAGES_UPDATED      // Yeni mesaj bulundu
MESSAGE_CLICKED       // Mesaja tıklandı
MESSAGE_SCROLLED      // Mesaja scroll yapıldı

// Settings events
SETTINGS_CHANGED      // Settings güncellendi
FEATURE_TOGGLED       // Özellik açıldı/kapandı

// Navigation events
NAVIGATION_PREV       // Önceki mesaja gidildi
NAVIGATION_NEXT       // Sonraki mesaja gidildi
NAVIGATION_TOP        // En üste gidildi

// UI events
UI_READY              // UI hazır
DOM_CHANGED           // DOM değişti
```

## 🎯 Best Practices

### 1. Modül Geliştirirken
- ✅ Her zaman `BaseModule`'den türet
- ✅ `init()` ve `destroy()` metodlarını implement et
- ✅ Event listener'ları `unsubscribers` array'ine ekle
- ✅ DOM elementlerini `this.elements` objesinde sakla
- ✅ Settings değişikliklerini `onSettingsChanged()` ile dinle

### 2. Event Kullanımı
- ✅ Module-to-module iletişim için EventBus kullan
- ✅ Event isimlerini `Events` constant'ından al
- ✅ Her event'e anlamlı data gönder
- ❌ Direct module reference kullanma

### 3. DOM İşlemleri
- ✅ `DOMUtils` helper'larını kullan
- ✅ Debounce/Throttle kullan (scroll, resize vb.)
- ✅ MutationObserver ile DOM değişikliklerini izle
- ❌ querySelector'ı her frame'de çağırma

### 4. Settings Yönetimi
- ✅ Her module için ayrı settings objesi oluştur
- ✅ Default değerleri `SettingsManager`'da tanımla
- ✅ Settings değiştiğinde UI'ı güncelle
- ❌ Settings'i manuel olarak localStorage'a yazma

## 🐛 Debug Komutları

```javascript
// Extension bilgisi
window.claudeProductivity.getDebugInfo()

// Modül listesi
window.claudeProductivity.modules

// Navigation modülü
window.claudeProductivity.getModule('navigation')

// Settings
window.claudeProductivity.getModule('navigation').getSettings()

// Manuel restart
window.claudeProductivity.restart()

// Event logları
eventBus.on('*', console.log) // (not implemented yet)
```

## 📦 Build Process (Gelecek)

```bash
# Development
npm run dev

# Production build
npm run build

# Test
npm run test

# Lint
npm run lint
```

## 🚀 Deployment Checklist

- [ ] Tüm console.log'lar kaldırıldı (veya production guard ile)
- [ ] İkonlar eklendi
- [ ] README güncel
- [ ] Version number güncellendi
- [ ] Tüm özellikler test edildi
- [ ] Chrome Web Store metadata hazır
- [ ] Privacy policy hazır (eğer gerekiyorsa)

## 📈 Performans Optimizasyonları

### Şu Anki Optimizasyonlar
- Debounced DOM observer (500ms)
- Throttled scroll listener (100ms)
- Lazy module initialization
- Event delegation where possible

### Gelecek Optimizasyonlar
- Virtual scrolling for large TOC
- Web Worker for heavy computations
- IndexedDB for large data storage
- Code splitting for modules

## 🔮 Gelecek Planları

### v1.1.0
- [ ] Table of Contents modülü
- [ ] Edit History modülü
- [ ] Settings export/import

### v1.2.0
- [ ] Export özelliği
- [ ] Search özelliği
- [ ] Bookmarks özelliği

### v2.0.0
- [ ] Multi-language support
- [ ] Theme customization
- [ ] Advanced analytics
- [ ] Cloud sync (optional)

---

**Son Güncelleme:** 2024-10-21
