"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stopEngineLoop = stopEngineLoop;
exports.startEngineLoop = startEngineLoop;
exports.saveAllVehicles = saveAllVehicles;
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
const TIMEOUT_STANDARD = 60 * 60 * 1000; // 60 dakika
const TIMEOUT_FAST = 30 * 60 * 1000; // 30 dakika  (/parket komutuyla set edilir)
// ─── State ────────────────────────────────────────────────────────────────────
/** dbId → aktif park zamanlayıcısı */
const parkTimers = new Map();
/** Motor açık araçların dbId'si — tek bir global döngü bu Set'i işler */
const activeEngines = new Set();
// ─── Motor Döngüsü ────────────────────────────────────────────────────────────────────────────────
function stopEngineLoop(dbId) {
    activeEngines.delete(dbId);
}
function startEngineLoop(vehicle) {
    const dbId = vehicle.getVariable('dbId');
    if (!dbId)
        return;
    vehicle.setVariable('engineStatus', true);
    activeEngines.add(dbId);
}
// ─── Global Singleton Motor Döngüsü ─────────────────────────────────────────
// Binlerce ayrı setInterval yerine tüm aktif motorları tek döngüde işler.
setInterval(() => {
    if (activeEngines.size === 0)
        return;
    const vehicles = mp.vehicles.toArray();
    for (const vehicle of vehicles) {
        const dbId = vehicle.getVariable('dbId');
        if (!dbId || !activeEngines.has(dbId))
            continue;
        if (!mp.vehicles.exists(vehicle)) {
            activeEngines.delete(dbId);
            continue;
        }
        const vel = vehicle.velocity;
        const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y + vel.z * vel.z); // m/s
        let fuel = vehicle.getVariable('fuel') ?? 65;
        let km = vehicle.getVariable('km') ?? 0;
        let dirtLevel = vehicle.getVariable('dirtLevel') ?? 0;
        if (speed > 0.5) {
            fuel -= 0.278;
            km += (speed / 100);
            dirtLevel += 0.005;
        }
        else {
            fuel -= 0.07;
        }
        if (fuel <= 0) {
            fuel = 0;
            vehicle.engine = false;
            vehicle.setVariable('engineStatus', false);
            vehicle.setVariable('fuel', 0);
            activeEngines.delete(dbId);
            mp.players.toArray().forEach((p) => {
                if (p.vehicle === vehicle) {
                    p.outputChatBox('!{#ef4444}[MOTOR] Yakıt bitti! Motor otomatik kapatıldı.');
                }
            });
            continue;
        }
        vehicle.setVariable('fuel', fuel);
        vehicle.setVariable('km', km);
        vehicle.setVariable('dirtLevel', Math.min(dirtLevel, 15));
    }
}, 10_000);
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
        stopEngineLoop(dbId);
        try {
            vehicle.destroy();
        }
        catch { }
    }
}
// ─── Startup Kurtarma ────────────────────────────────────────────────────────
/**
 * Dünyada bulunan tüm aktif araçların pozisyon ve metadata verilerini DB'ye yazar.
 * Sunucu kapatılırken ve 5 dakikada bir çağrılır.
 * Tek bir Bulk UPDATE sorgusu kullanır — N+1 problemi tamamen ortadan kaldırıldı.
 */
async function saveAllVehicles() {
    const vehicles = mp.vehicles.toArray();
    if (vehicles.length === 0)
        return;
    // Tüm geçerli araç verilerini tek bir array'de biriktir
    const rows = [];
    for (const vehicle of vehicles) {
        const dbId = vehicle.getVariable('dbId');
        if (!dbId)
            continue;
        if (!mp.vehicles.exists(vehicle))
            continue;
        try {
            const pos = vehicle.position;
            rows.push({
                id: dbId,
                pos: JSON.stringify({
                    x: pos.x,
                    y: pos.y,
                    z: pos.z,
                    h: vehicle.heading,
                    dimension: vehicle.dimension,
                }),
                meta: JSON.stringify({
                    fuel: vehicle.getVariable('fuel') ?? null,
                    km: vehicle.getVariable('km') ?? null,
                    dirtLevel: vehicle.getVariable('dirtLevel') ?? null,
                }),
            });
        }
        catch (err) {
            console.error(`[VEHICLE] Auto-save veri hatası (dbId: ${dbId}):`, err);
        }
    }
    if (rows.length === 0)
        return;
    // Tek bir sorgu ile tüm araçları güncelle (Bulk UPDATE)
    try {
        await (0, db_1.query)(`UPDATE vehicles AS v
               SET position = (d.data->>'pos')::jsonb,
                   metadata = (d.data->>'meta')::jsonb
              FROM (SELECT json_array_elements($1::json) AS data) AS d
             WHERE v.id = (d.data->>'id')::int`, [JSON.stringify(rows)]);
        console.log(`[VEHICLE] Auto-save: ${rows.length} araç tek sorguda kaydedildi.`);
    }
    catch (err) {
        console.error('[VEHICLE] Bulk auto-save hatası:', err);
    }
}
// 5 dakikada bir tüm aktif araçları otomatik kaydet
setInterval(() => saveAllVehicles(), 5 * 60_000);
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
    // Araç silindiğinde hayalet zamanlayıcıları temizle ────────────────────────
    mp.events.add('entityDestroy', (entity) => {
        if (entity.type !== 'vehicle')
            return;
        const dbId = entity.getVariable('dbId');
        if (!dbId)
            return;
        const parkTimer = parkTimers.get(dbId);
        if (parkTimer !== undefined) {
            clearTimeout(parkTimer);
            parkTimers.delete(dbId);
        }
        activeEngines.delete(dbId);
    });
    // Araca binmeye başlandığında (kapı koluna uzandığında) ───────────────────
    (0, safeEvent_1.safeEvent)('playerStartEnterVehicle', (player, vehicle, seat) => {
        if (!vehicle)
            return;
        const dbId = vehicle.getVariable('dbId') ?? 'Bilinmiyor';
        const fuel = vehicle.getVariable('fuel') ?? 0;
        const tax = vehicle.getVariable('tax') ?? 0; // Veritabanında tax (vergi) sistemi ekliyse buradan çeker, yoksa 0 döner.
        const engineStatus = vehicle.getVariable('engineStatus') ?? false;
        // Chat mesajını mevcut değişkenlerle formatla
        player.outputChatBox(`!{#ffa500}ID: !{#FFF}${dbId} !{#ffa500}| Benzin: !{#FFF}${Math.floor(fuel)} !{#ffa500}| Plaka: !{#FFF}${vehicle.numberPlate} !{#ffa500}| Vergi: !{#FFF}$${tax}`);
        // Geçerli motor durumunu sunucu nesnesine aktar
        vehicle.engine = !!engineStatus;
    });
    console.log('[VEHICLE] Araç Yöneticisi aktif.');
}
//# sourceMappingURL=VehicleManager.js.map