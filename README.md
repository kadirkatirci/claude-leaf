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
├── styles.css                    # Global stiller
│
├── src/                          # Ana kaynak kod (ES Modules)
│   ├── content.js               # Entry point
│   ├── App.js                   # Ana uygulama yöneticisi
│   │
│   ├── modules/                 # Özellik modülleri
│   │   ├── BaseModule.js        # Base class
│   │   ├── NavigationModule.js  # Navigation özelliği
│   │   ├── TOCModule.js         # TODO
│   │   └── EditHistoryModule.js # TODO
│   │
│   ├── utils/                   # Yardımcı araçlar
│   │   ├── EventBus.js          # Event-driven iletişim
│   │   ├── SettingsManager.js   # Settings yönetimi
│   │   └── DOMUtils.js          # DOM işlemleri
│   │
│   └── styles/                  # Modül stilleri
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

### ES Modules (Native)
Bu proje **native ES modules** kullanıyor. Build sistemi gereksiz!

- ✅ Direkt geliştirme
- ✅ Import/Export syntax
- ✅ Hot reload kolay
- ✅ Modern JavaScript

### Modüler Tasarım
Her özellik bağımsız bir modül:

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
Modüller arası iletişim için EventBus:

```javascript
// Event emit et
this.emit(Events.CUSTOM_EVENT, data);

// Event dinle
this.subscribe(Events.CUSTOM_EVENT, (data) => {
  // Handle event
});
```

### Settings Yönetimi
Her modülün kendi ayarları:

```javascript
// Ayar oku
const value = this.getSetting('keyName');

// Ayar yaz
await this.setSetting('keyName', newValue);

// Modülü aç/kapat
await this.toggle();
```

## 🔧 Geliştirme

### Yeni Modül Ekleme

1. `src/modules/` altında yeni modül oluştur
2. `BaseModule`'den türet
3. `src/App.js` içinde kaydet
4. `src/utils/SettingsManager.js` içinde default ayarları ekle
5. Extension'ı yenile - **build gereksiz!**

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
    
    this.log('My feature başlatıldı');
  }

  destroy() {
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

Console'da:

```javascript
// Extension bilgisi
window.claudeProductivity.getDebugInfo()

// Belirli bir modüle erişim
window.claudeProductivity.getModule('navigation')

// Settings'i gör
window.claudeProductivity.getModule('navigation').getSettings()
```

### Hot Reload

Extension'da değişiklik yapınca:
1. `chrome://extensions/` üzerinden extension'ı yenile
2. Claude.ai sayfasını yenile
3. **Build adımı yok!** ✨

## 🐛 Sorun Giderme

### Extension çalışmıyor
1. `chrome://extensions/` üzerinden extension'ı yenileyin
2. Claude.ai sayfasını yenileyin (F5)
3. Console'da (F12) hata mesajlarını kontrol edin
4. Chrome 91+ kullandığınızdan emin olun (ES Modules için)

### Butonlar görünmüyor
1. Settings'de Navigation özelliğinin açık olduğunu kontrol edin
2. Console'da `window.claudeProductivity.getDebugInfo()` çalıştırın
3. `activeModules` array'inde 'navigation' olmalı

### ES Module hatası
Chrome versiyonunuz 91+ olmalı. Eski versiyonlar ES Modules'ü desteklemez.

## 📝 Changelog

### v1.0.0 (2024-10-21)
- ✨ İlk release
- ✅ Navigation Buttons özelliği
- ⚙️ Settings UI
- 🏗️ Modüler mimari (ES Modules)
- 📚 Kapsamlı dokümantasyon

## 🚀 Yol Haritası

### v1.1.0
- [ ] Table of Contents modülü
- [ ] Edit History modülü
- [ ] Geliştirilmiş DOM selectors

### v1.2.0
- [ ] Export özelliği (MD/PDF)
- [ ] Search modülü
- [ ] Bookmarks

### v2.0.0
- [ ] Multi-language support
- [ ] Theme customization
- [ ] Cloud sync (optional)

## 💡 Teknik Detaylar

- **ES Modules**: Native browser modules, build gereksiz
- **Chrome Manifest v3**: En güncel standart
- **Chrome Storage API**: Cross-device sync için
- **MutationObserver**: DOM değişikliklerini takip
- **Event-driven**: Loosely coupled architecture

## 🤝 Katkıda Bulunma

Yeni özellik önerileri ve bug raporları için issue açabilirsiniz!

## 📄 Lisans

MIT

## 👨‍💻 Geliştirici

Kadir - 2024

---

**Keyifli kullanımlar!** 🎉
