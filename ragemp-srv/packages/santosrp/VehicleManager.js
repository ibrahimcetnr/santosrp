"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recoverVehicles = recoverVehicles;
exports.initVehicleManager = initVehicleManager;
/**
 * SantosRP — Vehicle Manager (Server-Side)
 * Tüm timer anahtarları dbId (SQL primary key) bazlıdır,
 * RAGE:MP'nin geçici entity ID'lerine bağımlılık yoktur.
 */
const db_1 = require("./db");
const safeEvent_1 = require("./utils/safeEvent");
// ─── Sabitler ────────────────────────────────────────────────────────────────
const TIMEOUT_STANDARD = 1 * 15 * 1000; // 60 dakika
const TIMEOUT_FAST = 1 * 10 * 1000; // 30 dakika  (/parket komutuyla set edilir)
// ─── State ────────────────────────────────────────────────────────────────────
/** dbId → aktif park zamanlayıcısı */
const parkTimers = new Map();
// ─── Yardımcı Fonksiyonlar ───────────────────────────────────────────────────
/** Dünyada bu dbId'ye sahip aracı bulur (yoksa undefined döner) */
function findVehicleByDbId(dbId) {
    return mp.vehicles.toArray().find((v) => v.getVariable('dbId') === dbId);
}
// ─── Park Fonksiyonu ─────────────────────────────────────────────────────────
async function parkVehicle(dbId) {
    parkTimers.delete(dbId);
    const vehicle = findVehicleByDbId(dbId);
    try {
        if (vehicle) {
            // Araç dünyada: koordinatları al, pozisyon + is_parked güncelle
            const pos = vehicle.position;
            const posJson = JSON.stringify({
                x: pos.x,
                y: pos.y,
                z: pos.z,
                h: vehicle.heading,
                dimension: vehicle.dimension,
            });
            await (0, db_1.query)('UPDATE vehicles SET is_parked = true, position = $1 WHERE id = $2', [posJson, dbId]);
        }
        else {
            // Araç zombileşti: sadece is_parked güncelle, konum dokunma
            await (0, db_1.query)('UPDATE vehicles SET is_parked = true WHERE id = $1', [dbId]);
            console.warn(`[VEHICLE] Araç #${dbId} dünyada bulunamadı, yalnızca DB güncellendi.`);
        }
        console.log(`[VEHICLE] Araç #${dbId} parka çekildi.`);
    }
    catch (err) {
        console.error(`[VEHICLE] Park DB hatası (dbId: ${dbId}):`, err);
    }
    if (vehicle) {
        try {
            vehicle.destroy();
        }
        catch { }
    }
}
// ─── Startup Kurtarma ────────────────────────────────────────────────────────
/**
 * Sunucu kapanırken dışarıda kalan araçları temizler.
 * index.ts'de initVehicleManager() öncesinde await ile çağrılmalı.
 */
async function recoverVehicles() {
    try {
        const result = await (0, db_1.query)('UPDATE vehicles SET is_parked = true WHERE is_parked = false');
        console.log(`[VEHICLE] Kurtarma: ${result.rowCount} araç parka alındı.`);
    }
    catch (err) {
        console.error('[VEHICLE] Kurtarma sorgusu başarısız:', err);
    }
}
// ─── Ana Başlatıcı ───────────────────────────────────────────────────────────
function initVehicleManager() {
    console.log('[VEHICLE] Araç Yöneticisi başlatılıyor...');
    // Araçtan inilince ─────────────────────────────────────────────────────────
    (0, safeEvent_1.safeEvent)('playerExitVehicle', (player, vehicle) => {
        if (!vehicle || !mp.vehicles.exists(vehicle))
            return;
        // dbId yoksa bu araç takip edilmiyor (admin spawn vb.)
        const dbId = vehicle.getVariable('dbId');
        if (!dbId)
            return;
        // İnen oyuncu hariç araçta başkası var mı?
        // (RAGE sync gecikmesine karşı: inen oyuncunun vehicle'ı henüz null olmayabilir)
        const stillOccupied = mp.players.toArray().some((p) => p.vehicle === vehicle && p.id !== player.id);
        if (stillOccupied)
            return;
        // Bu araç için zaten bekleyen bir timer varsa tekrar başlatma
        if (parkTimers.has(dbId))
            return;
        const isFastPark = !!vehicle.getVariable('fast_park');
        const timeout = isFastPark ? TIMEOUT_FAST : TIMEOUT_STANDARD;
        const timer = setTimeout(() => parkVehicle(dbId), timeout);
        parkTimers.set(dbId, timer);
        const mins = timeout / 60_000;
        console.log(`[VEHICLE] Araç #${dbId} için ${mins}dk park zamanlayıcısı başlatıldı.`);
    });
    // Araca binilince ──────────────────────────────────────────────────────────
    (0, safeEvent_1.safeEvent)('playerEnterVehicle', (_player, vehicle) => {
        if (!vehicle)
            return;
        const dbId = vehicle.getVariable('dbId');
        if (!dbId)
            return;
        const timer = parkTimers.get(dbId);
        if (timer !== undefined) {
            clearTimeout(timer);
            parkTimers.delete(dbId);
            console.log(`[VEHICLE] Araç #${dbId} için park zamanlayıcısı iptal edildi.`);
        }
    });
    console.log('[VEHICLE] Araç Yöneticisi aktif.');
}
//# sourceMappingURL=VehicleManager.js.map