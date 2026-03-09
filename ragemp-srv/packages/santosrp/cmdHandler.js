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
exports.broadcastInRange = broadcastInRange;
exports.broadcastFadingMessage = broadcastFadingMessage;
exports.registerCommand = registerCommand;
exports.getAvailableCommands = getAvailableCommands;
exports.executeCommand = executeCommand;
exports.initCommandSystem = initCommandSystem;
const safeEvent_1 = require("./utils/safeEvent");
// Komut deposu
const commands = new Map();
/**
 * Belirli bir mesafe içindeki oyunculara mesaj gönderir
 */
function broadcastInRange(player, range, message) {
    const pos = player.position;
    const dimension = player.dimension;
    mp.players.forEachInRange(pos, range, dimension, (target) => {
        if (!target.handle || !mp.players.exists(target))
            return;
        if ((0, safeEvent_1.isPlayerValid)(target) && target.characterId) {
            target.outputChatBox(message);
        }
    });
}
/** İki HEX rengi mesafe faktörüne (0.0-1.0) göre karıştırır */
function lerpColor(color1, color2, factor) {
    const hex2rgb = (hex) => [
        parseInt(hex.slice(1, 3), 16),
        parseInt(hex.slice(3, 5), 16),
        parseInt(hex.slice(5, 7), 16),
    ];
    const c1 = hex2rgb(color1);
    const c2 = hex2rgb(color2);
    const r = Math.round(c1[0] + factor * (c2[0] - c1[0]));
    const g = Math.round(c1[1] + factor * (c2[1] - c1[1]));
    const b = Math.round(c1[2] + factor * (c2[2] - c1[2]));
    return `!{#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}}`;
}
/** Mesafeye göre solan renk ile mesaj gönderir */
function broadcastFadingMessage(player, maxRange, baseColor, darkColor, formatMsg) {
    const pos = player.position;
    const dimension = player.dimension;
    mp.players.forEachInRange(pos, maxRange, dimension, (target) => {
        if (!target.handle || !mp.players.exists(target))
            return;
        if ((0, safeEvent_1.isPlayerValid)(target) && target.characterId) {
            const dist = player.dist(target.position);
            const factor = Math.min(dist / maxRange, 1.0);
            const fadeColor = lerpColor(baseColor, darkColor, factor);
            target.outputChatBox(formatMsg(fadeColor));
        }
    });
}
/**
 * Yeni bir komut kaydeder
 * @param cmd Komut bilgileri (name, syntax, minLevel, category)
 * @param handler Komut çalıştırıldığında çağrılacak fonksiyon
 */
function registerCommand(cmd, handler) {
    const cmdName = cmd.name.toLowerCase();
    if (commands.has(cmdName)) {
        console.warn(`[CMD] Komut zaten kayıtlı: ${cmdName} (üzerine yazılıyor)`);
    }
    commands.set(cmdName, { ...cmd, handler });
    console.log(`[CMD] Komut kaydedildi: ${cmdName}`);
}
/**
 * Oyuncunun bir komuta erişebildiğini kontrol eder
 */
function hasCommandAccess(player, cmd) {
    const p = cmd.permissions;
    if (!p || Object.keys(p).length === 0)
        return true;
    if (p.admin && p.admin > 0 && (player.adminLevel ?? 0) >= p.admin)
        return true;
    if (p.faction && p.faction > 0 && (player.factionType ?? 0) === p.faction)
        return true;
    if (p.vip && p.vip > 0 && (player.vipLevel ?? 0) >= p.vip)
        return true;
    if (p.helper && p.helper > 0 && (player.helperLevel ?? 0) >= p.helper)
        return true;
    return false;
}
/**
 * Oyuncunun erişebildiği tüm komutları döndürür
 * @param adminLevel Oyuncunun admin seviyesi
 * @returns Erişilebilir komutların listesi (handler olmadan)
 */
function getAvailableCommands(adminLevel) {
    const available = [];
    for (const [_, cmd] of commands) {
        const reqAdmin = cmd.permissions?.admin ?? 0;
        if (adminLevel >= reqAdmin) {
            available.push({
                name: cmd.name,
                syntax: cmd.syntax,
                permissions: cmd.permissions,
                description: cmd.description,
            });
        }
    }
    return available;
}
/**
 * Komutu çalıştırır (yetki kontrolü ile)
 * @param player Komutu çalıştıran oyuncu
 * @param message Tam komut mesajı (örn: "/setadmin 5 10")
 */
async function executeCommand(player, message) {
    if (!(0, safeEvent_1.isPlayerValid)(player))
        return;
    const parts = message.trim().split(/\s+/);
    const cmdName = parts[0].toLowerCase();
    const args = parts.slice(1);
    const cmd = commands.get(cmdName);
    if (!cmd) {
        player.outputChatBox(`!{#ef4444}[HATA] "${cmdName}" komutu bulunamadı. Tüm komutlar için: /admins`);
        return;
    }
    // Yetki kontrolü
    if (!hasCommandAccess(player, cmd)) {
        player.outputChatBox('!{#ef4444}[HATA] Bu komut için yetkiniz yok.');
        return;
    }
    // Komutu çalıştır
    try {
        await cmd.handler(player, args);
    }
    catch (error) {
        console.error(`[CMD] Komut hatası (${cmdName}):`, error);
        player.outputChatBox('!{#ef4444}[HATA] Komut çalıştırılırken bir hata oluştu.');
    }
}
/**
 * Komut sistemini başlatır (event listener'ları ekler)
 */
function initCommandSystem() {
    // Native bridge: CEF'te mp.invoke('chatMessage', ...) → server'da playerChat eventi
    (0, safeEvent_1.safeEvent)('playerChat', async (player, text) => {
        if (!(0, safeEvent_1.isPlayerValid)(player) || !player.characterId)
            return;
        if (typeof text !== 'string' || text.length === 0 || text.length > 256)
            return;
        const clean = text.trim().replace(/</g, '&lt;').replace(/>/g, '&gt;');
        if (!clean)
            return;
        const charName = player.characterName || player.accountUsername || player.name;
        // Araç ses yalıtımı: oyuncu araçtaysa tüm camlar kapalıysa mesaj [ARAÇ] prefix alır, menzil %50 azalır
        const inVehicle = !!player.vehicle;
        const allWindowsClosed = inVehicle && [0, 1, 2, 3].every((i) => !player.vehicle.getVariable(`window_${i}`));
        if (inVehicle && allWindowsClosed) {
            broadcastFadingMessage(player, 7.5, '#aaaaaa', '#444444', (color) => {
                return `${color}[ARAÇ] ${charName}: ${clean}`;
            });
        }
        else {
            // Normal konuşma (15 metre). Yakında Bembeyaz, uzakta Koyu Gri
            broadcastFadingMessage(player, 15.0, '#ffffff', '#555555', (color) => {
                return `${color}${charName} diyor ki: ${clean}`;
            });
        }
        console.log(`[CHAT] ${charName}: ${clean}`);
    });
    // Native bridge: CEF'te mp.invoke('command', 'kick 5 Sebep') → server'da playerCommand eventi
    (0, safeEvent_1.safeEvent)('playerCommand', async (player, cmdText) => {
        if (!(0, safeEvent_1.isPlayerValid)(player) || !player.characterId)
            return;
        if (typeof cmdText !== 'string' || cmdText.length === 0)
            return;
        // '/' olmadan geliyor, ekle
        const fullCmd = '/' + cmdText.trim();
        await executeCommand(player, fullCmd);
    });
    // Client-side tuş bağlamalarından gelen komutlar (mp.events.callRemote('runCommand', '/motor'))
    (0, safeEvent_1.safeEvent)('runCommand', async (player, cmdText) => {
        if (!(0, safeEvent_1.isPlayerValid)(player) || !player.characterId)
            return;
        if (typeof cmdText !== 'string' || cmdText.length === 0)
            return;
        // Slash olmadan veya ile gelebilir — normalize et
        const fullCmd = cmdText.trim().startsWith('/') ? cmdText.trim() : '/' + cmdText.trim();
        await executeCommand(player, fullCmd);
    });
    console.log('[CMD] Komut sistemi başlatıldı.');
    Promise.resolve().then(() => __importStar(require('./commands'))); // Alt modülleri yükle
}
//# sourceMappingURL=cmdHandler.js.map