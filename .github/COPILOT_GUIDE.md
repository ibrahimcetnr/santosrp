# Santos RP - Proje ve Copilot Geliştirme Rehberi

Bu doküman, Santos RP (RAGE:MP) projesinin mimarisini, kullanılan teknolojileri ve kodlama standartlarını içerir. **GitHub Copilot bu projedeki yeni kod üretimlerinde kesinlikle buradaki kuralları baz almalıdır.**

---

## 1. Teknoloji Yığını ve Mimari (Tech Stack)
- **Platform:** RAGE:MP (Rage Multiplayer)
- **Dil:** TypeScript (Tüm stack için zorunludur)
- **Sunucu (Server-Side):** Node.js
- **İstemci (Client-Side):** RAGE:MP Client API
- **Kullanıcı Arayüzü (CEF/UI):** Svelte, Vite, HTML/CSS/TS
- **Veritabanı:** PostgreSQL (`pg` modülü)
- **Build Sistemi:** Özelleştirilmiş `scripts/build.js` ve `vite`

---

## 2. Diğer Proje Dokümanları (Zorunlu Okuma)
Eğer belirli bir sistem üzerinde çalışıyorsan, bu dosyadan önce aşağıdaki özel dokümanları bağlam (context) olarak kabul et:
- **Komut Sistemi:** `.github/COMMAND_SYSTEM_DOCUMENTATION.md` (Komut eklerken kesinlikle bu dosyayı baz al).
- **Refactor Geçmişi:** `.github/REFACTORING_SUMMARY.md` (Eski kod yapılarını tekrar önerme, güncel yapıyı kullan).
- **Karakter Yaratma UI:** `.github/CHARACTER_CREATOR_UI.md` (Karakter yaratma ekranına müdahale ediyorsan bu hiyerarşiyi oku).

---

## 3. Dizin Yapısı ve İzolasyon Kuralları (Kesin Kurallar)

Proje `src/` klasörü altında 4 ana parçaya bölünmüştür:

- 📂 **`src/server/` (Sunucu Kodları):**
  - Sadece Node.js ortamında çalışır. RAGE:MP Client API'sini KULLANMAYIN.
  - Ağır işlemler (örn: şifreleme) main thread'i bloklamamak için `src/server/workers/bcrypt.worker.ts` üzerinden yapılmalıdır.
  - Oyuncu yönetimi için RAGE:MP varsayılan döngüleri yerine `src/server/playerRegistry.ts` kullanın.
  - Ekonomi ve maaş döngüleri için `payday.ts`, hava/zaman yönetimi için `weather.ts` dosyasındaki mevcut sistemleri kullanın.

- 📂 **`src/client/` (İstemci Kodları):**
  - Sadece oyuncu tarafında çalışır. Node.js modüllerini (`fs`, `crypto`, `pg` vb.) KULLANMAYIN.
  - Oyuncu etkileşimleri ve 3D menüler için sıfırdan yapı kurmak yerine projedeki `src/client/scrollMenu.ts` modülünü kullanın.
  - Özelleştirilmiş nametag'ler (`nametags.ts`) ve minimap (`minimap.ts`) buradadır.

- 📂 **`src/shared/` (Ortak Veriler):**
  - **TypeScript Kuralı:** Projeye yeni bir veri yapısı eklendiğinde tipi mutlaka `src/shared/types.ts` içerisine eklenmelidir.
  - Ağ üzerinden veri serileştirme işlemleri için `BinarySerializer.ts` bulunur. Büyük verileri (envanter, araç listesi vb.) bu yapı ile gönderin.

- 📂 **`src/ui/` (Kullanıcı Arayüzü / Svelte):**
  - Sadece **Svelte** (`.svelte`) reaktif yapısına uygun kod üretin. Vanilla JS DOM manipülasyonu yasaktır.
  - UI state yönetimi için Svelte `store` kullanın.

---

## 4. Ağ ve Event Haberleşmesi (Client <-> Server <-> UI)

- **Server -> Client:** Güvenli event gönderimi için `src/server/utils/safeEvent.ts` veya `player.call` kullanın.
- **Client -> Server:** `mp.events.callRemote` kullanılır.
- **UI -> Client (Svelte):** Global `window.mp` objesi üzerinden `mp.trigger('eventName', data)` kullanılır.
- **Client -> UI:** İlgili CEF browser instance'ı üzerinden `browser.execute(...)` ile veri yollanır.

---

## 5. Komut Sistemi (Command Handler)

Varsayılan `mp.events.addCommand` **KULLANILMAZ**. Komutlar `src/server/cmdHandler.ts` modülü kullanılarak kaydedilir. (Detaylar için `.github/COMMAND_SYSTEM_DOCUMENTATION.md` okuyun).

**Örnek:**
```typescript
import { cmdHandler } from '../cmdHandler';
import type { Player } from '../shared/types';

cmdHandler.registerCommand('ornek', {
    description: 'Açıklama',
    adminLevel: 1, 
    args: [{ name: 'deger', type: 'string', required: true }],
    execute: (player: Player, args: { deger: string }) => {
        // İş mantığı
    }
});
6. Veritabanı ve Optimizasyon (PostgreSQL)
Parametreli Sorgular ZORUNLUDUR: Veritabanı (src/server/db.ts) işlemlerinde SQL Injection koruması için her zaman $ operatörü ile parametreli sorgular kullanın. db.query('SELECT * FROM accounts WHERE username = $1', [username]);

Cache ve Save Queue (Kritik):

Oyuncu pozisyonu, para, envanter gibi sürekli değişen verileri anında veritabanına YAZMAYIN.

Performans için src/server/cache.ts ve belirli aralıklarla toplu DB yazma işlemi yapan src/server/save-queue.ts sistemlerini kullanın.

7. Karakter Görünümü ve Kıyafetler
Karakter kıyafetleri, genetiği, makyajı veya dövmeleri ile ilgili bir işlem yaparken varsayılan RAGE:MP native fonksiyonları yerine, projede sarmalanmış olan src/server/utils/appearance.ts yapısını kullanın.

8. UI Tema ve Stil Kuralları (CSS/Svelte)
CSS Değişkenleri: Renkler, fontlar ve boyutlar için hardcoded (sabit) HEX kodları girmek yerine global CSS değişkenlerini (var(--bg-primary), var(--text-main), var(--accent-color)) kullanın.

Font ve Tipografi: Projenin belirlediği font ailesini kullanın (Örn: font-family: var(--font-primary)).

Inline Style Yasağı: HTML tagleri içine style="..." yazmayın. Stilleri Svelte dosyasının <style> bloğu içerisinde tutun.

9. Copilot Davranış ve Araç Kullanım Kuralları (CRITICAL)
DO NOT USE TERMINAL FOR FILE READING/ANALYSIS: Projeyi incelerken veya bir dosyanın içeriğine bakarken terminal komutlarını (cat, grep, ls, find vb.) KESİNLİKLE KULLANMA. Dosyaları analiz etmek için IDE'nin kendi okuma yeteneklerini ve "Workspace" bağlamını (context) kullan.

DO NOT USE TERMINAL FOR FILE EDITING: Dosya oluşturmak veya düzenlemek için terminal/bash komutlarını (cat << 'EOF' > dosya, echo, sed vb.) KESİNLİKLE KULLANMA. Bu işlem özellikle Svelte dosyalarındaki syntax'ı bozmaktadır.

USE NATIVE WORKSPACE TOOLS: Dosya okuma, arama, değişiklik yapma ve yeni dosya oluşturma işlemleri için her zaman IDE'nin yerleşik yeteneklerini (Read File, Edit File, Create File araçları) veya doğrudan standart markdown diff/code block formatını kullan.

Terminali sadece npm run build, npm install gibi scriptleri çalıştırmak için kullanabilirsin.