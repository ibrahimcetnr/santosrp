"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initHUD = initHUD;
/**
 * SantosRP - HUD Controller (Client)
 * Oyun içi HUD yönetimi: konum/yön, sunucu saati, para, özel chat sistemi
 */
const auth_1 = require("./auth");
const minimap_1 = require("./minimap");
let chatOpen = false;
let hudActive = false;
// ── Yardımcı Fonksiyonlar ─────────────────────────────────────────────────────
function formatMoney(amount) {
    return String(Math.floor(amount)).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + '$';
}
function headingToDirection(h) {
    // GTA V: 0=Kuzey, counterclockwise artar (Batı→Güney→Doğu)
    const dirs = ['K', 'KB', 'B', 'GB', 'G', 'GD', 'D', 'KD'];
    return dirs[Math.round(((h % 360) + 360) % 360 / 45) % 8];
}
/** Browser'daki window fonksiyonunu güvenli şekilde çağırır */
function sendToHUD(fn, data) {
    const browser = (0, auth_1.getGameBrowser)();
    if (!browser)
        return;
    try {
        browser.execute(`window.${fn} && window.${fn}(${JSON.stringify(data)})`);
    }
    catch { }
}
/** RAGE:MP player.zone property ile bölge adını döndürür */
function getZoneName() {
    try {
        const raw = mp.players.local.zone;
        if (raw && typeof raw === 'string' && raw.length > 0) {
            // "HAWICK" → "Hawick", "EAST_LS" → "East Ls"
            return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase().replace(/_/g, ' ');
        }
    }
    catch { }
    return '';
}
// ── Konum & Yön Poll ──────────────────────────────────────────────────────────
let pollInterval = null;
function startPolling() {
    if (pollInterval)
        clearInterval(pollInterval);
    pollInterval = setInterval(() => {
        if (!(0, auth_1.getGameBrowser)())
            return;
        try {
            const location = getZoneName();
            const direction = headingToDirection(mp.players.local.heading);
            if (location)
                sendToHUD('hudUpdateLocation', { location, direction });
        }
        catch { }
    }, 2000);
}
// ── Chat Yönetimi ─────────────────────────────────────────────────────────────
function openChat() {
    chatOpen = true;
    mp.gui.cursor.show(true, true);
    sendToHUD('openChat', null);
}
// ── initHUD ───────────────────────────────────────────────────────────────────
function initHUD() {
    // Oyun HUD başlatma (server:playCharacter / server:saveCharacterAppearance sonrası)
    mp.events.add('client:startHUD', (charName, playerId, money) => {
        hudActive = true;
        // Browser zaten canlı (hideLoginUI yok etmedi); view='playing' olmuş durumda.
        // Kısa gecikme: Svelte'nin DOM güncellemesini tamamlamasını bekle.
        setTimeout(() => {
            sendToHUD('hudInit', { charName, playerId, money: formatMoney(money) });
            // Minimap pos sync
            const anchor = (0, minimap_1.getMinimapAnchor)();
            sendToHUD('syncMinimap', anchor);
        }, 800);
        startPolling();
    });
    // Sunucu saat/tarih yayını
    mp.events.add('client:hudTime', (timeStr, dateStr) => {
        sendToHUD('hudUpdateTime', { time: timeStr, date: dateStr });
    });
    // Para güncelleme (alışveriş, iş, vb.)
    mp.events.add('client:hudMoney', (amount) => {
        sendToHUD('hudUpdateMoney', { money: formatMoney(amount) });
    });
    // Chat mesajı (sunucudan yönlendirilen)
    mp.events.add('client:hudMessage', (msgType, text) => {
        sendToHUD('hudMessage', { type: msgType, text });
    });
    // Chat kapatıldı — cursor gizle
    mp.events.add('client:chatClosed', () => {
        chatOpen = false;
        mp.gui.cursor.show(false, false);
    });
    // UI'dan T tu\u015fu: cursor g\u00f6ster
    mp.events.add('client:chatOpened', () => {
        if (!hudActive)
            return;
        chatOpen = true;
        mp.gui.cursor.show(true, true);
    });
    // Mesaj gönderildi — cursor gizle ve sunucuya ilet
    mp.events.add('client:chatSend', (message) => {
        chatOpen = false;
        mp.gui.cursor.show(false, false);
        if (message && message.trim().length > 0) {
            mp.events.callRemote('server:chatMessage', message.trim());
        }
    });
    // T tuşu algılama: render loop'ta her frame INPUT_CHAT (245) kontrol et.
    // mp.gui.chat.activate(false) native chat'i kapattığından bu kontrole düşer.
    mp.events.add('render', () => {
        if (!hudActive || chatOpen)
            return;
        try {
            // Native INPUT_CHAT kontrolünü her frame devre dışı bırak (245)
            mp.game.controls.disableControlAction(255, 245, true);
            if (mp.game.controls.isControlJustPressed(255, 245)) {
                openChat();
            }
        }
        catch { }
    });
}
//# sourceMappingURL=hud.js.map