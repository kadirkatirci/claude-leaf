# Chat Test İş Akışı

Bu repo için ana test yüzeyi yalnız `claude.ai/chat/...` sayfalarıdır.

Test katmanı iki parçalıdır:

- Canlı smoke ve canlı capture: gerçek Google Chrome `Test` profili, gerçek Claude chat'leri, read-only kontroller
- Fixture E2E: commitlenen sanitize edilmiş chat fixture'ları, deterministik Playwright assertion'ları ve görsel baseline'lar

## Dizin Rolleri

```text
.auth/live-chat-targets.json              # local, gerçek short/medium/long chat URL'leri
scripts/fixtures/chat-fixtures.json       # tracked chat fixture manifest'i ve eşikleri
scripts/fixtures/lib/chatFixtureConfig.js # tracked manifest + local live URL çözümleme
test/fixtures-source/claude/              # ignore edilen ham canlı capture'lar
test/fixtures/claude/chat-real-*/         # commitlenen sanitize chat fixture'ları
test/e2e/support/chatFixtures.js          # spec'ler için kanonik fixture id ve surface eşlemesi
test/e2e/*.spec.js                        # deterministik browser coverage
test/e2e-live/live-smoke.spec.js          # read-only canlı Claude smoke
```

## Varsayılan Operatör Akışı

Gerçek Claude DOM'unun lokal fixture suite ile hâlâ uyumlu olduğundan emin olmak için:

1. Google Chrome'u tamamen kapatın.
2. Klon canlı profili yenileyin:

   ```bash
   npm run live:refresh-profile
   ```

3. Short, medium ve long chat hedeflerinde canlı smoke çalıştırın:

   ```bash
   npm run test:e2e:live
   ```

4. Claude Leaf `Test` profilinde kuruluysa tek-chat derin smoke çalıştırın:

   ```bash
   npm run test:e2e:live:deep
   ```

5. Canlı smoke temizse deterministik lokal gate'leri çalıştırın:

   ```bash
   npm test
   npm run test:e2e
   ```

6. Canlı smoke drift bildirirse fixture'ları yenileyin:

   ```bash
   npm run fixtures:capture -- --target short
   npm run fixtures:capture -- --target medium
   npm run fixtures:capture -- --target long
   npm run fixtures:sanitize
   npm run fixtures:refresh
   npm run test:e2e
   ```

## Hangi Fixture Ne İçin Kullanılır

Yeni spec'lerde fixture id'lerini hardcode etmek yerine `test/e2e/support/chatFixtures.js` kullanın.

- `REAL_CHAT_FIXTURES.short`
  - en kısa doğal chat yüzeyi
  - temel navigation, bookmark, popup sync ve kompakt görsel kontroller için
- `REAL_CHAT_FIXTURES.medium`
  - doğal edit-history ve marker yüzeyi
  - modal, badge ve orta yoğunluklu UX kontrolleri için
- `REAL_CHAT_FIXTURES.long`
  - yoğun scroll stres yüzeyi
  - counter, panel scroll, anchoring ve uzun thread stabilitesi için
- `SYNTHETIC_CHAT_FIXTURES.streaming`
  - kontrollü mutable streaming state
- `SYNTHETIC_CHAT_FIXTURES.editedThread`
  - kontrollü inline edit-form save/cancel state

Kural:

- Gerçek yerleşim, selector drift veya doğal chat UX'i test ediyorsanız gerçek fixture kullanın.
- Gerçek chat üzerinde güvenli biçimde kurulamayan deterministik mutation gerekiyorsa sentetik fixture kullanın.

## Yeni E2E Spec Nasıl Eklenir

1. `CHAT_TEST_SURFACES` içinden doğru yüzeyi seçin.
2. `openFixture(...)` ile fixture'ı açın.
3. Modül davranışını assert edin.
4. Testi `assertNoPageErrors(...)` ile bitirin.

Minimal örnek:

```js
import { openFixture, test, expect, assertNoPageErrors } from './support/extensionTest.js';
import { CHAT_TEST_SURFACES } from './support/chatFixtures.js';

test('example module behavior', async ({ fixturePage, harnessPage }) => {
  await openFixture(fixturePage, harnessPage, CHAT_TEST_SURFACES.bookmarks.base);

  await expect(fixturePage.locator('#claude-bookmarks-fixed-btn')).toBeVisible();

  assertNoPageErrors(fixturePage, ['ResizeObserver loop limit exceeded']);
});
```

## Yeni Gerçek Chat Fixture Nasıl Eklenir

Bunu yalnız short/medium/long artık yetmiyorsa yapın.

1. `scripts/fixtures/chat-fixtures.json` içine yeni tracked target ekleyin.
2. `.auth/live-chat-targets.json` içine karşılık gelen local canlı URL'yi ekleyin.
3. `fixtures:capture -- --target <name>` ile capture alın.
4. Fixture'ı sanitize edip refresh edin.
5. Yeni fixture id'yi `test/e2e/support/chatFixtures.js` içine ekleyin.
6. Yeni yüzey ortak matrise giriyorsa `test/chat-test-surfaces.test.js` dosyasını da genişletin.

Ham chat id'leri veya ham canlı konuşma metnini commit etmeyin.

## Live Smoke ile Fixture E2E Ayrımı

Canlı smoke şu sorulara cevap verir:

- Claude bu chat'leri login/challenge olmadan hâlâ açıyor mu?
- temel message/edit sayıları beklenen aralıkta mı?
- fixture yenilemek gerekecek kadar DOM drift oldu mu?
- `Test` profilinde Claude Leaf kuruluysa temel canlı modül yüzeyleri attach oluyor mu?

Canlı deep smoke şu sorulara cevap verir:

- tek bir gerçek long chat üzerinde çekirdek modüller birlikte doğru davranıyor mu?
- bookmark ve marker ekleme/navigasyon akışları hâlâ güvenli biçimde çalışıyor mu?
- edit-history overlay'leri doğru açılıyor mu?
- popup save sonrası navigation görünürlüğü canlı taba geri yansıyor mu?

Fixture E2E şu sorulara cevap verir:

- modüller doğru yerlere attach oluyor mu?
- counter, panel, badge, shortcut ve modal davranışları doğru mu?
- görsel hizalama deterministik snapshot'larda bozuldu mu?

Canlı smoke read-only kalsın. Derin davranış kapsamı fixture E2E'de olsun.

## Canlı Modül Smoke İçin Tek Seferlik Kurulum

Resmi Google Chrome 137+ build'lerinde `--load-extension` ile unpacked
extension yükleme artık çalışmıyor. Bu yüzden:

- `npm run test:e2e:live` yalnız route sağlığı ve capture hazırlığını garanti eder
- `npm run test:e2e:live:modules` için Claude Leaf'in Chrome `Test`
  profilinde zaten kurulu olması gerekir
- `npm run test:e2e:live:deep` aynı tek seferlik kurulum üstünde, canlı `long`
  chat için daha derin ama güvenli bir etkileşim smoke'u çalıştırır

Tek seferlik kurulum:

1. Google Chrome'u `Test` profili ile açın.
2. `chrome://extensions` adresine gidin.
3. Geliştirici modunu açın.
4. `Paketlenmemiş öğe yükle` ile bu repo kökünü seçin.
5. Chrome'u tamamen kapatın.
