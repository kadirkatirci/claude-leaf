# Claude Productivity Extension 🚀

Claude web arayüzü için profesyonel, modüler ve genişletilebilir verimlilik araçları.

## 🎯 Özellikler

### ✅ Navigation Buttons (v1.0)
- Mesajlar arası hızlı navigasyon
- Klavye kısayolları (Alt+↑/↓, Alt+Home)
- Ayarlanabilir pozisyon, opacity ve animasyonlar
- Mesaj sayacı
- Smooth scroll desteği

### 🔜 Yakında Gelecek
- 📑 **Table of Contents**: Otomatik başlık tespiti ve hızlı navigasyon
- ✏️ **Edit History**: Edit yapılmış promptları görüntüleme
- 💾 **Export**: Konuşmaları Markdown/PDF formatında dışa aktarma
- 🔍 **Search**: Konuşma içinde gelişmiş arama
- 🔖 **Bookmarks**: Önemli mesajları işaretleme

## 📦 Kurulum

1. Chrome'da `chrome://extensions/` adresine gidin
2. Sağ üstten **"Geliştirici modu"**nu aktif edin
3. **"Paketlenmemiş öğe yükle"** butonuna tıklayın
4. Bu klasörü seçin
5. Claude.ai'a gidin!

## ⚙️ Ayarlar

Extension ikonuna tıklayarak ayarlar panelini açabilirsiniz. Her özellik için ayrı ayarlar:

### Navigation Ayarları
- ✅ Özelliği aç/kapat
- 📍 Pozisyon (Sol/Sağ)
- 🔢 Mesaj sayacı göster/gizle
- 🎨 Smooth scroll
- ⌨️ Klavye kısayolları
- ⏱️ Vurgulama süresi
- 👁️ Opaklık ayarı

## 🏗️ Proje Yapısı

```
claude_productivity_ext/
├── manifest.json                 # Extension tanımları
├── content.js                    # Ana entry point
├── styles.css                    # Global stiller
│
├── src/
│   ├── App.js                   # Ana uygulama yöneticisi
│   │
│   ├── modules/                 # Özellik modülleri
│   │   ├── BaseModule.js        # Base class (tüm modüller buradan türer)
│   │   ├── NavigationModule.js  # Navigation özelliği
│   │   ├── TOCModule.js         # TODO: Table of Contents
│   │   └── EditHistoryModule.js # TODO: Edit History
│   │
│   ├── utils/                   # Yardımcı araçlar
│   │   ├── EventBus.js          # Event-driven iletişim
│   │   ├── SettingsManager.js   # Settings yönetimi
│   │   └── DOMUtils.js          # DOM işlemleri
│   │
│   └── styles/                  # Modül stilleri
│       └── navigation.css       # Navigation stilleri
│
├── popup/                       # Settings UI
│   ├── popup.html              # Popup HTML
│   ├── popup.css               # Popup stilleri
│   └── popup.js                # Popup logic
│
├── icons/                       # Extension ikonları
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
│
└── README.md                    # Bu dosya
```

## 🧩 Mimari

### Modüler Tasarım
Her özellik bağımsız bir modül olarak tasarlanmıştır:

```javascript
class YourModule extends BaseModule {
  constructor() {
    super('moduleName');
  }

  async init() {
    await super.init();
    // Modül başlatma
  }

  destroy() {
    // Temizlik
    super.destroy();
  }
}
```

### Event-Driven İletişim
Modüller arası iletişim için EventBus kullanılır:

```javascript
// Event emit et
this.emit(Events.CUSTOM_EVENT, data);

// Event dinle
this.subscribe(Events.CUSTOM_EVENT, (data) => {
  // Handle event
});
```

### Settings Yönetimi
Her modülün kendi ayarları vardır:

```javascript
// Ayar oku
const value = this.getSetting('keyName');

// Ayar yaz
await this.setSetting('keyName', newValue);

// Modülü aç/kapat
await this.toggle();
```

### DOM Utils
Ortak DOM işlemleri için yardımcı fonksiyonlar:

```javascript
// Mesajları bul
const messages = DOMUtils.findMessages();

// Element'e scroll
DOMUtils.scrollToElement(element);

// DOM değişikliklerini izle
const observer = DOMUtils.observeDOM(callback);
```

## 🔧 Geliştirme

### Yeni Modül Ekleme

1. `src/modules/` altında yeni modül dosyası oluştur
2. `BaseModule`'den türet
3. `init()` ve `destroy()` metodlarını implement et
4. `src/App.js` içinde modülü kaydet
5. `SettingsManager.js` içinde default ayarları ekle

Örnek:

```javascript
// src/modules/MyModule.js
import BaseModule from './BaseModule.js';

class MyModule extends BaseModule {
  constructor() {
    super('myFeature');
  }

  async init() {
    await super.init();
    if (!this.enabled) return;
    
    // Özelliği başlat
    this.log('My feature başlatıldı');
  }

  destroy() {
    // Temizlik
    super.destroy();
  }
}

export default MyModule;
```

```javascript
// src/App.js içinde
import MyModule from './modules/MyModule.js';

registerModules() {
  // ...
  this.registerModule('myFeature', new MyModule());
}
```

### Debug

Console'da şu komutları kullanabilirsiniz:

```javascript
// Extension bilgisi
window.claudeProductivity.getDebugInfo()

// Belirli bir modüle erişim
window.claudeProductivity.getModule('navigation')

// Settings'i gör
window.claudeProductivity.getModule('navigation').getSettings()
```

## 🐛 Sorun Giderme

### Extension çalışmıyor
1. `chrome://extensions/` üzerinden extension'ı yenileyin
2. Claude.ai sayfasını yenileyin
3. Console'da (F12) hata mesajlarını kontrol edin

### Butonlar görünmüyor
1. Settings'de Navigation özelliğinin açık olduğunu kontrol edin
2. Console'da `window.claudeProductivity.getDebugInfo()` çalıştırın
3. `activeModules` array'inde 'navigation' olmalı

### Settings kayboldu
1. Settings'i sıfırlayın (Popup > Sıfırla butonu)
2. Extension'ı kaldırıp yeniden yükleyin

## 📝 Changelog

### v1.0.0 (2024-10-21)
- ✨ İlk release
- ✅ Navigation Buttons özelliği
- ⚙️ Settings UI
- 🏗️ Modüler mimari
- 📚 Kapsamlı dokümantasyon

## 🤝 Katkıda Bulunma

Yeni özellik önerileri ve bug raporları için issue açabilirsiniz!

## 📄 Lisans

MIT

## 👨‍💻 Geliştirici

Kadir - 2024

---

**Keyifli kullanımlar!** 🎉
