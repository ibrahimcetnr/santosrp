"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.queueCharacterSave = void 0;
/**
 * RAGE:MP - Server Entry Point
 * SantosRP Server-Tarafı Ana Dosyası
 */
const auth_1 = require("./auth");
const bcrypt_pool_1 = require("./bcrypt-pool");
const save_queue_1 = require("./save-queue");
Object.defineProperty(exports, "queueCharacterSave", { enumerable: true, get: function () { return save_queue_1.queueCharacterSave; } });
const safeEvent_1 = require("./utils/safeEvent");
const db_1 = require("./db");
const cmdHandler_1 = require("./cmdHandler");
const payday_1 = require("./payday");
const weather_1 = require("./weather");
const vehicleDamage_1 = require("./vehicleDamage");
const VehicleManager_1 = require("./VehicleManager");
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
// Araç hasar sistemini başlat
(0, vehicleDamage_1.initVehicleDamageEvents)();
// Startup kurtarma: sunucu kapanırken dışarıda kalan araçları parka çek
(0, VehicleManager_1.recoverVehicles)();
// Araç yöneticisini başlat (otomatik park sistemi)
(0, VehicleManager_1.initVehicleManager)();
(0, safeEvent_1.safeEvent)('playerDisconnect', async (player, exitType, reason) => {
    if (isShuttingDown)
        return; // Sunucu kapanırken flushAll çalışacağı için çakışmayı önle
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
    let accId;
    try {
        accId = player.accountId;
    }
    catch { }
    // Çıkmadan hemen önce son pozisyonu kuyruğa al
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
    // player nesnesi geçersizleşmeden önce tamamlanması garanti altındadır.
    await (0, save_queue_1.flushCharacterSync)(charId, accId);
});
// Oyun içi para/pozisyon güncellemeleri kuyruğa alınır (otomatik 30s'de bir kayıt)
// Kullanım örneği: queueCharacterSave({ characterId: 1, money: 5000, position: player.position })
// Sunucu kapatılırken tüm kuyruğu kaydet
async function gracefulShutdown() {
    isShuttingDown = true;
    console.log('[SERVER] Sunucu kapatılıyor, veriler kaydediliyor...');
    // 10 saniyede flush tamamlanmazsa zorla kapat (systemd TimeoutStopSec aşımını önler)
    const forceExitTimer = setTimeout(() => {
        console.error('[SERVER] Flush zaman aşımı (10s), zorla kapatılıyor...');
        process.exit(1);
    }, 10_000);
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
// ── Sunucu Saati Yayını (her 30 saniyede bir) ─────────────────────────────────
// Oyuncuların HUD'unda sunucu saati/tarihi gösterilir; cihaz saati değil.
setInterval(() => {
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const dateStr = now.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    mp.players.forEach((p) => {
        try {
            if ((0, safeEvent_1.isPlayerValid)(p) && p.characterId) {
                p.call('client:hudTime', [timeStr, dateStr]);
                // Aktif oyuncunun pozisyonunu 30 saniyede bir güvenli şekilde kuyruğa ekle
                if (p.position) {
                    (0, save_queue_1.queueCharacterSave)({
                        characterId: p.characterId,
                        position: { x: p.position.x, y: p.position.y, z: p.position.z }
                    });
                }
            }
        }
        catch { }
    });
}, 30_000);
// ── Chat & Komut Sistemi ──────────────────────────────────────────────────────
// Tüm chat (normal mesajlar + komutlar) cmdHandler.ts > initCommandSystem() içinde yönetilir.
console.log('[SERVER] SantosRP sunucusu başlatıldı!');
//# sourceMappingURL=index.js.map