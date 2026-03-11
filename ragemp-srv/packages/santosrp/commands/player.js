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
(0, cmdHandler_1.registerCommand)({
    name: '/zaman',
    syntax: '',
    description: 'Toplam oynama sürenizi ve sonraki maaşa kalan süreyi gösterir',
}, (player) => {
    const playTime = player.accountPlayTime ?? 0;
    const payday = player.accountPayday ?? 0;
    const kalan = 60 - payday;
    const saatler = Math.floor(playTime / 60);
    const dakikalar = playTime % 60;
    const zamanStr = saatler > 0
        ? `${saatler} saat ${dakikalar} dakika`
        : `${dakikalar} dakika`;
    player.outputChatBox('!{#c9a84c}╔══════════════════════════════╗');
    player.outputChatBox('!{#c9a84c}║      !{#ffffff}OYNAMA İSTATİSTİĞİ      !{#c9a84c}║');
    player.outputChatBox('!{#c9a84c}╠══════════════════════════════╣');
    player.outputChatBox(`!{#c9a84c}║  !{#3b82f6}Toplam Süre: !{#ffffff}${zamanStr}`);
    player.outputChatBox(`!{#c9a84c}║  !{#22c55e}Sonraki Maaş: !{#ffffff}${kalan} dakika`);
    player.outputChatBox('!{#c9a84c}╚══════════════════════════════╝');
});
(0, cmdHandler_1.registerCommand)({
    name: '/seviye',
    syntax: '',
    description: 'Mevcut seviyenizi ve XP durumunuzu gösterir',
}, (player) => {
    const level = player.accountLevel ?? 1;
    const xp = player.accountXp ?? 0;
    const reqXp = level * 4;
    const progress = Math.min(Math.floor((xp / reqXp) * 20), 20);
    const bar = '█'.repeat(progress) + '░'.repeat(20 - progress);
    player.outputChatBox('!{#c9a84c}╔══════════════════════════════╗');
    player.outputChatBox('!{#c9a84c}║        !{#ffffff}SEVİYE BİLGİSİ         !{#c9a84c}║');
    player.outputChatBox('!{#c9a84c}╠══════════════════════════════╣');
    player.outputChatBox(`!{#c9a84c}║  !{#f59e0b}Seviye: !{#ffffff}${level}`);
    player.outputChatBox(`!{#c9a84c}║  !{#a78bfa}XP: !{#ffffff}${xp} / ${reqXp}`);
    player.outputChatBox(`!{#c9a84c}║  !{#6366f1}[!{#22c55e}${bar}!{#6366f1}]`);
    player.outputChatBox('!{#c9a84c}╚══════════════════════════════╝');
});
(0, cmdHandler_1.registerCommand)({
    name: '/f',
    syntax: '[Mesaj]',
    description: 'Birlik içi sohbet kanalı',
}, (player, args) => {
    if (args.length === 0) {
        player.outputChatBox('!{#fbbf24}[KULLANIM] /f [Mesaj]');
        return;
    }
    const factionId = player.getVariable('faction_id');
    if (!factionId) {
        player.outputChatBox('!{#ef4444}[BİRLİK] Bir birliğe üye değilsiniz.');
        return;
    }
    const message = args.join(' ').trim();
    if (!message)
        return;
    const charName = player.characterName || player.accountUsername || player.name;
    mp.players.forEach((p) => {
        try {
            if ((0, safeEvent_1.isPlayerValid)(p) && p.getVariable('faction_id') === factionId) {
                p.outputChatBox(`!{#c2a052}[BİRLİK] ${charName}: !{#ffffff}${message}`);
            }
        }
        catch { }
    });
});
//# sourceMappingURL=player.js.map