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
npm run live:refresh-profile
npm run test:e2e:live
npm run test:e2e:live:modules
```

Mevcut build içinde aktif modüller: Mesaj Navigasyonu, Yer İmleri, Emoji İşaretleyiciler ve Düzenleme Geçmişi.

## Fixture Tabanlı E2E Testleri

Playwright suite’i gerçek unpacked extension’ı, deterministik `claude.ai` fixture’ları üzerinde çalıştırır.

- `seed` fixture’lar etkileşimli test host’larıdır.
- `sanitized_html` fixture’lar canlı Claude sayfalarından üretilmiş, read-only DOM drift fixture’larıdır.
- Browser harness canlı ağı varsayılan olarak kapatır; yalnız commitlenmiş fixture asset’leri `https://claude.ai/...` üzerinden servis edilir.
- Görsel snapshot’lar için local IBM Plex font dosyaları repoda tutulur.

Tam chat-only operatör ve geliştirici akışı için [docs/CHAT_TEST_WORKFLOW.tr.md](docs/CHAT_TEST_WORKFLOW.tr.md) dosyasına bakın.

Commitlenen ana fixture seti artık yalnız chat odaklıdır:

- `short` → `chat-real-short`
- `medium` → `chat-real-medium`
- `long` → `chat-real-long`

Canlı fixture yenileme akışı:

1. Gerçek short / medium / long chat kaynaklarını ignore edilen source klasörüne yakalayın:

   ```bash
   npm run fixtures:capture -- --target short
   npm run fixtures:capture -- --target medium
   npm run fixtures:capture -- --target long
   ```

2. Capture’ları commitlenen chat fixture’larına sanitize edin:

   ```bash
   npm run fixtures:sanitize
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
- commitlenen chat fixture’ları redakte edilerek yazılır; gerçek konuşma metni ve chat id’leri repoya girmez

## Canlı Smoke ve Capture

Gerçek, login olunmuş Claude oturumu üzerinde lokal kontroller için kaynak profil olarak Google Chrome `Test` profili kullanılır.

- Her canlı komuttan önce Google Chrome tamamen kapalı olmalı.
- Otomasyon günlük profilinize doğrudan bağlanmaz; önce profil `.auth/chrome-test-live` altına klonlanır.
- Canlı smoke akışı read-only’dir; `.auth/live-chat-targets.json` içindeki short / medium / long chat hedeflerini açar, message/edit kontratlarını doğrular, screenshot alır ve `.auth/live-artifacts/...` altında JSON raporu yazar.
- `npm run test:e2e:live` her zaman route sağlığını doğrular. `npm run test:e2e:live:modules` ise ek olarak Claude Leaf UI yüzeylerini doğrular; bunun için eklentinin `Test` profilinde bir kez manuel yüklenmiş olması gerekir.
- `fixtures:capture` da aynı klonlanmış canlı profil akışını kullanır.

Önce private target dosyasını hazırlayın:

```bash
cp scripts/fixtures/live-chat-targets.example.json .auth/live-chat-targets.json
```

Ardından `.auth/live-chat-targets.json` içindeki placeholder URL’leri kendi gerçek Claude short / medium / long chat URL’lerinizle değiştirin. Bu dosya git’e gitmez.

Profil klonunu tek başına yenilemek için:

```bash
npm run live:refresh-profile
```

Canlı smoke suite’ini çalıştırmak için:

```bash
npm run test:e2e:live
```

Gerçek Chrome içinde modüllerin attach olduğunu da doğrulamak istiyorsanız, repoyu `Test` profiline bir kez manuel yükleyin:

1. Google Chrome’u `Test` profili ile açın.
2. `chrome://extensions` adresine gidin.
3. Geliştirici modunu açın.
4. `Paketlenmemiş öğe yükle` ile bu repo kökünü seçin.
5. Chrome’u tamamen kapatın.

Ardından şu komutu çalıştırın:

```bash
npm run test:e2e:live:modules
```

Bu ek kurulum gerekir; çünkü Chrome 137+ resmi Google Chrome build’leri otomasyonda `--load-extension` bayrağını artık dikkate almıyor. Route smoke ve capture ise bu kurulum olmadan da çalışır.

Canlı fixture yenileme akışı artık şu sırayı izler:

1. `Test` Chrome profilinde `claude.ai` oturumunu açın ve Chrome’u tamamen kapatın.
2. Gerekirse `npm run live:refresh-profile` ile klon profilin hazır olduğunu doğrulayın.
3. Capture alın:

   ```bash
   npm run fixtures:capture -- --target short
   npm run fixtures:capture -- --target medium
   npm run fixtures:capture -- --target long
   ```

4. Capture’ı sanitize edin:

   ```bash
   npm run fixtures:sanitize
   ```

5. Fixture giriş sayfalarını tekrar üretin:

   ```bash
   npm run fixtures:refresh
   ```

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

Önerilen iş akışı:

1. `npm run test:e2e` ile fixture tabanlı hızlı gate’i koruyun.
2. `npm run test:e2e:live` ile klonlanmış `Test` profili üzerinde read-only canlı smoke çalıştırın.
3. `Claude Web Guardian` ile daha uzun süreli canlı drift takibi yapın.
4. Drift sinyali gelirse short / medium / long chat capture’larını yenileyip sanitize ettikten sonra tekrar `npm run test:e2e` çalıştırın.

## Teknoloji Yığını

*   JavaScript (ES6+)
*   Rollup.js
*   Chrome Extension Manifest V3

## Lisans

MIT &copy; Kadir KATIRCI
