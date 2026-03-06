"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const cmdHandler_1 = require("../cmdHandler");
const safeEvent_1 = require("../utils/safeEvent");
(0, cmdHandler_1.registerCommand)({
    name: '/report',
    syntax: '[Mesaj]',
    description: 'Yöneticilere rapor gönderir',
}, (player, args) => {
    if (args.length === 0) {
        player.outputChatBox('!{#fbbf24}[KULLANIM] /report [Mesaj]');
        return;
    }
    const reportMessage = args.join(' ');
    const charName = player.characterName || player.accountUsername || player.name;
    let notified = 0;
    mp.players.forEach((admin) => {
        try {
            if ((0, safeEvent_1.isPlayerValid)(admin) && (admin.adminLevel ?? 0) >= 1) {
                admin.outputChatBox(`!{#ef4444}[REPORT] ${charName} (ID: ${player.id}): !{#ffffff}${reportMessage}`);
                notified++;
            }
        }
        catch { }
    });
    player.outputChatBox('!{#22c55e}[BAŞARILI] Raporunuz yöneticilere iletildi.');
    console.log(`[REPORT] ${charName} (ID: ${player.id}): ${reportMessage}`);
    if (notified === 0) {
        player.outputChatBox('!{#fbbf24}[BİLGİ] Şu anda çevrimiçi yetkili bulunmuyor.');
    }
});
(0, cmdHandler_1.registerCommand)({
    name: '/admins',
    syntax: '',
    description: 'Çevrimiçi yöneticileri listeler',
}, (player, _args) => {
    const admins = [];
    mp.players.forEach((p) => {
        try {
            if ((0, safeEvent_1.isPlayerValid)(p) && p.characterId) {
                const level = p.adminLevel ?? 0;
                if (level > 0) {
                    const name = p.characterName || p.accountUsername || p.name;
                    admins.push(`${name} (ID: ${p.id}, Seviye: ${level})`);
                }
            }
        }
        catch { }
    });
    if (admins.length === 0) {
        player.outputChatBox('!{#fbbf24}[BİLGİ] Şu anda çevrimiçi yetkili bulunmuyor.');
    }
    else {
        player.outputChatBox('!{#c9a84c}[YETKİLİLER] Çevrimiçi yöneticiler:');
        admins.forEach((admin) => {
            player.outputChatBox(`!{#ffffff}• ${admin}`);
        });
    }
});
//# sourceMappingURL=player.js.map