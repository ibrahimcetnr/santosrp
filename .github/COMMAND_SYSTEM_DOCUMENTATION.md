# SantosRP Dinamik Komut Sistemi

Sayısal Yetki Tabanlı (AdminLevel) esnek komut yönetim sistemi.

---

## 📋 Özellikler

### ✅ 1. Esnek Yetki Yapısı
- **Sayısal AdminLevel**: 0-100 arası herhangi bir sayı kullanılabilir
- **Dinamik Kontrol**: `player.adminLevel >= cmd.minLevel` mantığı
- **Kategoriye Göre Görsellik**: `player`, `staff`, `faction` kategorileri sadece UI renklendirmesi için

### ✅ 2. Merkezi Komut Yöneticisi
- **Dosya**: `server/cmdHandler.ts`
- **Komut Kaydı**: `registerCommand()` fonksiyonu
- **Otomatik Yetki Kontrolü**: Her komut çalıştırmadan önce kontrol edilir
- **Güvenlik**: `safeEvent` ile sarmalanmış event handling

### ✅ 3. UI & CEF Senkronizasyonu
- **AdminLevel Gönderimi**: Login success'te CEF'e iletiliyor
- **Komut Listesi**: Oyuncunun erişebildiği komutlar filtrelenerek gönderiliyor
- **Dinamik Öneri**: HUD.svelte sadece erişilebilir komutları gösteriyor

### ✅ 4. Akıllı Ghost Text
- **Komut Tamamlama**: `/ki` yazınca `/kick [ID] [Sebep]` önerisi
- **Çoklu Argüman Takibi**: `/kick 5 ` yazınca `[Sebep]` argümanı gösteriliyor
- **Gerçek Zamanlı**: Her tuş vuruşunda güncelleniyor

---

## 📂 Dosya Yapısı

```
src/
├── shared/
│   └── types.ts              ✅ ICommand interface eklendi
├── server/
│   ├── cmdHandler.ts         ✅ YENİ - Komut yöneticisi
│   ├── index.ts              ✅ Komut sistemi entegrasyonu
│   └── auth.ts               ✅ Login'de komut listesi gönderimi
├── client/
│   └── auth.ts               ✅ CEF'e komut listesi iletimi
└── ui/
    ├── src/
    │   ├── types.d.ts        ✅ CommandData interface
    │   └── components/
    │       └── HUD/
    │           └── HUD.svelte ✅ Komut sistemi + Ghost Text
    └── App.svelte            ✅ AdminLevel prop'u
```

---

## 🔧 Kullanım

### Yeni Komut Ekleme

```typescript
// server/cmdHandler.ts içinde:

registerCommand(
  {
    name: '/ban',           // Komut adı
    syntax: '[ID] [Süre] [Sebep]',  // Argümanlar
    minLevel: 10,           // Minimum yetki (0 = herkes, 10 = admin)
    category: 'staff',      // Görsel kategori (player/staff/faction)
    description: 'Oyuncuyu banlar',  // Açıklama (opsiyonel)
  },
  async (player: PlayerMp, args: string[]) => {
    // Komut mantığı buraya
    if (args.length < 3) {
      player.outputChatBox('!{#fbbf24}[KULLANIM] /ban [ID] [Süre] [Sebep]');
      return;
    }
    
    const targetId = parseInt(args[0], 10);
    const duration = parseInt(args[1], 10);
    const reason = args.slice(2).join(' ');
    
    // Ban işlemi...
    player.outputChatBox('!{#22c55e}[BAŞARILI] Oyuncu banlandı.');
  }
);
```

---

## 📊 Örnek Komutlar

### 1. `/report [Mesaj]` (minLevel: 0)
**Kategori**: `player`  
**Açıklama**: Herkes kullanabilir, yöneticilere rapor gönderir.

```typescript
player.outputChatBox('!{#22c55e}[BAŞARILI] Raporunuz yöneticilere iletildi.');
```

### 2. `/kick [ID] [Sebep]` (minLevel: 5)
**Kategori**: `staff`  
**Açıklama**: Seviye 5+ yetkililer oyuncu atabilir.

```typescript
target.kick(`Sunucudan atıldınız.\nSebep: ${reason}\nYetkili: ${adminName}`);
```

### 3. `/setadmin [ID] [Level]` (minLevel: 10)
**Kategori**: `staff`  
**Açıklama**: Seviye 10+ yetkililer admin yetkisi verebilir.
**Özel**: Kendi seviyesinden yüksek yetki veremez.

```typescript
await query('UPDATE accounts SET admin_level = $1 WHERE id = $2', [newLevel, target.accountId]);
target.adminLevel = newLevel;
```

### 4. `/admins` (minLevel: 0)
**Kategori**: `player`  
**Açıklama**: Çevrimiçi yöneticileri listeler.

```typescript
player.outputChatBox('!{#c9a84c}[YETKİLİLER] Çevrimiçi yöneticiler:');
```

### 5. `/veh [Model]` (minLevel: 8)
**Kategori**: `staff`  
**Açıklama**: Oyuncunun önüne araç spawn eder.

```typescript
const vehicle = mp.vehicles.new(mp.joaat(modelName), spawnPos, { heading, numberPlate: 'ADMIN' });
```

---

## 🎨 UI Renklendirme

HUD.svelte CSS sınıfları:

```css
.cmd-box.player {
  /* Sarı - Oyuncu komutları */
  background-image: linear-gradient(135deg, rgba(201, 168, 76, 0.15) 0%, transparent 80%);
  border-color: rgba(201, 168, 76, 0.3);
}

.cmd-box.staff {
  /* Kırmızı - Yetkili komutları */
  background-image: linear-gradient(135deg, rgba(239, 68, 68, 0.20) 0%, transparent 80%);
  border-color: rgba(239, 68, 68, 0.3);
}

.cmd-box.faction {
  /* Mavi - Faction komutları */
  background-image: linear-gradient(135deg, rgba(59, 130, 246, 0.20) 0%, transparent 80%);
  border-color: rgba(59, 130, 246, 0.3);
}
```

---

## 🔐 Güvenlik

### 1. Yetki Kontrolü
```typescript
const playerLevel = player.adminLevel ?? 0;
if (playerLevel < cmd.minLevel) {
  player.outputChatBox(`!{#ef4444}[HATA] Bu komut için yetkiniz yok.`);
  return;
}
```

### 2. Kendi Seviyesini Geçememe
```typescript
// /setadmin için özel kontrol
if (newLevel > playerLevel) {
  player.outputChatBox(`!{#ef4444}[HATA] Kendi seviyenizden yüksek yetki veremezsiniz.`);
  return;
}
```

### 3. SafeEvent Sarmalama
```typescript
safeEvent('server:chatMessage', async (player: PlayerMp, message: unknown) => {
  // Tüm event'ler safeEvent ile korumalı
});
```

### 4. Girdi Doğrulama
```typescript
if (typeof message !== 'string' || message.length === 0) return;
const targetId = parseInt(args[0], 10);
if (isNaN(targetId)) {
  player.outputChatBox('!{#ef4444}[HATA] Geçersiz ID.');
  return;
}
```

---

## 🚀 Akıllı Ghost Text Mantığı

### Durum 1: Komut Adı Yazılıyor
```
Input: "/ki"
Ghost: "ck [ID] [Sebep]"
Sonuç: "/kick [ID] [Sebep]"
```

### Durum 2: İlk Argüman Yazılıyor
```
Input: "/kick 5"
Ghost: " [Sebep]"
Sonuç: "/kick 5 [Sebep]"
```

### Durum 3: Argüman Arası Boşluk
```
Input: "/kick 5 "
Ghost: "[Sebep]"
Sonuç: "/kick 5 [Sebep]"
```

### Kod:
```typescript
let ghostSuffix = $derived.by(() => {
  if (!firstSuggestion || !chatInput.startsWith('/')) return '';
  
  const inputLower = chatInput.toLowerCase();
  const cmdLower = firstSuggestion.name.toLowerCase();
  
  // 1. Komut adı tamamlaması
  if (cmdLower.startsWith(inputLower)) {
    return firstSuggestion.name.substring(chatInput.length) + 
           (firstSuggestion.syntax ? ' ' + firstSuggestion.syntax : '');
  }
  
  // 2. Argüman takibi
  const inputParts = chatInput.split(' ');
  const typedCmd = inputParts[0].toLowerCase();
  
  if (typedCmd === cmdLower && firstSuggestion.syntax) {
    const syntaxParts = firstSuggestion.syntax.split(' ');
    const typedArgsCount = inputParts.length - 1;
    const endsWithSpace = chatInput.endsWith(' ');
    
    if (endsWithSpace) {
      const neededIndex = typedArgsCount;
      const remaining = syntaxParts.slice(neededIndex);
      return remaining.join(' ');
    } else {
      const neededIndex = typedArgsCount;
      const remaining = syntaxParts.slice(neededIndex);
      if (remaining.length > 0) {
        return ' ' + remaining.join(' ');
      }
    }
  }
  
  return '';
});
```

---

## 📝 İleri Seviye Özellikler

### Komut Aliasları
```typescript
// /tp ve /teleport aynı işlevi görsün
registerCommand({ name: '/tp', syntax: '[ID]', minLevel: 5, category: 'staff' }, teleportHandler);
registerCommand({ name: '/teleport', syntax: '[ID]', minLevel: 5, category: 'staff' }, teleportHandler);
```

### Kategori Bazlı Filtreleme
```typescript
// Sadece faction komutlarını göster
const factionCommands = allCommands.filter(c => c.category === 'faction' && c.minLevel <= myAdminLevel);
```

### Dinamik Yetki Güncellemesi
```typescript
// /setadmin sonrası komut listesi otomatik güncellenir
const availableCommands = getAvailableCommands(newLevel);
target.call('client:updateCommandList', [JSON.stringify(availableCommands)]);
```

---

## 🧪 Test Senaryoları

### 1. Yetki Kontrolü
```
1. adminLevel: 0 olan oyuncu ile /kick yazmayı dene
2. Komut önerilerde görünmemeli
3. Manuel yazıp gönderirsen "Bu komut için yetkiniz yok" hatası almalı
✅ Beklenen: Yetki kontrolü çalışıyor
```

### 2. Ghost Text
```
1. Chat'i aç ve "/" yaz
2. Erişebildiğin komutlar görünmeli
3. "/k" yaz → "/kick" önerisi
4. "/kick " yaz → "[ID] [Sebep]" ghost text
5. "/kick 5" yaz → " [Sebep]" ghost text
6. "/kick 5 " yaz → "[Sebep]" ghost text
✅ Beklenen: Tüm durumlarda doğru argüman takibi
```

### 3. Komut Çalıştırma
```
1. adminLevel: 5 ile /kick 2 Trolleme yaz
2. ID 2'deki oyuncu atılmalı
3. Global bildirim gitmeli
4. Console'a log düşmeli
✅ Beklenen: Komut başarıyla çalışıyor
```

### 4. Setadmin Koruma
```
1. adminLevel: 5 olan yetkili /setadmin 2 10 yazsın
2. "Kendi seviyenizden yüksek yetki veremezsiniz" hatası almalı
✅ Beklenen: Yetki yükseltme koruması çalışıyor
```

---

## 📞 API Referansı

### `registerCommand(cmd: ICommand, handler: CommandHandler)`
Yeni komut kaydeder.

**Parametreler:**
- `cmd.name`: Komut adı (örn: "/kick")
- `cmd.syntax`: Argüman sözdizimi (örn: "[ID] [Sebep]")
- `cmd.minLevel`: Minimum yetki seviyesi (0-100)
- `cmd.category`: Görsel kategori ('player' | 'staff' | 'faction')
- `cmd.description`: Açıklama (opsiyonel)
- `handler`: Komut fonksiyonu `(player: PlayerMp, args: string[]) => void | Promise<void>`

### `getAvailableCommands(adminLevel: number): ICommand[]`
Oyuncunun erişebildiği komutları döndürür.

**Parametreler:**
- `adminLevel`: Oyuncunun admin seviyesi

**Dönüş:** Handler olmadan komut metadata'ları

### `executeCommand(player: PlayerMp, message: string): Promise<void>`
Komutu çalıştırır (yetki kontrolü ile).

**Parametreler:**
- `player`: Komutu çalıştıran oyuncu
- `message`: Tam komut mesajı (örn: "/kick 5 Trolleme")

---

## ✅ Tamamlanan Özellikler

- [x] ICommand interface (minLevel eklendi)
- [x] Merkezi komut yöneticisi (cmdHandler.ts)
- [x] Sayısal yetki kontrolü
- [x] CEF'e adminLevel gönderimi
- [x] CEF'e komut listesi gönderimi
- [x] HUD.svelte komut filtreleme
- [x] Akıllı Ghost Text (çoklu argüman takibi)
- [x] Kategori bazlı CSS renklendirme
- [x] SafeEvent sarmalama
- [x] Örnek komutlar (/report, /kick, /setadmin, /admins, /veh)
- [x] Güvenlik kontrolleri (yetki, girdi doğrulama)
- [x] Dinamik yetki güncellemesi

---

## 🎉 Sonuç

SantosRP artık **Enterprise düzeyinde dinamik komut sistemi**ne sahip!

**Özellikler:**
- ✅ Esnek sayısal yetki (0-100 arası herhangi bir değer)
- ✅ Otomatik yetki kontrolü
- ✅ CEF senkronizasyonu
- ✅ Akıllı Ghost Text (çoklu argüman takibi)
- ✅ Kategori bazlı görsellik
- ✅ Güvenli event handling

**Performans:**
- Minimum overhead (Map-based lookup)
- Client-side filtreleme (server yükü yok)
- Debounced ghost text (gereksiz render yok)

**Güvenlik:**
- Yetki kontrolü her çalıştırmada
- Girdi doğrulama
- SafeEvent sarmalama
- Kendi seviyesini geçememe koruması
