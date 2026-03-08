/**
 * RAGE:MP - Server Entry Point
 * SantosRP Server-Tarafı Ana Dosyası
 */
import { registerAuthEvents } from './auth';
import { initBcryptPool, destroyBcryptPool } from './bcrypt-pool';
import { startSaveQueue, stopSaveQueue, flushAll, flushCharacterSync, queueCharacterSave } from './save-queue';
import { safeEvent, isPlayerValid } from './utils/safeEvent';
import { disconnectDB } from './db';
import { initCommandSystem, getAvailableCommands } from './cmdHandler';
import { startPayday } from './payday';
import { initWeatherSystem } from './weather';
import { recoverVehicles, initVehicleManager } from './VehicleManager';

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

// Araç sistemi: önce kurtarma, sonra event listenerlar
(async () => {
    await recoverVehicles();
    initVehicleManager();
})();


safeEvent('playerDisconnect', async (player: PlayerMp, exitType: string, reason: string) => {
  if (isShuttingDown) return; // Sunucu kapanırken flushAll çalışacağı için çakışmayı önle
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

  let accId: number | undefined;
  try { accId = player.accountId; } catch {}

  // Çıkmadan hemen önce son pozisyonu kuyruğa al
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
  // player nesnesi geçersizleşmeden önce tamamlanması garanti altındadır.
  await flushCharacterSync(charId, accId);
});

// Oyun içi para/pozisyon güncellemeleri kuyruğa alınır (otomatik 30s'de bir kayıt)
// Kullanım örneği: queueCharacterSave({ characterId: 1, money: 5000, position: player.position })

// Sunucu kapatılırken tüm kuyruğu kaydet
async function gracefulShutdown(): Promise<void> {
  isShuttingDown = true;
  console.log('[SERVER] Sunucu kapatılıyor, veriler kaydediliyor...');

  // 10 saniyede flush tamamlanmazsa zorla kapat (systemd TimeoutStopSec aşımını önler)
  const forceExitTimer = setTimeout(() => {
    console.error('[SERVER] Flush zaman aşımı (10s), zorla kapatılıyor...');
    process.exit(1);
  }, 10_000);

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

export { queueCharacterSave };

// ── Sunucu Saati Yayını (her 30 saniyede bir) ─────────────────────────────────
// Oyuncuların HUD'unda sunucu saati/tarihi gösterilir; cihaz saati değil.
setInterval(() => {
  const now     = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const dateStr = now.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  mp.players.forEach((p: PlayerMp) => {
    try {
      if (isPlayerValid(p) && p.characterId) {
        p.call('client:hudTime', [timeStr, dateStr]);
        // Aktif oyuncunun pozisyonunu 30 saniyede bir güvenli şekilde kuyruğa ekle
        if (p.position) {
          queueCharacterSave({
            characterId: p.characterId,
            position: { x: p.position.x, y: p.position.y, z: p.position.z }
          });
        }
      }
    } catch {}
  });
}, 30_000);

// ── Chat & Komut Sistemi ──────────────────────────────────────────────────────
// Tüm chat (normal mesajlar + komutlar) cmdHandler.ts > initCommandSystem() içinde yönetilir.

console.log('[SERVER] SantosRP sunucusu başlatıldı!');
