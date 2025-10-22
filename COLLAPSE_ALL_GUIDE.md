# 📖 Tümünü Daralt Özelliği - Kullanıcı Rehberi

## 🎯 Özet
Yeni bir **"📦 Tümünü Daralt"** butonu ekledik. Bu buton, tüm Claude mesajlarını aynı anda daralt veya genişletir.

---

## 📍 Nerede Bulunur?

**Konum:** Chat başlığının sağında, "✏️ Edits" butonunun yanında

```
┌──────────────────────────────────────┐
│ Chat Title  │ ✏️ 3 Edits │ 📦 Daralt │
└──────────────────────────────────────┘
                              ↑
                    Yeni buton burada
```

---

## 🎨 Button Durumları

### 1️⃣ Normal Durum (Mesajlar Açık)
```
📦 Tümünü Daralt
  └─ Tıkla → Tüm mesajları daralt
```

### 2️⃣ Daraltılmış Durum
```
📦 Tümünü Genişlet
  └─ Tıkla → Tüm mesajları genişlet
```

---

## 🔧 Nasıl Kullanılır?

### Senaryo 1: Tüm Mesajları Daralt
```
1. "📦 Tümünü Daralt" butonuna tıkla
2. ✅ Tüm Claude mesajları üst kısım önizlemesiyle daraltılacak
3. ✅ Button metni "📦 Tümünü Genişlet" olacak
```

### Senaryo 2: Tüm Mesajları Genişlet
```
1. "📦 Tümünü Genişlet" butonuna tıkla
2. ✅ Tüm daraltılmış mesajlar genişletilecek
3. ✅ Button metni "📦 Tümünü Daralt" olacak
```

### Senaryo 3: Karışık Durumdan Daralt
```
1. Bazı mesajlar daraltılı, bazıları açık
2. "📦 Tümünü Daralt" butonuna tıkla
3. ✅ Açık olanlar da daraltılacak
4. ✅ Hepsi aynı state'de olacak
```

---

## ⚙️ Settings

### Auto Collapse (Otomatik Daralt)
```
Ayar: CompactView → "Auto Collapse" 

Açarsanız:
✅ Yeni mesajlar otomatik olarak daraltılmış gelir
✅ Sayfayı yenilediğinizde mesajlar daraltılı açılır

Kaparsanız:
❌ Mesajlar normal (açık) halde gelir
```

---

## 📊 Hangi Mesajlar Daraltılır?

✅ **Daraltılan Mesajlar:**
- Claude'un yanıtları
- Uzun mesajlar (çok satırlı)

❌ **Daraltılmayan Mesajlar:**
- Kullanıcı mesajları (soru/istek)
- Çok kısa mesajlar

---

## 🎮 Bireysel Mesaj Kontrolleri

Eğer sadece belli mesajlar daraltmak istiyorsanız:

```
1. İlgili mesajın sağında "- Daralt" butonu var
2. Tıkla → Sadece o mesaj daraltılır
3. İsterseniz bireysel olarak açabilirsin

"📦 Tümünü Daralt" butonu ise HEPSİNİ kontrol eder
```

---

## 💡 İpuçları

### 💡 İpucu 1: Okuma Deneyimi
```
Uzun konuşmalarda:
1. "📦 Tümünü Daralt" ile hepsini daralt
2. Sonra sadece ilgilendiğin mesajları aç
3. Daha temiz ve hızlı okuma!
```

### 💡 İpucu 2: Navigasyon
```
İmportant: Navigation butonları ("↑ ↓") hâlâ çalışır
1. Tüm mesajlar daraltılı olsa bile
2. "↑" ile önceki mesaja git
3. Otomatik açılacak ve highlight edilecek
```

### 💡 İpucu 3: Edit History
```
Edit edilmiş mesajları bulmak:
1. "✏️ Edits" butonuna tıkla
2. Edit liste açılır
3. Mesajlar otomatik açılacak ve highlight edilecek
4. "📦 Tümünü Daralt" kullansan bile
```

---

## 🆘 Sorun Giderme

### Soru 1: Button görünmüyor
```
Neden?
- ✏️ CompactView disabled olabilir
- ✏️ Edit yapılmamış mesaj olabilir

Çözüm:
1. Popup → CompactView → "Enable" klikla
2. Sayfayı refresh et
```

### Soru 2: Button çalışmıyor
```
Çözüm:
1. Tarayıcı konsolunu aç (F12)
2. Hata varsa görünecek
3. Sayfayı refresh et

Büyük ihtimalle otomatik düzelir
```

### Soru 3: Mesajlar açılmıyor
```
Çözüm:
1. "📦 Tümünü Genişlet" butonuna tıkla
2. Hâlâ kapalıysa sayfayı refresh et
```

---

## 🔄 Durum Transitionist

```
İlk Açılış (autoCollapse: ON)
    ↓
Tüm mesajlar daraltılı
    ↓
"📦 Tümünü Genişlet" tıkla
    ↓
Tüm mesajlar açık
    ↓
"📦 Tümünü Daralt" tıkla
    ↓
Tüm mesajlar daraltılı (başa dön)
```

---

## 📈 Özel Özellikler

### Feature Flag: autoCollapseEnabled
```javascript
// Settings Manager'da:
compactView: {
  autoCollapseEnabled: false  // true yaparsan auto daralt
}
```

### Performance
```
✅ WeakMap kullanarak memory efficient
✅ Yüzlerce mesaja bile 
✅ Smooth animations
✅ No lag
```

---

## 🚀 Gelecek Planları

Eklenebilecek özellikler:

- [ ] Keyboard shortcut: `Alt+C` = Tümünü Daralt/Genişlet
- [ ] Kategori bazlı daralt (sadece uzun mesajlar)
- [ ] Mesaj sayısı counter
- [ ] Daralt durumunu kaydet (reload sonrasında da aynı kalır)

---

## 📞 Destek

Bir sorun bulursan:
1. Chrome Console'u kontrol et (Ctrl+Shift+J)
2. Hatayı kopyala
3. Issue açabilirsin

---

**Version:** 1.2.0
**Tarih:** December 2024
**Status:** ✅ Stable
