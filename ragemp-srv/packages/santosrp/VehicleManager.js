"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recoverVehicles = recoverVehicles;
exports.initVehicleManager = initVehicleManager;
/**
 * SantosRP — Vehicle Manager (Server-Side)
 * Otomatik park sistemi: boş kalan araçları zamanlayıcı ile DB'ye kaydeder ve dünyadan siler.
 */
const db_1 = require("./db");
const safeEvent_1 = require("./utils/safeEvent");
const PARK_TIMEOUT_STANDARD = 60 * 60 * 1000; // 60 dakika
const PARK_TIMEOUT_FAST = 1 * 10 * 1000; // 30 dakika
/** DB ID (dbId variable) → aktif park zamanlayıcısı */
const parkTimers = new Map();
async function parkVehicle(dbId) {
    parkTimers.delete(dbId);
    // Araç hâlâ dünyada mı? Varsa koordinatlarını al ve sil.
    const vehicle = mp.vehicles.toArray().find((v) => v.getVariable('dbId') === dbId);
    try {
        let posJson = null;
        if (vehicle) {
            const pos = vehicle.position;
            posJson = JSON.stringify({
                x: pos.x,
                y: pos.y,
                z: pos.z,
                h: vehicle.heading,
                dimension: vehicle.dimension,
            });
        }
        if (posJson !== null) {
            await (0, db_1.query)('UPDATE vehicles SET is_parked = true, position = $1 WHERE id = $2', [posJson, dbId]);
        }
        else {
            // Araç zombileşmiş — pozisyon güncellemeden sadece parka çek
            await (0, db_1.query)('UPDATE vehicles SET is_parked = true WHERE id = $1', [dbId]);
        }
        console.log(`[VEHICLE] Araç #${dbId} DB'ye park edildi${vehicle ? '' : ' (zombi — entity bulunamadı)'}.`);
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
async function recoverVehicles() {
    try {
        const result = await (0, db_1.query)('UPDATE vehicles SET is_parked = true WHERE is_parked = false');
        console.log(`[VEHICLE] Kurtarma tamamlandı: ${result.rowCount} araç parka çekildi.`);
    }
    catch (err) {
        console.error('[VEHICLE] Kurtarma sorgusu başarısız:', err);
    }
}
function initVehicleManager() {
    console.log('[VEHICLE] Araç Yöneticisi başlatılıyor...');
    try {
        (0, safeEvent_1.safeEvent)('playerLeaveVehicle', (player, vehicle) => {
            if (!vehicle || !mp.vehicles.exists(vehicle))
                return;
            const dbId = vehicle.getVariable('dbId');
            if (!dbId)
                return; // DB kaydı olmayan araç (admin spawn vb.) — izleme
            // İnen oyuncu dışında araçta başkası kaldı mı?
            const otherOccupants = mp.players.toArray().filter((p) => p.vehicle === vehicle && p.id !== player.id);
            if (otherOccupants.length > 0)
                return;
            // Zaten bekleyen bir timer varsa yeniden başlatma
            if (parkTimers.has(dbId))
                return;
            const isFastPark = !!vehicle.getVariable('fast_park');
            const timeout = isFastPark ? PARK_TIMEOUT_FAST : PARK_TIMEOUT_STANDARD;
            const timer = setTimeout(() => parkVehicle(dbId), timeout);
            parkTimers.set(dbId, timer);
            console.log(`[VEHICLE] Araç #${dbId} için ${isFastPark ? 30 : 60}dk park zamanlayıcısı başlatıldı.`);
        });
    }
    catch (err) {
        console.error('[VEHICLE] playerLeaveVehicle event kaydedilemedi:', err);
    }
    try {
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
                console.log(`[VEHICLE] Araç #${dbId} park zamanlayıcısı iptal edildi.`);
            }
        });
    }
    catch (err) {
        console.error('[VEHICLE] playerEnterVehicle event kaydedilemedi:', err);
    }
    console.log('[VEHICLE] Araç Yöneticisi başlatıldı.');
}
//# sourceMappingURL=VehicleManager.js.map