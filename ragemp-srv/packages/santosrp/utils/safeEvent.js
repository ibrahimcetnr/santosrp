"use strict";
/**
 * SantosRP - Safe Async Event Wrapper
 *
 * Tüm async RAGE:MP event handler'larını sarmalar.
 * Yakalanmayan Promise rejection'ları sunucuyu çökertmez;
 * konsola loglanır ve hayatta kalır.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isPlayerValid = isPlayerValid;
exports.safeEvent = safeEvent;
/**
 * Oyuncunun hâlâ geçerli (bağlı) olup olmadığını kontrol eder.
 * Async DB/bcrypt işlemi sırasında disconnect olabileceği için
 * player.call() öncesinde mutlaka çağrılmalıdır.
 */
function isPlayerValid(player) {
    try {
        return !!(player && mp.players.exists(player));
    }
    catch {
        return false;
    }
}
/**
 * Async RAGE:MP event handler'larını güvenli şekilde sarmalar.
 * Hata fırlatan handler sunucu crash'ine yol açmaz.
 *
 * Kullanım:
 *   safeEvent('server:myEvent', async (player, arg1) => { ... });
 */
function safeEvent(name, handler) {
    mp.events.add(name, (...args) => {
        // İlk argüman player ise veri tipi kontrolü yap
        const player = args[0];
        if (player && typeof player === 'object' && 'name' in player) {
            if (!mp.players.exists(player)) {
                console.error(`[CHAT-FAIL] SafeEvent reddedildi! Event: ${name} Player: ${player.name}`);
                return;
            }
        }
        try {
            const result = handler(...args);
            if (result && typeof result.catch === 'function') {
                result.catch((err) => {
                    console.error(`[SAFE-EVENT][${name}] Yakalanmamış hata:`, err);
                });
            }
        }
        catch (err) {
            console.error(`[SAFE-EVENT][${name}] Senkron hata:`, err);
        }
    });
}
//# sourceMappingURL=safeEvent.js.map