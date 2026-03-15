/**
 * RAGE:MP - Server Entry Point
 * SantosRP Server-Tarafı Ana Dosyası
 */
// ─── Libuv Threadpool Genişletmesi ────────────────────────────────────────────
// Node.js varsayılanı 4 thread'dir; 1000 CCU concurrent I/O & DB yükünde bu tıkanır.
// Env'de zaten set edilmişse (systemd EnvironmentFile vb.) override etmiyoruz.
process.env.UV_THREADPOOL_SIZE = process.env.UV_THREADPOOL_SIZE || '128';
// ──────────────────────────────────────────────────────────────────────────────
import { registerAuthEvents } from './auth';
import { initBcryptPool, destroyBcryptPool } from './bcrypt-pool';
import { startSaveQueue, stopSaveQueue, flushAll, flushCharacterSync, queueCharacterSave } from './save-queue';
import { safeEvent, isPlayerValid } from './utils/safeEvent';
import { disconnectDB } from './db';
import { initCommandSystem, getAvailableCommands } from './cmdHandler';
import './inventory';
import { startPayday } from './payday';
import { initWeatherSystem } from './weather';
import { recoverVehicles, initVehicleManager, saveAllVehicles } from './VehicleManager';
import { initVehicleDataManager } from './VehicleDataManager';
import { initFactionManager } from './FactionManager';
import { onlineCharacters, playerSessions } from './playerRegistry';

import '../shared/types'; // PlayerMp augmentation

let isShuttingDown = false;

// ─── Global Hata Yakalayıcılar ────────────────────────────────────────────────
// safeEvent dışında kalan her async kod parçası için güvenlik ağı.
// 3. parti kütüphane, gelecekte eklenecek cron job vb. için kritik.
process.on('unhandledRejection', (reason: unknown) => {
  console.error('[SERVER] Yakalanmamış Promise rejection:', reason);
  // Sunucuyu çökertme — sadece logla.
});

process.on('uncaughtException', (err: Error) => {
  // uncaughtException sonrası process durumu güvenilmez — hemen kapat.
  console.error('[SERVER] Yakalanmamış exception — graceful shutdown tetikleniyor:', err);
  gracefulShutdown();
});

// ─── Memory Monitor (Her 5 Dakikada Bir) ─────────────────────────────────────
// 1000 CCU'da cache/queue Map'lerinin beklenmedik büyümesini proaktif yakalar.
setInterval(() => {
  const mem = process.memoryUsage();
  const toMB = (bytes: number) => (bytes / 1024 / 1024).toFixed(1);
  console.log(
    `[MEMORY] RSS: ${toMB(mem.rss)}MB | ` +
    `Heap: ${toMB(mem.heapUsed)}/${toMB(mem.heapTotal)}MB | ` +
    `External: ${toMB(mem.external)}MB`
  );
}, 5 * 60_000);

// ─── Manuel V8 GC Tetikleyicisi ───────────────────────────────────────────────
//
// !!! ÖNEMLİ: SUNUCU BU BAYRAK İLE BASLATILMALIDIR !!!
//   node --expose-gc --max-old-space-size=8192 dist/server/index.js
//   (package.json > "start" script'ına eklendi)
//
// --expose-gc olmadan global.gc tanımsızdır; aşağıdaki blok sessizce atlanır.
// V8 "Stop-the-world" Major GC'si normalde heap doluğunda beklenmedik anlarda
// patlar ve tüm Event Loop'u dondurur. Bu mekanizma ile GC;
//   - sunucunun en boş olduğu saatlerde (04:00-05:00) planlanır,
//   - VEYA heap kullanımı %75'i geçtiğinde hemen tetiklenir.
// Böylece major GC'nin anlamsız zamanlarda oyuncuya lag yaşatması engellenir.
(function initGCScheduler() {
  if (typeof (global as any).gc !== 'function') {
    console.warn(
      '[GC] global.gc tanımsız. Manuel GC devre dışı!\n' +
      '[GC] Sunucuyu --expose-gc ile başlatın: node --expose-gc --max-old-space-size=8192 dist/server/index.js'
    );
    return;
  }

  const gc = (global as any).gc as () => void;

  // Her 30 dakikada bir heap yüzünü kontrol et
  setInterval(() => {
    const mem  = process.memoryUsage();
    const used = mem.heapUsed;
    const total = mem.heapTotal;
    const utilization = used / total;

    // Kriter 1: heap %75+ doluysa hemen temizle
    if (utilization >= 0.75) {
      console.log(`[GC] Heap %${(utilization * 100).toFixed(0)} dolu — manuel GC tetikleniyor...`);
      gc();
      const after = process.memoryUsage();
      const freed = ((used - after.heapUsed) / 1024 / 1024).toFixed(1);
      console.log(`[GC] Tamamlandı. Kurtarılan: ~${freed}MB`);
      return;
    }

    // Kriter 2: saat 04:00-05:00 arasındaysa (sunucu en boş) temizle
    const hour = new Date().getHours();
    if (hour >= 4 && hour < 5) {
      console.log('[GC] Gece bakım penceresi (04:00-05:00) — proaktif GC tetikleniyor...');
      gc();
    }
  }, 30 * 60_000); // 30 dakika

  console.log('[GC] Manuel GC zamanılayıcısı aktif (30dk kontrol, %75 heap / saat 04:00 tetik).');
}());

// Worker Thread Pool'ları başlat
initBcryptPool();
startSaveQueue();

// Auth sistemini başlat
registerAuthEvents();

// Komut sistemini başlat
initCommandSystem();

// Payday / progression sistemini başlat
startPayday();

// Gerçek zamanlı hava & saat sistemini başlat
initWeatherSystem();

// Birlik sistemini başlat
initFactionManager();

// Araç sistemi: önce kurtarma, sonra event listenerlar
(async () => {
    await initVehicleDataManager();
    await recoverVehicles();
    initVehicleManager();
})();


safeEvent('playerDisconnect', async (player: PlayerMp, exitType: string, reason: string) => {
  // C++ pointer crash disconnect'lerinde player.name erişimi segfault'a yol açabilir.
  // try-catch ile güvenli okuma yapıyoruz.
  let playerName = 'Unknown';
  try { playerName = player.name; } catch { /* crash disconnect */ }
  console.log(`[SERVER] ${playerName} ayrıldı. Sebep: ${reason}`);

  let charId: number | undefined;
  try {
    charId = player.characterId;
  } catch {
    return; // Pointer tamamen geçersiz, kaydetme mümkün değil
  }
  if (!charId) return;

  // Global karakter map'inden çıkar (O(1) — allPlayers.find() scan yok)
  onlineCharacters.delete(charId);
  // SessionData temizle — memory leak önlemi
  playerSessions.delete(player.id);

  let accId: number | undefined;
  try { accId = player.accountId; } catch {}

  // Çıkmadan hemen önce son pozisyonu kuyruğa al (isShuttingDown olsa bile kuyruğa girilmeli)
  try {
    if (isPlayerValid(player) && player.position) {
      queueCharacterSave({
        characterId: charId,
        position: { x: player.position.x, y: player.position.y, z: player.position.z }
      });
    }
  } catch {
    // Oyuncu koptuğu için pozisyon okunamayabilir, bu normaldir.
  }

  // flushCharacterSync: veriyi debounce bekletmeden anında DB'ye yazar.
  // Sunucu kapanıyorsa flushAll zaten tüm kuyruğu yazacak — çakışmayı önle.
  if (isShuttingDown) return;
  await flushCharacterSync(charId, accId);
});

// Oyun içi para/pozisyon güncellemeleri kuyruğa alınır (otomatik 30s'de bir kayıt)
// Kullanım örneği: queueCharacterSave({ characterId: 1, money: 5000, position: player.position })

// Sunucu kapatılırken tüm kuyruğu kaydet
async function gracefulShutdown(): Promise<void> {
  isShuttingDown = true;
  console.log('[SERVER] Sunucu kapatılıyor, veriler kaydediliyor...');

  // 45 saniyede flush tamamlanmazsa zorla kapat — 1000 oyuncu/araç için yeterli süre
  const forceExitTimer = setTimeout(() => {
    console.error('[SERVER] Flush zaman aşımı (45s), zorla kapatılıyor...');
    process.exit(1);
  }, 45_000);

  try {
    await saveAllVehicles();
  } catch (err) {
    console.error('[SERVER] Araç kaydetme hatası:', err);
  }

  try {
    await flushAll();
  } catch (err) {
    console.error('[SERVER] Flush hatası:', err);
  }

  clearTimeout(forceExitTimer);
  stopSaveQueue();
  destroyBcryptPool();
  await disconnectDB();
  process.exit(0);
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT',  gracefulShutdown);

export { queueCharacterSave, onlineCharacters, playerSessions };

// ── Karakter Pozisyon Kaydı (her 30 saniyede bir) ─────────────────────────────────────
// Saat yayını kaldırıldı: HUD.svelte timeOffset ile loşal hesapladığından sunucu paketi geréksizdir.
setInterval(() => {
  mp.players.forEach((p: PlayerMp) => {
    if (isPlayerValid(p) && p.characterId && p.position) {
      queueCharacterSave({
        characterId: p.characterId,
        position: { x: p.position.x, y: p.position.y, z: p.position.z }
      });
    }
  });
}, 30_000);

// ── Chat & Komut Sistemi ──────────────────────────────────────────────────────
// Tüm chat (normal mesajlar + komutlar) cmdHandler.ts > initCommandSystem() içinde yönetilir.

console.log('[SERVER] SantosRP sunucusu başlatıldı!');
