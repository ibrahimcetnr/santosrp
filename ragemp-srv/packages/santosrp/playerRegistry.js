"use strict";
/**
 * SantosRP — Global Online Player Registry
 *
 * ─ onlineCharacters: characterId → PlayerMp   O(1) lookup
 * ─ playerSessions:  player.id   → SessionData  V8 Hidden Class optimizasyonu
 *
 * V8 Hidden Class Neden Kritik?
 *   player.X = ... her çağrıda RAGE:MP native wrapper objesine yeni bir JS property
 *   ekler. Farklı oyuncular farklı sıralarda property alırsa V8, her unique shape
 *   için ayrı bir hidden class oluşturur → Inline Cache miss → CPU spike.
 *   SessionData: TÜM property'ler constructor'da 0 / '' ile declare edilir.
 *   1000 instance tek bir hidden class paylaşır → IC %100 hit → JIT hot path.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.playerSessions = exports.onlineCharacters = exports.SessionData = void 0;
exports.getSession = getSession;
/**
 * Tüm oyuncu oturum verisi için strict sınıf.
 * Tüm field'lar constructor'da başlangıç değeriyle atanır — sonradan yeni key eklenmez.
 */
class SessionData {
    accountId = 0;
    adminLevel = 0;
    accountUsername = '';
    characterId = 0;
    characterName = '';
    factionId = 0;
    factionRank = 0;
    accountLevel = 1;
    accountXp = 0;
    accountPayday = 0;
    accountPlayTime = 0;
}
exports.SessionData = SessionData;
/** characterId → PlayerMp  (O(1) lookup by character ID) */
exports.onlineCharacters = new Map();
/** player.id → SessionData  (tüm session verisi — player objesine eklenmez) */
exports.playerSessions = new Map();
/**
 * player.id için SessionData döndürür; yoksa yeni oluşturur (lazy init).
 * Tüm field'lar sınıf constructor'ında başlatıldığından V8 tek hidden class kullanır.
 */
function getSession(player) {
    let s = exports.playerSessions.get(player.id);
    if (!s) {
        s = new SessionData();
        exports.playerSessions.set(player.id, s);
    }
    return s;
}
//# sourceMappingURL=playerRegistry.js.map