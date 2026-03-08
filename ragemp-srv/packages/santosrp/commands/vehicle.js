"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * SantosRP — Araç Komutları
 * /araccikar [Plaka]  — Park edilmiş aracı dünyaya çıkarır
 * /parket             — Aracı hızlı park moduna alır (30dk zamanlayıcı)
 */
const cmdHandler_1 = require("../cmdHandler");
const safeEvent_1 = require("../utils/safeEvent");
const db_1 = require("../db");
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
//# sourceMappingURL=vehicle.js.map