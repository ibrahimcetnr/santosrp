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

/**
 * Tüm oyuncu oturum verisi için strict sınıf.
 * Tüm field'lar constructor'da başlangıç değeriyle atanır — sonradan yeni key eklenmez.
 */
export class SessionData {
    accountId:       number = 0;
    adminLevel:      number = 0;
    accountUsername: string = '';
    characterId:     number = 0;
    characterName:   string = '';
    factionId:       number = 0;
    factionRank:     number = 0;
    accountLevel:    number = 1;
    accountXp:       number = 0;
    accountPayday:   number = 0;
    accountPlayTime: number = 0;
}

/** characterId → PlayerMp  (O(1) lookup by character ID) */
export const onlineCharacters = new Map<number, PlayerMp>();

/** player.id → SessionData  (tüm session verisi — player objesine eklenmez) */
export const playerSessions = new Map<number, SessionData>();

/**
 * player.id için SessionData döndürür; yoksa yeni oluşturur (lazy init).
 * Tüm field'lar sınıf constructor'ında başlatıldığından V8 tek hidden class kullanır.
 */
export function getSession(player: PlayerMp): SessionData {
    let s = playerSessions.get(player.id);
    if (!s) {
        s = new SessionData();
        playerSessions.set(player.id, s);
    }
    return s;
}
