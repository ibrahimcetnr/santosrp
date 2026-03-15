"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.playerSessions = exports.onlineCharacters = exports.queueCharacterSave = void 0;
/**
 * RAGE:MP - Server Entry Point
 * SantosRP Server-Tarafı Ana Dosyası
 */
// ─── Libuv Threadpool Genişletmesi ────────────────────────────────────────────
// Node.js varsayılanı 4 thread'dir; 1000 CCU concurrent I/O & DB yükünde bu tıkanır.
// Env'de zaten set edilmişse (systemd EnvironmentFile vb.) override etmiyoruz.
process.env.UV_THREADPOOL_SIZE = process.env.UV_THREADPOOL_SIZE || '128';
// ──────────────────────────────────────────────────────────────────────────────
const auth_1 = require("./auth");
const bcrypt_pool_1 = require("./bcrypt-pool");
const save_queue_1 = require("./save-queue");
Object.defineProperty(exports, "queueCharacterSave", { enumerable: true, get: function () { return save_queue_1.queueCharacterSave; } });
const safeEvent_1 = require("./utils/safeEvent");
const db_1 = require("./db");
const cmdHandler_1 = require("./cmdHandler");
require("./inventory");
const payday_1 = require("./payday");
const weather_1 = require("./weather");
const VehicleManager_1 = require("./VehicleManager");
const VehicleDataManager_1 = require("./VehicleDataManager");
const FactionManager_1 = require("./FactionManager");
const playerRegistry_1 = require("./playerRegistry");
Object.defineProperty(exports, "onlineCharacters", { enumerable: true, get: function () { return playerRegistry_1.onlineCharacters; } });
Object.defineProperty(exports, "playerSessions", { enumerable: true, get: function () { return playerRegistry_1.playerSessions; } });
require("../shared/types"); // PlayerMp augmentation
let isShuttingDown = false;
// ─── Global Hata Yakalayıcılar ────────────────────────────────────────────────
// safeEvent dışında kalan her async kod parçası için güvenlik ağı.
// 3. parti kütüphane, gelecekte eklenecek cron job vb. için kritik.
process.on('unhandledRejection', (reason) => {
    console.error('[SERVER] Yakalanmamış Promise rejection:', reason);
    // Sunucuyu çökertme — sadece logla.
});
process.on('uncaughtException', (err) => {
    // uncaughtException sonrası process durumu güvenilmez — hemen kapat.
    console.error('[SERVER] Yakalanmamış exception — graceful shutdown tetikleniyor:', err);
    gracefulShutdown();
});
// ─── Memory Monitor (Her 5 Dakikada Bir) ─────────────────────────────────────
// 1000 CCU'da cache/queue Map'lerinin beklenmedik büyümesini proaktif yakalar.
setInterval(() => {
    const mem = process.memoryUsage();
    const toMB = (bytes) => (bytes / 1024 / 1024).toFixed(1);
    console.log(`[MEMORY] RSS: ${toMB(mem.rss)}MB | ` +
        `Heap: ${toMB(mem.heapUsed)}/${toMB(mem.heapTotal)}MB | ` +
        `External: ${toMB(mem.external)}MB`);
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
    if (typeof global.gc !== 'function') {
        console.warn('[GC] global.gc tanımsız. Manuel GC devre dışı!\n' +
            '[GC] Sunucuyu --expose-gc ile başlatın: node --expose-gc --max-old-space-size=8192 dist/server/index.js');
        return;
    }
    const gc = global.gc;
    // Her 30 dakikada bir heap yüzünü kontrol et
    setInterval(() => {
        const mem = process.memoryUsage();
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
(0, bcrypt_pool_1.initBcryptPool)();
(0, save_queue_1.startSaveQueue)();
// Auth sistemini başlat
(0, auth_1.registerAuthEvents)();
// Komut sistemini başlat
(0, cmdHandler_1.initCommandSystem)();
// Payday / progression sistemini başlat
(0, payday_1.startPayday)();
// Gerçek zamanlı hava & saat sistemini başlat
(0, weather_1.initWeatherSystem)();
// Birlik sistemini başlat
(0, FactionManager_1.initFactionManager)();
// Araç sistemi: önce kurtarma, sonra event listenerlar
(async () => {
    await (0, VehicleDataManager_1.initVehicleDataManager)();
    await (0, VehicleManager_1.recoverVehicles)();
    (0, VehicleManager_1.initVehicleManager)();
})();
(0, safeEvent_1.safeEvent)('playerDisconnect', async (player, exitType, reason) => {
    // C++ pointer crash disconnect'lerinde player.name erişimi segfault'a yol açabilir.
    // try-catch ile güvenli okuma yapıyoruz.
    let playerName = 'Unknown';
    try {
        playerName = player.name;
    }
    catch { /* crash disconnect */ }
    console.log(`[SERVER] ${playerName} ayrıldı. Sebep: ${reason}`);
    let charId;
    try {
        charId = player.characterId;
    }
    catch {
        return; // Pointer tamamen geçersiz, kaydetme mümkün değil
    }
    if (!charId)
        return;
    // Global karakter map'inden çıkar (O(1) — allPlayers.find() scan yok)
    playerRegistry_1.onlineCharacters.delete(charId);
    // SessionData temizle — memory leak önlemi
    playerRegistry_1.playerSessions.delete(player.id);
    let accId;
    try {
        accId = player.accountId;
    }
    catch { }
    // Çıkmadan hemen önce son pozisyonu kuyruğa al (isShuttingDown olsa bile kuyruğa girilmeli)
    try {
        if ((0, safeEvent_1.isPlayerValid)(player) && player.position) {
            (0, save_queue_1.queueCharacterSave)({
                characterId: charId,
                position: { x: player.position.x, y: player.position.y, z: player.position.z }
            });
        }
    }
    catch {
        // Oyuncu koptuğu için pozisyon okunamayabilir, bu normaldir.
    }
    // flushCharacterSync: veriyi debounce bekletmeden anında DB'ye yazar.
    // Sunucu kapanıyorsa flushAll zaten tüm kuyruğu yazacak — çakışmayı önle.
    if (isShuttingDown)
        return;
    await (0, save_queue_1.flushCharacterSync)(charId, accId);
});
// Oyun içi para/pozisyon güncellemeleri kuyruğa alınır (otomatik 30s'de bir kayıt)
// Kullanım örneği: queueCharacterSave({ characterId: 1, money: 5000, position: player.position })
// Sunucu kapatılırken tüm kuyruğu kaydet
async function gracefulShutdown() {
    isShuttingDown = true;
    console.log('[SERVER] Sunucu kapatılıyor, veriler kaydediliyor...');
    // 45 saniyede flush tamamlanmazsa zorla kapat — 1000 oyuncu/araç için yeterli süre
    const forceExitTimer = setTimeout(() => {
        console.error('[SERVER] Flush zaman aşımı (45s), zorla kapatılıyor...');
        process.exit(1);
    }, 45_000);
    try {
        await (0, VehicleManager_1.saveAllVehicles)();
    }
    catch (err) {
        console.error('[SERVER] Araç kaydetme hatası:', err);
    }
    try {
        await (0, save_queue_1.flushAll)();
    }
    catch (err) {
        console.error('[SERVER] Flush hatası:', err);
    }
    clearTimeout(forceExitTimer);
    (0, save_queue_1.stopSaveQueue)();
    (0, bcrypt_pool_1.destroyBcryptPool)();
    await (0, db_1.disconnectDB)();
    process.exit(0);
}
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
// ── Karakter Pozisyon Kaydı (her 30 saniyede bir) ─────────────────────────────────────
// Saat yayını kaldırıldı: HUD.svelte timeOffset ile loşal hesapladığından sunucu paketi geréksizdir.
setInterval(() => {
    mp.players.forEach((p) => {
        if ((0, safeEvent_1.isPlayerValid)(p) && p.characterId && p.position) {
            (0, save_queue_1.queueCharacterSave)({
                characterId: p.characterId,
                position: { x: p.position.x, y: p.position.y, z: p.position.z }
            });
        }
    });
}, 30_000);
// ── Chat & Komut Sistemi ──────────────────────────────────────────────────────
// Tüm chat (normal mesajlar + komutlar) cmdHandler.ts > initCommandSystem() içinde yönetilir.
console.log('[SERVER] SantosRP sunucusu başlatıldı!');
//# sourceMappingURL=index.js.map