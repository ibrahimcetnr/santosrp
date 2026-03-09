"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const cmdHandler_1 = require("../cmdHandler");
const safeEvent_1 = require("../utils/safeEvent");
const db_1 = require("../db");
const VehicleDataManager_1 = require("../VehicleDataManager");
(0, cmdHandler_1.registerCommand)({
    name: '/setadmin',
    syntax: '[ID] [Level]',
    description: 'Oyuncuya admin yetkisi verir',
    permissions: { admin: 10 },
}, async (player, args) => {
    if (args.length < 2) {
        player.outputChatBox('!{#fbbf24}[KULLANIM] /setadmin [ID] [Level]');
        player.outputChatBox('!{#94a3b8}Örnek: /setadmin 5 3');
        return;
    }
    const targetId = parseInt(args[0], 10);
    const newLevel = parseInt(args[1], 10);
    if (isNaN(targetId) || isNaN(newLevel)) {
        player.outputChatBox('!{#ef4444}[HATA] Geçersiz ID veya seviye.');
        return;
    }
    if (newLevel < 0 || newLevel > 100) {
        player.outputChatBox('!{#ef4444}[HATA] Admin seviyesi 0-100 arasında olmalı.');
        return;
    }
    const target = mp.players.at(targetId);
    if (!target || !(0, safeEvent_1.isPlayerValid)(target)) {
        player.outputChatBox('!{#ef4444}[HATA] Belirtilen ID\'de oyuncu bulunamadı.');
        return;
    }
    if (!target.accountId) {
        player.outputChatBox('!{#ef4444}[HATA] Hedef oyuncu giriş yapmamış.');
        return;
    }
    const targetLevel = target.adminLevel ?? 0;
    const playerLevel = player.adminLevel ?? 0;
    // Kendinden yüksek veya eşit yetkili birinin yetkisiyle oynayamaz
    if (targetLevel >= playerLevel && target !== player) {
        player.outputChatBox('!{#ef4444}[HATA] Kendi seviyenizden yüksek veya eşit bir yetkiliye işlem yapamazsınız.');
        return;
    }
    if (newLevel > playerLevel) {
        player.outputChatBox(`!{#ef4444}[HATA] Kendi seviyenizden (${playerLevel}) yüksek yetki veremezsiniz.`);
        return;
    }
    const { query } = await Promise.resolve().then(() => __importStar(require('../db')));
    try {
        await query('UPDATE accounts SET admin_level = $1 WHERE id = $2', [newLevel, target.accountId]);
        target.adminLevel = newLevel;
        const availableCommands = (0, cmdHandler_1.getAvailableCommands)(newLevel);
        target.call('client:updateCommandList', [JSON.stringify(availableCommands)]);
        const targetName = target.characterName || target.accountUsername || target.name;
        const adminName = player.characterName || player.accountUsername || player.name;
        player.outputChatBox(`!{#22c55e}[BAŞARILI] ${targetName} oyuncusunun admin seviyesi ${newLevel} olarak ayarlandı.`);
        target.outputChatBox(`!{#c9a84c}[BİLGİ] Admin seviyeniz ${adminName} tarafından ${newLevel} olarak güncellendi.`);
        console.log(`[SETADMIN] ${adminName} → ${targetName}: Level ${newLevel}`);
    }
    catch (error) {
        console.error('[SETADMIN] Database error:', error);
        player.outputChatBox('!{#ef4444}[HATA] Veritabanı hatası.');
    }
});
(0, cmdHandler_1.registerCommand)({
    name: '/kick',
    syntax: '[ID] [Sebep]',
    description: 'Oyuncuyu sunucudan atar',
    permissions: { admin: 5 },
}, (player, args) => {
    if (args.length < 2) {
        player.outputChatBox('!{#fbbf24}[KULLANIM] /kick [ID] [Sebep]');
        player.outputChatBox('!{#94a3b8}Örnek: /kick 5 Trolleme');
        return;
    }
    const targetId = parseInt(args[0], 10);
    const reason = args.slice(1).join(' ');
    if (isNaN(targetId)) {
        player.outputChatBox('!{#ef4444}[HATA] Geçersiz ID.');
        return;
    }
    const target = mp.players.at(targetId);
    if (!target || !(0, safeEvent_1.isPlayerValid)(target)) {
        player.outputChatBox('!{#ef4444}[HATA] Belirtilen ID\'de oyuncu bulunamadı.');
        return;
    }
    const targetLevel = target.adminLevel ?? 0;
    const playerLevel = player.adminLevel ?? 0;
    if (targetLevel >= playerLevel && target !== player) {
        player.outputChatBox('!{#ef4444}[HATA] Kendi seviyenizden yüksek veya eşit yetkiliyi kickleyemezsiniz.');
        return;
    }
    const targetName = target.characterName || target.accountUsername || target.name;
    const adminName = player.characterName || player.accountUsername || player.name;
    mp.players.broadcast(`!{#ef4444}[KICK] ${targetName} sunucudan atıldı. Sebep: ${reason} (Yetkili: ${adminName})`);
    console.log(`[KICK] ${adminName} kicked ${targetName}: ${reason}`);
    target.kick(`Sunucudan atıldınız.\nSebep: ${reason}\nYetkili: ${adminName}`);
});
(0, cmdHandler_1.registerCommand)({
    name: '/veh',
    syntax: '[Model]',
    description: 'Araç spawn eder ve veritabanına ekler',
    permissions: { admin: 8 },
}, async (player, args) => {
    if (args.length === 0) {
        player.outputChatBox('!{#fbbf24}[KULLANIM] /veh [Model]');
        player.outputChatBox('!{#94a3b8}Örnek: /veh adder');
        return;
    }
    if (!player.characterId) {
        player.outputChatBox('!{#ef4444}[HATA] Araç eklemek için karakter ile giriş yapmanız gerekiyor.');
        return;
    }
    const modelName = args[0].toLowerCase();
    const pos = player.position;
    const heading = player.heading;
    const rad = (heading * Math.PI) / 180;
    const spawnX = pos.x + Math.sin(rad) * 5;
    const spawnY = pos.y + Math.cos(rad) * 5;
    // Benzersiz plaka üret: ADM + 5 rastgele alfanümerik karakter
    const randStr = Math.random().toString(36).substring(2, 7).toUpperCase();
    const plate = `ADM${randStr}`;
    const posJson = JSON.stringify({
        x: spawnX,
        y: spawnY,
        z: pos.z,
        h: heading,
        dimension: player.dimension,
    });
    const metaJson = JSON.stringify({ fuel: 100, km: 0, dirtLevel: 0 });
    let dbId;
    try {
        const result = await (0, db_1.query)('INSERT INTO vehicles (owner_id, model, plate, is_parked, position, metadata) VALUES ($1, $2, $3, false, $4, $5) RETURNING id', [player.characterId, modelName, plate, posJson, metaJson]);
        dbId = result.rows[0].id;
    }
    catch (error) {
        console.error('[VEH] DB insert hatası:', error);
        player.outputChatBox('!{#ef4444}[HATA] Araç veritabanına eklenemedi.');
        return;
    }
    if (!(0, safeEvent_1.isPlayerValid)(player)) {
        // Oyuncu çıktıysa eklenen kaydı temizle
        await (0, db_1.query)('DELETE FROM vehicles WHERE id = $1', [dbId]).catch(() => { });
        return;
    }
    try {
        const veh = mp.vehicles.new(mp.joaat(modelName), new mp.Vector3(spawnX, spawnY, pos.z), {
            heading,
            numberPlate: plate,
            color: [[0, 0, 0], [0, 0, 0]],
            dimension: player.dimension,
        });
        veh.setVariable('dbId', dbId);
        veh.setVariable('owner_id', player.characterId);
        veh.engine = false;
        veh.setVariable('engineStatus', false);
        const vData = (0, VehicleDataManager_1.getVehicleData)(modelName);
        if (vData) {
            veh.setVariable('fuel_type', vData.fuel_type);
            veh.setVariable('max_fuel', vData.fuel_tank_size);
            veh.setVariable('trunk_size', vData.trunk_size);
        }
        veh.setVariable('fuel', vData ? vData.fuel_tank_size : 100);
        player.outputChatBox(`!{#22c55e}[BAŞARILI] ${modelName} aracı spawn edildi (Plaka: ${plate}, DB ID: ${dbId}).`);
        console.log(`[VEH] ${player.characterName || player.name} spawned ${modelName} → plate=${plate} dbId=${dbId} charId=${player.characterId}`);
    }
    catch (error) {
        // Spawn başarısız oldu, DB kaydını geri al
        await (0, db_1.query)('DELETE FROM vehicles WHERE id = $1', [dbId]).catch(() => { });
        player.outputChatBox('!{#ef4444}[HATA] Geçersiz araç modeli.');
        console.error('[VEH] Spawn hatası:', modelName, error);
    }
});
(0, cmdHandler_1.registerCommand)({
    name: '/spawn',
    syntax: '[ID]',
    description: 'Ölen oyuncuyu canlandırır',
    permissions: { admin: 5 },
}, (player, args) => {
    if (args.length < 1) {
        player.outputChatBox('!{#fbbf24}[KULLANIM] /spawn [ID]');
        player.outputChatBox('!{#94a3b8}Örnek: /spawn 5');
        return;
    }
    const targetId = parseInt(args[0], 10);
    if (isNaN(targetId)) {
        player.outputChatBox('!{#ef4444}[HATA] Geçersiz ID.');
        return;
    }
    const target = mp.players.at(targetId);
    if (!target || !(0, safeEvent_1.isPlayerValid)(target)) {
        player.outputChatBox('!{#ef4444}[HATA] Belirtilen ID\'de oyuncu bulunamadı.');
        return;
    }
    if (!target.characterId)
        return player.outputChatBox('!{#ef4444}[HATA] Hedef oyuncu henüz karaktere giriş yapmamış.');
    const targetName = target.characterName || target.accountUsername || target.name;
    const adminName = player.characterName || player.accountUsername || player.name;
    // Oyuncuyu bulunduğu konumda canlandır ve sağlığını tam yap
    target.spawn(target.position);
    target.health = 100;
    target.armour = 0;
    player.outputChatBox(`!{#22c55e}[SPAWN] ${targetName} canlandırıldı.`);
    target.outputChatBox(`!{#c9a84c}[BİLGİ] ${adminName} tarafından canlandırıldınız.`);
    console.log(`[SPAWN] ${adminName} revived ${targetName}`);
});
(0, cmdHandler_1.registerCommand)({
    name: '/tp',
    syntax: '[X] [Y] [Z]',
    description: 'Koordinatlara ışınlanırsınız',
    permissions: { admin: 3 },
}, (player, args) => {
    if (args.length < 3) {
        player.outputChatBox('!{#fbbf24}[KULLANIM] /tp [X] [Y] [Z]');
        return;
    }
    const x = parseFloat(args[0]), y = parseFloat(args[1]), z = parseFloat(args[2]);
    if (isNaN(x) || isNaN(y) || isNaN(z)) {
        player.outputChatBox('!{#ef4444}[HATA] Geçersiz koordinat değerleri.');
        return;
    }
    player.position = new mp.Vector3(x, y, z);
    player.outputChatBox('!{#22c55e}[BAŞARILI] Belirtilen koordinatlara ışınlandınız.');
    console.log(`[TP] ${player.characterName || player.name} → (${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)})`);
});
/** /goto [ID] - Oyuncunun yanına ışınlan */
(0, cmdHandler_1.registerCommand)({
    name: '/goto',
    syntax: '[ID]',
    description: 'Oyuncunun yanına ışınlanırsınız',
    permissions: { admin: 1 },
}, (player, args) => {
    if (args.length < 1)
        return player.outputChatBox('!{#fbbf24}[KULLANIM] /goto [ID]');
    const target = mp.players.at(parseInt(args[0], 10));
    if (!target || !(0, safeEvent_1.isPlayerValid)(target))
        return player.outputChatBox('!{#ef4444}[HATA] Oyuncu bulunamadı veya geçersiz ID.');
    if (!target.characterId)
        return player.outputChatBox('!{#ef4444}[HATA] Hedef oyuncu henüz karaktere giriş yapmamış.');
    const pos = target.position;
    player.position = new mp.Vector3(pos.x + 1.5, pos.y, pos.z);
    player.dimension = target.dimension;
    player.outputChatBox(`!{#22c55e}[BAŞARILI] ${target.characterName || target.name} adlı oyuncunun yanına ışınlandınız.`);
    console.log(`[GOTO] ${player.characterName || player.name} → ${target.characterName || target.name}`);
});
/** /get [ID] - Oyuncuyu yanına çek */
(0, cmdHandler_1.registerCommand)({
    name: '/get',
    syntax: '[ID]',
    description: 'Oyuncuyu yanınıza çekersiniz',
    permissions: { admin: 1 },
}, (player, args) => {
    if (args.length < 1)
        return player.outputChatBox('!{#fbbf24}[KULLANIM] /get [ID]');
    const target = mp.players.at(parseInt(args[0], 10));
    if (!target || !(0, safeEvent_1.isPlayerValid)(target))
        return player.outputChatBox('!{#ef4444}[HATA] Oyuncu bulunamadı veya geçersiz ID.');
    if (!target.characterId)
        return player.outputChatBox('!{#ef4444}[HATA] Hedef oyuncu henüz karaktere giriş yapmamış.');
    if (target === player)
        return player.outputChatBox('!{#ef4444}[HATA] Kendinizi çekemezsiniz.');
    const pos = player.position;
    target.position = new mp.Vector3(pos.x + 1.5, pos.y, pos.z);
    target.dimension = player.dimension;
    player.outputChatBox(`!{#22c55e}[BAŞARILI] ${target.characterName || target.name} adlı oyuncuyu yanınıza çektiniz.`);
    target.outputChatBox('!{#fbbf24}[BİLGİ] Bir yetkili tarafından ışınlandınız.');
    console.log(`[GET] ${player.characterName || player.name} pulled ${target.characterName || target.name}`);
});
/** /fixveh - İçinde bulunduğun aracı tamir et */
(0, cmdHandler_1.registerCommand)({
    name: '/fixveh',
    syntax: '',
    description: 'İçinde bulunduğunuz aracı tamir eder',
    permissions: { admin: 1 },
}, (player) => {
    if (!player.vehicle)
        return player.outputChatBox('!{#ef4444}[HATA] Herhangi bir aracın içinde değilsiniz.');
    player.vehicle.repair();
    player.outputChatBox('!{#22c55e}[BAŞARILI] Araç başarıyla tamir edildi.');
    console.log(`[FIXVEH] ${player.characterName || player.name} repaired a vehicle`);
});
/** /dv - İçinde bulunduğun aracı sil */
(0, cmdHandler_1.registerCommand)({
    name: '/dv',
    syntax: '',
    description: 'İçinde bulunduğunuz aracı siler',
    permissions: { admin: 2 },
}, (player) => {
    if (!player.vehicle)
        return player.outputChatBox('!{#ef4444}[HATA] Herhangi bir aracın içinde değilsiniz.');
    player.vehicle.destroy();
    player.outputChatBox('!{#22c55e}[BAŞARILI] Araç başarıyla silindi.');
    console.log(`[DV] ${player.characterName || player.name} destroyed a vehicle`);
});
/** /sethp [ID] [Can] - Oyuncunun canını ayarla */
(0, cmdHandler_1.registerCommand)({
    name: '/sethp',
    syntax: '[ID] [Değer]',
    description: 'Oyuncunun canını ayarlar',
    permissions: { admin: 1 },
}, (player, args) => {
    if (args.length < 2)
        return player.outputChatBox('!{#fbbf24}[KULLANIM] /sethp [ID] [Can]');
    const target = mp.players.at(parseInt(args[0], 10));
    const hp = parseInt(args[1], 10);
    if (!target || !(0, safeEvent_1.isPlayerValid)(target))
        return player.outputChatBox('!{#ef4444}[HATA] Oyuncu bulunamadı.');
    if (!target.characterId)
        return player.outputChatBox('!{#ef4444}[HATA] Hedef oyuncu henüz karaktere giriş yapmamış.');
    if (isNaN(hp) || hp < 0 || hp > 100)
        return player.outputChatBox('!{#ef4444}[HATA] Can 0-100 arasında olmalıdır.');
    target.health = hp;
    player.outputChatBox(`!{#22c55e}[BAŞARILI] ${target.characterName || target.name} adlı oyuncunun canı ${hp} yapıldı.`);
    console.log(`[SETHP] ${player.characterName || player.name} set ${target.characterName || target.name} health to ${hp}`);
});
/** /setarmor [ID] [Zırh] - Oyuncunun zırhını ayarla */
(0, cmdHandler_1.registerCommand)({
    name: '/setarmor',
    syntax: '[ID] [Değer]',
    description: 'Oyuncunun zırhını ayarlar',
    permissions: { admin: 1 },
}, (player, args) => {
    if (args.length < 2)
        return player.outputChatBox('!{#fbbf24}[KULLANIM] /setarmor [ID] [Zırh]');
    const target = mp.players.at(parseInt(args[0], 10));
    const armor = parseInt(args[1], 10);
    if (!target || !(0, safeEvent_1.isPlayerValid)(target))
        return player.outputChatBox('!{#ef4444}[HATA] Oyuncu bulunamadı.');
    if (!target.characterId)
        return player.outputChatBox('!{#ef4444}[HATA] Hedef oyuncu henüz karaktere giriş yapmamış.');
    if (isNaN(armor) || armor < 0 || armor > 100)
        return player.outputChatBox('!{#ef4444}[HATA] Zırh 0-100 arasında olmalıdır.');
    target.armour = armor;
    player.outputChatBox(`!{#22c55e}[BAŞARILI] ${target.characterName || target.name} adlı oyuncunun zırhı ${armor} yapıldı.`);
    console.log(`[SETARMOR] ${player.characterName || player.name} set ${target.characterName || target.name} armour to ${armor}`);
});
// ─── /gotocar [ID] ───────────────────────────────────────────────────────────
(0, cmdHandler_1.registerCommand)({
    name: '/gotocar',
    syntax: '[ID]',
    description: 'Belirtilen DB ID\'li aracın yanına ışınlanır',
    permissions: { admin: 1 },
}, (player, args) => {
    if (args.length === 0)
        return player.outputChatBox('!{#fbbf24}[KULLANIM] /gotocar [ID]');
    const dbId = parseInt(args[0], 10);
    if (isNaN(dbId))
        return player.outputChatBox('!{#ef4444}[HATA] Geçersiz araç ID.');
    const vehicle = mp.vehicles.toArray().find((v) => v.getVariable('dbId') === dbId);
    if (!vehicle) {
        player.outputChatBox(`!{#ef4444}[HATA] #${dbId} ID'li araç şu an dünyada bulunamadı.`);
        return;
    }
    const pos = vehicle.position;
    player.position = new mp.Vector3(pos.x + 2, pos.y, pos.z);
    player.dimension = vehicle.dimension;
    player.outputChatBox(`!{#22c55e}[ADMIN] #${dbId} ID'li aracın (${vehicle.numberPlate}) yanına ışınlandınız.`);
    console.log(`[GOTOCAR] ${player.characterName || player.name} -> dbId=${dbId}`);
});
/** /weapon [SilahAdı] - Kendine silah ver */
(0, cmdHandler_1.registerCommand)({
    name: '/weapon',
    syntax: '[SilahAdı]',
    description: 'Kendine belirtilen silahı verir',
    permissions: { admin: 1 },
}, (player, args) => {
    if (args.length === 0) {
        player.outputChatBox('!{#fbbf24}[KULLANIM] /weapon [SilahAdı]');
        player.outputChatBox('!{#94a3b8}Örnek: /weapon weapon_pistol');
        return;
    }
    const weaponName = args[0].toLowerCase().startsWith('weapon_')
        ? args[0].toLowerCase()
        : `weapon_${args[0].toLowerCase()}`;
    const weaponHash = mp.joaat(weaponName);
    try {
        player.giveWeapon(weaponHash, 9999);
        player.outputChatBox(`!{#22c55e}[BAŞARILI] ${weaponName} silahı verildi (9999 mermi).`);
        console.log(`[WEAPON] ${player.characterName || player.name} gave themselves ${weaponName}`);
    }
    catch (error) {
        player.outputChatBox('!{#ef4444}[HATA] Geçersiz silah adı.');
        console.error('[WEAPON] Invalid weapon:', weaponName, error);
    }
});
// ─── /getcar [ID] ────────────────────────────────────────────────────────────
(0, cmdHandler_1.registerCommand)({
    name: '/getcar',
    syntax: '[ID]',
    description: 'Belirtilen DB ID\'li aracı yanına çeker',
    permissions: { admin: 1 },
}, (player, args) => {
    if (args.length === 0)
        return player.outputChatBox('!{#fbbf24}[KULLANIM] /getcar [ID]');
    const dbId = parseInt(args[0], 10);
    if (isNaN(dbId))
        return player.outputChatBox('!{#ef4444}[HATA] Geçersiz araç ID.');
    const vehicle = mp.vehicles.toArray().find((v) => v.getVariable('dbId') === dbId);
    if (!vehicle) {
        player.outputChatBox(`!{#ef4444}[HATA] #${dbId} ID'li araç şu an dünyada bulunamadı.`);
        return;
    }
    const pos = player.position;
    vehicle.position = new mp.Vector3(pos.x + 3, pos.y, pos.z);
    vehicle.rotation = new mp.Vector3(0, 0, player.heading);
    vehicle.dimension = player.dimension;
    player.outputChatBox(`!{#22c55e}[ADMIN] #${dbId} ID'li araç (${vehicle.numberPlate}) yanına çekildi.`);
    console.log(`[GETCAR] ${player.characterName || player.name} pulled dbId=${dbId} to their location`);
});
// ─── /entercar [ID] ──────────────────────────────────────────────────────────
(0, cmdHandler_1.registerCommand)({
    name: '/entercar',
    syntax: '[ID]',
    description: 'Belirtilen DB ID\'li aracın şoför koltuğuna ışınlanır',
    permissions: { admin: 1 },
}, (player, args) => {
    if (args.length === 0)
        return player.outputChatBox('!{#fbbf24}[KULLANIM] /entercar [ID]');
    const dbId = parseInt(args[0], 10);
    if (isNaN(dbId))
        return player.outputChatBox('!{#ef4444}[HATA] Geçersiz araç ID.');
    const vehicle = mp.vehicles.toArray().find((v) => v.getVariable('dbId') === dbId);
    if (!vehicle) {
        player.outputChatBox(`!{#ef4444}[HATA] #${dbId} ID'li araç şu an dünyada bulunamadı.`);
        return;
    }
    player.putIntoVehicle(vehicle, 0);
    player.outputChatBox(`!{#22c55e}[ADMIN] #${dbId} ID'li aracın (${vehicle.numberPlate}) şoför koltuğuna oturtuldunuz.`);
    console.log(`[ENTERCAR] ${player.characterName || player.name} entered dbId=${dbId}`);
});
//# sourceMappingURL=admin.js.map