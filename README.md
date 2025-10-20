# Claude Productivity Extension 🚀

Claude web arayüzü için verimlilik araçları içeren Chrome Extension.

## 📦 Kurulum

1. Chrome'da `chrome://extensions/` adresine gidin
2. Sağ üstten "Geliştirici modu"nu aktif edin
3. "Paketlenmemiş öğe yükle" butonuna tıklayın
4. Bu klasörü (`claude_productivity_ext`) seçin
5. Claude.ai'a gidin ve extension otomatik olarak aktif olacak!

## ✨ Özellikler

### 🧭 Navigation Buttons (v1.0)

Uzun sohbetlerde mesajlar arası kolayca gezinmenizi sağlar.

#### Kullanım:
- **↑ Butonu**: Bir önceki mesaja git
- **↓ Butonu**: Bir sonraki mesaja git
- **⇈ Butonu**: En üst mesaja git

#### Klavye Kısayolları:
- `Alt + ↑`: Önceki mesaj
- `Alt + ↓`: Sonraki mesaj
- `Alt + Home`: En üste git

#### Özellikler:
- Mesajları otomatik algılama
- Smooth scroll animasyonu
- Mesaj vurgulama efekti
- Kaçıncı mesajda olduğunuzu gösteren counter (örn: 5/23)
- Yeni mesajlar eklendiğinde otomatik güncelleme
- Şık ve modern tasarım

## 🔮 Gelecek Özellikler

- [ ] Table of Contents / Outline Viewer
- [ ] Edit History Indicator
- [ ] Export Conversations
- [ ] Search in Conversation
- [ ] Bookmarks
- [ ] Word/Token Counter

## 🛠️ Geliştirme

Extension manifest v3 kullanıyor.

### Dosya Yapısı:
```
claude_productivity_ext/
├── manifest.json       # Extension tanımları
├── content.js          # Ana logic
├── styles.css          # Buton stilleri
├── icons/             # Extension ikonları
└── README.md          # Bu dosya
```

### Debug:
- Chrome DevTools Console'da "Claude Productivity Extension" loglarını görebilirsiniz
- Değişiklik yaptıktan sonra `chrome://extensions/` üzerinden extension'ı yenileyin

## 📝 Notlar

- Extension sadece `claude.ai` domaininde çalışır
- Manifest v3 standardını kullanır
- Minimal permission kullanır (sadece storage ve activeTab)

## 👨‍💻 Geliştirici

Kadir - 2024

---

**Keyifli kullanımlar!** 🎉
