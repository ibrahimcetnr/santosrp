# Santos RP - Ağ ve İletişim Protokolleri (Safe Events)

Bu doküman, Santos RP sunucusunda istemci (Client), sunucu (Server) ve Arayüz (UI/CEF) arasındaki iletişim standartlarını tanımlar.

## 1. Sunucu Tarafında Asenkron Event Yönetimi (safeEvent)
- RAGE:MP doğası gereği `async/await` fonksiyonlarında fırlatılan bir hata (`throw new Error` veya `Promise.reject()`) main thread'i işlemez hale getirip sunucunun tamamen çökmesine (`crash`) yol açabilir.
- **KURAL:** Sunucu tarafında `mp.events.add` ALTYAPISI **DOĞRUDAN KULLANILMAMALIDIR**.
- Yerine her zaman `src/server/utils/safeEvent.ts` içindeki `safeEvent` kullanılmalıdır. Bu yapı otomatik olarak try/catch bloğu sağlar ve kopan oyuncuların (disconnect atan) DB hatalarından sunucuyu korur.
- Ayrıca `isPlayerValid(player)` kullanılarak oyuncunun sunucuda hala olup olmadığı sorgulanmalıdır.

**Doğru Kullanım:**
```typescript
import { safeEvent, isPlayerValid } from './utils/safeEvent';

safeEvent('server:myEvent', async (player: PlayerMp, data: string) => {
    if (!isPlayerValid(player)) return; // Oyuncu düşmüşse işlemi iptal et
    // ... İşlemler
});
```

## 2. İstemci (Client) <-> Sunucu (Server) İletişimi
- İstemciden sunucuya özel event (`custom event`) gönderilirken `mp.events.callRemote('eventName', args)` kullanılır.
- Sunucudan istemciye gönderilirken `player.call('eventName', [args])` kullanılır. (Not: objeler array içinde aktarılmalıdır)

## 3. UI (Svelte) <-> İstemci (Client) İletişimi
- **Veri Yollama (Client -> UI):** `import { getGameBrowser } from './auth';` üzerinden `browser.execute("window.functionName(data)")` kullanılır.
- **Tetikleme (UI -> Client):** `(window as any).mp.trigger('eventName', args)` metodu kullanılır. Arayüzün web modunda çökmemsi için mutlaka `if (typeof window.mp !== 'undefined')` kontrolü olmalıdır.

## 4. Paylaşılan Veri Tipleri (Shared Types)
- Client, Server ya da UI tarafında ortak olarak anlam kazanacak her obje (Karakter, Araç, Envanter) **SADECE** `src/shared/types.ts` klasöründe tanımlanmalıdır. Yerel tipler projeyi parçalar.
