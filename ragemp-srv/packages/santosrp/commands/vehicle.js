"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * SantosRP — Araç Komutları (Server-Side)
 * /araccikar [Plaka] — Park edilmiş aracı çıkarır
 * /parket            — Aracı hızlı park moduna alır (30 dakika zamanlayıcı)
 */
const cmdHandler_1 = require("../cmdHandler");
const safeEvent_1 = require("../utils/safeEvent");
const db_1 = require("../db");
// ─── /araccikar [Plaka] ────────────────────────────────────────────────────────
(0, cmdHandler_1.registerCommand)({
    name: '/araccikar',
    syntax: '[Plaka]',
    description: 'Park edilmiş aracınızı çıkarır',
}, async (player, args) => {
    if (args.length === 0) {
        player.outputChatBox('!{#fbbf24}[KULLANIM] /araccikar [Plaka]');
        return;
    }
    if (!player.characterId) {
        player.outputChatBox('!{#ef4444}[HATA] Bir karakter ile giriş yapmanız gerekiyor.');
        return;
    }
    const plate = args[0].toUpperCase();
    let result;
    try {
        result = await (0, db_1.query)('SELECT * FROM vehicles WHERE owner_id = $1 AND plate = $2 LIMIT 1', [player.characterId, plate]);
    }
    catch (err) {
        console.error('[ARACCIKAR] DB sorgu hatası:', err);
        if ((0, safeEvent_1.isPlayerValid)(player)) {
            player.outputChatBox('!{#ef4444}[HATA] Veritabanı hatası, lütfen tekrar deneyin.');
        }
        return;
    }
    if (!(0, safeEvent_1.isPlayerValid)(player))
        return;
    if (result.rows.length === 0) {
        player.outputChatBox(`!{#ef4444}[HATA] "${plate}" plakalı araca sahip değilsiniz.`);
        return;
    }
    const dbVehicle = result.rows[0];
    if (!dbVehicle.is_parked) {
        player.outputChatBox('!{#fbbf24}[BİLGİ] Bu araç zaten dünyada bulunuyor.');
        return;
    }
    let pos;
    try {
        pos = typeof dbVehicle.position === 'string'
            ? JSON.parse(dbVehicle.position)
            : dbVehicle.position;
    }
    catch {
        player.outputChatBox('!{#ef4444}[HATA] Araç konum verisi bozuk.');
        return;
    }
    let veh;
    try {
        veh = mp.vehicles.new(dbVehicle.model, new mp.Vector3(pos.x, pos.y, pos.z), {
            heading: pos.h ?? 0,
            numberPlate: dbVehicle.plate,
            dimension: pos.dimension ?? 0,
        });
        veh.setVariable('dbId', dbVehicle.id);
    }
    catch (err) {
        console.error('[ARACCIKAR] Araç spawn hatası:', err);
        if ((0, safeEvent_1.isPlayerValid)(player)) {
            player.outputChatBox('!{#ef4444}[HATA] Araç spawn edilemedi.');
        }
        return;
    }
    try {
        await (0, db_1.query)('UPDATE vehicles SET is_parked = false WHERE id = $1', [dbVehicle.id]);
    }
    catch (err) {
        console.error('[ARACCIKAR] DB güncelleme hatası:', err);
    }
    if (!(0, safeEvent_1.isPlayerValid)(player))
        return;
    player.outputChatBox(`!{#22c55e}[BAŞARILI] "${plate}" plakalı araç çıkarıldı.`);
});
// ─── /parket ──────────────────────────────────────────────────────────────────
(0, cmdHandler_1.registerCommand)({
    name: '/parket',
    syntax: '',
    description: 'Aracı park moduna alır (araçtan indikten 30 dakika sonra parka çekilir)',
}, (player) => {
    const vehicle = player.vehicle;
    if (!vehicle) {
        player.outputChatBox('!{#fbbf24}[HATA] Bir araçta olmanız gerekiyor.');
        return;
    }
    if (player.seat !== 0) {
        player.outputChatBox('!{#fbbf24}[HATA] Sürücü koltuğunda olmanız gerekiyor.');
        return;
    }
    vehicle.setVariable('fast_park', true);
    player.outputChatBox('!{#00ff00}[SİSTEM] Araç park moduna alındı. Araçtan indiğinizde 30 dakika içinde kalıcı olarak parka çekilecektir.');
});
//# sourceMappingURL=vehicle.js.map