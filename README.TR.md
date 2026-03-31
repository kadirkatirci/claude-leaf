# Claude Leaf

**Claude Leaf**, Claude.ai deneyiminizi geliştirmek için tasarlanmış, mesaj navigasyonu, yer imleri ve daha fazlasını sunan bir üretkenlik eklentisidir.

[Chrome Web Mağazası](https://chromewebstore.google.com/detail/claude-leaf/dpodfmfbkdnighbaajagchhbkblememp) · [Tanıtım Videosu](https://www.youtube.com/watch?v=rRNJ9Rvw-Rg)

## Özellikler

*   **Mesaj Navigasyonu:** Uzun sohbetlerde mesajlar arasında kolayca yukarı/aşağı gezinin.
*   **Yer İmleri (Bookmarks):** Önemli konuşmaları veya spesifik mesajları kaydedin ve hızlıca erişin.
*   **Emoji İşaretleyiciler:** Mesajları daha sonra kolayca bulmak için emojilerle işaretleyin.
*   **Düzenleme Geçmişi:** Mesajlarınız üzerinde yaptığınız değişikliklerin geçmişini görüntüleyin.
*   **Kullanıcı Dostu Arayüz:** Claude.ai arayüzü ile uyumlu, temiz ve modern tasarım.

## Geliştirme Aşamasındaki Modüller

*   **Compact View:** Hâlen geliştirme aşamasında, mevcut build içinde aktif değil.
*   **Content Folding:** Hâlen geliştirme aşamasında, mevcut build içinde aktif değil.
*   **Sidebar Collapse:** Hâlen geliştirme aşamasında, mevcut build içinde aktif değil.

## Kurulum

### Chrome Web Mağazası Üzerinden

Claude Leaf'i doğrudan Chrome Web Mağazası üzerinden kurabilirsiniz:

https://chromewebstore.google.com/detail/claude-leaf/dpodfmfbkdnighbaajagchhbkblememp

1.  Bu projeyi bilgisayarınıza indirin veya klonlayın.
2.  Google Chrome'da `chrome://extensions/` adresine gidin.
3.  Sağ üst köşedeki **"Geliştirici modu" (Developer mode)** anahtarını açın.
4.  Sol üstteki **"Paketlenmemiş öğe yükle" (Load unpacked)** butonuna tıklayın.
5.  Proje klasörünü (`claude-leaf`) seçin.

## Geliştirme

Proje bağımlılıklarını yüklemek ve geliştirme modunda çalıştırmak için:

```bash
npm install
npm run dev
```

Build almak için:

```bash
npm run build
```

Test komutları:

```bash
npm test
npm run test:e2e
npm run test:e2e:ui
```

Mevcut build içinde aktif modüller: Mesaj Navigasyonu, Yer İmleri, Emoji İşaretleyiciler ve Düzenleme Geçmişi.

## Fixture Tabanlı E2E Testleri

Playwright suite’i gerçek unpacked extension’ı, deterministik `claude.ai` fixture’ları üzerinde çalıştırır.

- `seed` fixture’lar etkileşimli test host’larıdır.
- `sanitized_html` fixture’lar canlı Claude sayfalarından üretilmiş, read-only DOM drift fixture’larıdır.
- Browser harness canlı ağı varsayılan olarak kapatır; yalnız commitlenmiş fixture asset’leri `https://claude.ai/...` üzerinden servis edilir.
- Görsel snapshot’lar için local IBM Plex font dosyaları repoda tutulur.

Canlı fixture yenileme akışı:

1. Gerçek Claude sayfasını ignore edilen source klasörüne yakalayın:

   ```bash
   npm run fixtures:capture -- --id chat-sidebar-rich --route /chat/example-thread
   ```

2. Capture’ı commitlenen fixture’a sanitize edin:

   ```bash
   npm run fixtures:sanitize -- --id chat-sidebar-rich --source chat-sidebar-rich --route /chat/example-thread --pageType conversation
   ```

3. Tüm fixture giriş sayfalarını ve metadata kurallarını tekrar üretin:

   ```bash
   npm run fixtures:refresh
   ```

`fixtures:refresh` şu kuralları zorunlu kılar:

- her fixture route’u benzersiz olmalı
- `seed` fixture’lar `seedProfile` tanımlamalı
- `sanitized_html` fixture’lar `sanitized-source.html` içermeli
- `sanitized_html` fixture’lar read-only olmalı (`helpers.mutable=false`)

## Release

1. `CHANGELOG.md` dosyasının en üstüne yeni sürüm bloğunu ekleyin.
2. Canlı yayın için `env.release.example` dosyasını `.env` olarak kopyalayıp credential alanlarını doldurun.
3. Dış çağrı yapmadan changelog, sürüm, git durumu ve payload kontrolü için `./release.sh --dry-run --yes` çalıştırın.
4. Gerçek yayın için `./release.sh --yes` çalıştırın.

Sürecin güvenilir kalması için:

- `npm test` artık release script smoke testini de çalıştırır.
- Script untracked dosyaları reddeder, release commit'ini dış publish adımlarından önce oluşturur, paketi tracked kaynaklar ile taze build çıktısından üretir ve oluşan zip dosyasını ilgili GitHub Release'e yükler.

## Canlı Canary Katmanı

Repo içinde ayrıca `tools/claude-web-guardian/` altında ayrı bir unpacked extension bulunur.

- Ana Claude Leaf build’inin veya PR gate’inin parçası değildir.
- Gerçek, login olunmuş Claude oturumunda selector drift ve route değişimlerini izlemek için kullanılır.
- Manual veya kendi nightly tarayıcı profilinizde çalıştırılması amaçlanır.
- Drift tespit ettiğinde yeni capture alıp fixture pipeline’ını güncellemek için sinyal üretir.

## Teknoloji Yığını

*   JavaScript (ES6+)
*   Rollup.js
*   Chrome Extension Manifest V3

## Lisans

MIT &copy; Kadir KATIRCI
