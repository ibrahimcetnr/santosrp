"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const cmdHandler_1 = require("../cmdHandler");
const safeEvent_1 = require("../utils/safeEvent");
(0, cmdHandler_1.registerCommand)({ name: '/me', syntax: '[Aksiyon]', description: 'Karakter eylemi (15m)', permissions: {} }, (player, args) => {
    if (args.length === 0) {
        player.outputChatBox('!{#fbbf24}[KULLANIM] /me [Aksiyon]');
        return;
    }
    const charName = player.characterName || player.accountUsername || player.name;
    const msg = args.join(' ').replace(/"(.*?)"/g, '!{#ffffff}"$1"!{#c2a2da}');
    (0, cmdHandler_1.broadcastFadingMessage)(player, 15.0, '#c2a2da', '#4a3060', (color) => {
        return `${color}* ${charName} ${msg}`;
    });
});
(0, cmdHandler_1.registerCommand)({ name: '/do', syntax: '[Durum]', description: 'Çevre durumu (15m)', permissions: {} }, (player, args) => {
    if (args.length === 0) {
        player.outputChatBox('!{#fbbf24}[KULLANIM] /do [Durum]');
        return;
    }
    const charName = player.characterName || player.accountUsername || player.name;
    const msg = args.join(' ').replace(/"(.*?)"/g, '!{#ffffff}"$1"!{#c2a2da}');
    (0, cmdHandler_1.broadcastFadingMessage)(player, 15.0, '#c2a2da', '#4a3060', (color) => {
        return `${color}* ${msg} (( ${charName} ))`;
    });
});
(0, cmdHandler_1.registerCommand)({ name: '/s', syntax: '[Mesaj]', description: 'Bağırma (30m)', permissions: {} }, (player, args) => {
    if (args.length === 0) {
        player.outputChatBox('!{#fbbf24}[KULLANIM] /s [Mesaj]');
        return;
    }
    const charName = player.characterName || player.accountUsername || player.name;
    (0, cmdHandler_1.broadcastFadingMessage)(player, 30.0, '#fbbf24', '#66541b', (color) => {
        return `${color}${charName} bağırır: ${args.join(' ')}!`;
    });
});
(0, cmdHandler_1.registerCommand)({ name: '/l', syntax: '[Mesaj]', description: 'Kısık Ses (3m)', permissions: {} }, (player, args) => {
    if (args.length === 0) {
        player.outputChatBox('!{#fbbf24}[KULLANIM] /l [Mesaj]');
        return;
    }
    const charName = player.characterName || player.accountUsername || player.name;
    (0, cmdHandler_1.broadcastFadingMessage)(player, 3.0, '#d1d5db', '#333333', (color) => {
        return `${color}${charName} kısık sesle: ${args.join(' ')}`;
    });
});
(0, cmdHandler_1.registerCommand)({ name: '/b', syntax: '[Mesaj]', description: 'Lokal OOC (15m)', permissions: {} }, (player, args) => {
    if (args.length === 0) {
        player.outputChatBox('!{#fbbf24}[KULLANIM] /b [Mesaj]');
        return;
    }
    const charName = player.characterName || player.accountUsername || player.name;
    (0, cmdHandler_1.broadcastInRange)(player, 15.0, `!{#b3b3b3}(( [OOC] ${charName}: ${args.join(' ')} ))`);
});
function sendPrivateMessage(player, args) {
    if (args.length < 2) {
        player.outputChatBox('!{#fbbf24}[KULLANIM] /pm [ID] [Mesaj]');
        return;
    }
    const targetId = parseInt(args[0], 10);
    if (isNaN(targetId)) {
        player.outputChatBox('!{#ef4444}[HATA] Geçersiz ID.');
        return;
    }
    const target = mp.players.at(targetId);
    if (!target || !(0, safeEvent_1.isPlayerValid)(target)) {
        player.outputChatBox('!{#ef4444}[HATA] Oyuncu bulunamadı.');
        return;
    }
    const charName = player.characterName || player.accountUsername || player.name;
    const targetName = target.characterName || target.accountUsername || target.name;
    const mesaj = args.slice(1).join(' ');
    player.outputChatBox(`!{#facc15}[PM] ${targetName} (${target.id}) kişisine: ${mesaj}`);
    target.outputChatBox(`!{#facc15}[PM] ${charName} (${player.id}) kişisinden: ${mesaj}`);
}
(0, cmdHandler_1.registerCommand)({ name: '/pm', syntax: '[ID] [Mesaj]', description: 'Belirtilen ID\'ye özel mesaj gönderir', permissions: {} }, sendPrivateMessage);
(0, cmdHandler_1.registerCommand)({ name: '/w', syntax: '[ID] [Mesaj]', description: 'Fısıldama (/pm takı adı)', permissions: {} }, sendPrivateMessage);
//# sourceMappingURL=roleplay.js.map