"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * SantosRP — Araç Komutları
 * /araccikar [Plaka]  — Park edilmiş aracı dünyaya çıkarır
 * /parket             — Aracı hızlı park moduna alır (30dk zamanlayıcı)
 * /motor  (/m)        — Motoru aç/kapat
 * /kilit  (/l)        — Kilidi aç/kapat
 * /kemer  (/k)        — Emniyet kemerini tak/çıkar
 */
const cmdHandler_1 = require("../cmdHandler");
const safeEvent_1 = require("../utils/safeEvent");
const db_1 = require("../db");
const VehicleDataManager_1 = require("../VehicleDataManager");
const VehicleManager_1 = require("../VehicleManager");
// ─── /araccikar [Plaka] ───────────────────────────────────────────────────────
(0, cmdHandler_1.registerCommand)({
    name: '/araccikar',
    syntax: '[Plaka]',
    description: 'Park edilmiş aracınızı dünyaya çıkarır',
}, async (player, args) => {
    if (args.length === 0) {
        player.outputChatBox('!{#fbbf24}[KULLANIM] /araccikar [Plaka]');
        return;
    }
    if (!player.characterId) {
        player.outputChatBox('!{#ef4444}[HATA] Karakter ile giriş yapmanız gerekiyor.');
        return;
    }
    const plate = args[0].toUpperCase();
    // Veritabanı sorgusu
    let result;
    try {
        result = await (0, db_1.query)('SELECT * FROM vehicles WHERE owner_id = $1 AND plate = $2 LIMIT 1', [player.characterId, plate]);
    }
    catch (err) {
        console.error('[ARACCIKAR] DB sorgu hatası:', err);
        if ((0, safeEvent_1.isPlayerValid)(player))
            player.outputChatBox('!{#ef4444}[HATA] Veritabanı hatası, lütfen tekrar deneyin.');
        return;
    }
    if (!(0, safeEvent_1.isPlayerValid)(player))
        return;
    if (result.rows.length === 0) {
        player.outputChatBox(`!{#ef4444}[HATA] "${plate}" plakalı araca sahip değilsiniz.`);
        return;
    }
    const v = result.rows[0];
    if (!v.is_parked) {
        player.outputChatBox('!{#fbbf24}[BİLGİ] Bu araç zaten dünyada bulunuyor.');
        return;
    }
    // Pozisyon verisini parse et; bozuksa oyuncunun bulunduğu konuma getir
    let pos;
    try {
        const raw = typeof v.position === 'string' ? JSON.parse(v.position) : v.position;
        if (!raw?.x || !raw?.y || !raw?.z)
            throw new Error('Eksik koordinat');
        pos = raw;
    }
    catch {
        const pp = player.position;
        pos = { x: pp.x, y: pp.y, z: pp.z, h: player.heading, dimension: player.dimension };
        player.outputChatBox('!{#fbbf24}[BİLGİ] Araç konum verisi bozuktu, araç yanınıza getirildi.');
    }
    // Aracı dünyaya spawn et
    let veh;
    try {
        veh = mp.vehicles.new(v.model, new mp.Vector3(pos.x, pos.y, pos.z), {
            heading: pos.h ?? 0,
            numberPlate: v.plate,
            dimension: pos.dimension ?? 0,
        });
        veh.setVariable('dbId', v.id);
        veh.setVariable('owner_id', player.characterId);
        const vData = (0, VehicleDataManager_1.getVehicleData)(v.model);
        if (vData) {
            veh.setVariable('fuel_type', vData.fuel_type);
            veh.setVariable('max_fuel', vData.fuel_tank_size);
            veh.setVariable('trunk_size', vData.trunk_size);
        }
        veh.setVariable('fuel', vData ? vData.fuel_tank_size : 65);
        veh.engine = false;
        veh.setVariable('engineStatus', false);
    }
    catch (err) {
        console.error('[ARACCIKAR] Spawn hatası:', err);
        if ((0, safeEvent_1.isPlayerValid)(player))
            player.outputChatBox('!{#ef4444}[HATA] Araç spawn edilemedi.');
        return;
    }
    // Veritabanını güncelle
    try {
        await (0, db_1.query)('UPDATE vehicles SET is_parked = false WHERE id = $1', [v.id]);
    }
    catch (err) {
        console.error('[ARACCIKAR] DB güncelleme hatası:', err);
    }
    if (!(0, safeEvent_1.isPlayerValid)(player))
        return;
    player.outputChatBox(`!{#22c55e}[BAŞARILI] "${plate}" plakalı araç çıkarıldı.`);
    console.log(`[ARACCIKAR] charId=${player.characterId} aracı çıkardı: ${plate} (dbId=${v.id})`);
});
// ─── /parket ─────────────────────────────────────────────────────────────────
(0, cmdHandler_1.registerCommand)({
    name: '/parket',
    syntax: '',
    description: 'Aracı hızlı park moduna alır (araçtan iner inmez 30dk zamanlayıcı başlar)',
}, (player) => {
    const vehicle = player.vehicle;
    if (!vehicle) {
        player.outputChatBox('!{#fbbf24}[HATA] Bir araçta olmanız gerekiyor.');
        return;
    }
    // RAGE:MP: sürücü koltuğu sayısal değeri -1
    if (player.seat !== 0) {
        player.outputChatBox('!{#fbbf24}[HATA] Yalnızca sürücü bu komutu kullanabilir.');
        return;
    }
    vehicle.setVariable('fast_park', true);
    player.outputChatBox('!{#00ff00}[SİSTEM] Araç hızlı park moduna alındı. ' +
        'Araçtan iner inmez 30 dakika içinde otomatik parka çekilecektir.');
});
// ─── /motor (/m) ─────────────────────────────────────────────────────────────
for (const name of ['/motor', '/m']) {
    (0, cmdHandler_1.registerCommand)({ name, syntax: '', description: 'Araç motorunu açar/kapatır' }, (player) => {
        const vehicle = player.vehicle;
        if (!vehicle) {
            player.outputChatBox('!{#fbbf24}[HATA] Bir araçta olmanız gerekiyor.');
            return;
        }
        if (player.seat !== 0) {
            player.outputChatBox('!{#fbbf24}[HATA] Yalnızca sürücü bu komutu kullanabilir.');
            return;
        }
        if (vehicle.getVariable('owner_id') !== player.characterId) {
            player.outputChatBox('!{#ef4444}[HATA] Bu aracın anahtarına sahip değilsiniz.');
            return;
        }
        vehicle.engine = !vehicle.engine;
        vehicle.setVariable('engineStatus', vehicle.engine);
        if (vehicle.engine) {
            (0, VehicleManager_1.startEngineLoop)(vehicle);
            player.outputChatBox('!{#22c55e}[MOTOR] Motor çalıştırıldı.');
        }
        else {
            (0, VehicleManager_1.stopEngineLoop)(vehicle.getVariable('dbId'));
            player.outputChatBox('!{#ef4444}[MOTOR] Motor kapatıldı.');
        }
    });
}
// ─── /kilit (/l) ─────────────────────────────────────────────────────────────
for (const name of ['/kilit', '/l']) {
    (0, cmdHandler_1.registerCommand)({ name, syntax: '', description: 'Araç kilidini açar/kapatır' }, (player) => {
        let vehicle = player.vehicle;
        // Araçta değilse 5 metre yakınındaki en yakın aracı bul
        if (!vehicle) {
            let nearest = null;
            let nearestDist = 5.0;
            const pPos = player.position;
            mp.vehicles.toArray().forEach((v) => {
                try {
                    const vPos = v.position;
                    const dist = Math.sqrt(Math.pow(pPos.x - vPos.x, 2) +
                        Math.pow(pPos.y - vPos.y, 2) +
                        Math.pow(pPos.z - vPos.z, 2));
                    if (dist < nearestDist) {
                        nearestDist = dist;
                        nearest = v;
                    }
                }
                catch { }
            });
            if (!nearest) {
                player.outputChatBox('!{#fbbf24}[HATA] Yakında kilitlenebilecek bir araç yok.');
                return;
            }
            vehicle = nearest;
        }
        if (vehicle.getVariable('owner_id') !== player.characterId) {
            player.outputChatBox('!{#ef4444}[HATA] Bu aracın anahtarına sahip değilsiniz.');
            return;
        }
        vehicle.locked = !vehicle.locked;
        vehicle.setVariable('lockedStatus', vehicle.locked);
        if (vehicle.locked) {
            player.outputChatBox('!{#ef4444}[KİLİT] Araç kilitlendi.');
        }
        else {
            player.outputChatBox('!{#22c55e}[KİLİT] Araç kilidi açıldı.');
        }
    });
}
// ─── /kemer (/k) ─────────────────────────────────────────────────────────────
for (const name of ['/kemer', '/k']) {
    (0, cmdHandler_1.registerCommand)({ name, syntax: '', description: 'Emniyet kemerini takar/çıkarır' }, (player) => {
        if (!player.vehicle) {
            player.outputChatBox('!{#fbbf24}[HATA] Bir araçta olmanız gerekiyor.');
            return;
        }
        const current = !!player.getVariable('seatbelt');
        player.setVariable('seatbelt', !current);
        if (!current) {
            player.outputChatBox('!{#22c55e}[KEMER] Emniyet kemeri takıldı.');
        }
        else {
            player.outputChatBox('!{#ef4444}[KEMER] Emniyet kemeri çıkarıldı.');
        }
    });
}
//# sourceMappingURL=vehicle.js.map