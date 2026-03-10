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
/** dbId → motor yakıt döngüsü */
const engineLoops = new Map();
// ─── Motor Döngüsü ────────────────────────────────────────────────────────────────────────────────
function stopEngineLoop(dbId) {
    const loop = engineLoops.get(dbId);
    if (loop !== undefined) {
        clearInterval(loop);
        engineLoops.delete(dbId);
    }
}
function startEngineLoop(vehicle) {
    const dbId = vehicle.getVariable('dbId');
    if (!dbId)
        return;
    if (engineLoops.has(dbId))
        return;
    const loop = setInterval(() => {
        // Araç yoksa döngüyü temizle
        if (!vehicle || !mp.vehicles.exists(vehicle)) {
            stopEngineLoop(dbId);
            return;
        }
        const vel = vehicle.velocity;
        const speed = Math.sqrt(vel.x ** 2 + vel.y ** 2 + vel.z ** 2); // m/s
        let fuel = vehicle.getVariable('fuel') ?? 65;
        let km = vehicle.getVariable('km') ?? 0;
        let dirtLevel = vehicle.getVariable('dirtLevel') ?? 0;
        if (speed > 0.5) {
            // Yol üzerinde: yakıt tüketimi + km + kir
            fuel -= 0.278;
            km += (speed / 100);
            dirtLevel += 0.005;
        }
        else {
            // Rölanti: sadece yakıt tüketimi
            fuel -= 0.07;
        }
        if (fuel <= 0) {
            fuel = 0;
            vehicle.engine = false;
            vehicle.setVariable('engineStatus', false);
            vehicle.setVariable('fuel', 0);
            stopEngineLoop(dbId);
            // Araçtaki tüm oyunculara uyarı gönder
            mp.players.toArray().forEach((p) => {
                if (p.vehicle === vehicle) {
                    p.outputChatBox('!{#ef4444}[MOTOR] Yakıt bitti! Motor otomatik kapatıldı.');
                }
            });
            return;
        }
        vehicle.setVariable('fuel', fuel);
        vehicle.setVariable('km', km);
        vehicle.setVariable('dirtLevel', Math.min(dirtLevel, 15));
    }, 10_000);
    engineLoops.set(dbId, loop);
}
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
 */
async function saveAllVehicles() {
    const vehicles = mp.vehicles.toArray();
    if (vehicles.length === 0)
        return;
    const saves = vehicles.map(async (vehicle) => {
        const dbId = vehicle.getVariable('dbId');
        if (!dbId)
            return;
        try {
            const pos = vehicle.position;
            const posJson = JSON.stringify({
                x: pos.x,
                y: pos.y,
                z: pos.z,
                h: vehicle.heading,
                dimension: vehicle.dimension,
            });
            const metadata = JSON.stringify({
                fuel: vehicle.getVariable('fuel') ?? null,
                km: vehicle.getVariable('km') ?? null,
                dirtLevel: vehicle.getVariable('dirtLevel') ?? null,
            });
            await (0, db_1.query)('UPDATE vehicles SET position = $1, metadata = $2 WHERE id = $3', [posJson, metadata, dbId]);
        }
        catch (err) {
            console.error(`[VEHICLE] Auto-save hatası (dbId: ${dbId}):`, err);
        }
    });
    await Promise.all(saves);
    console.log(`[VEHICLE] Auto-save: ${vehicles.length} araç kaydedildi.`);
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