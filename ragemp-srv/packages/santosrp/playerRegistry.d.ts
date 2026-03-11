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
export declare class SessionData {
    accountId: number;
    adminLevel: number;
    accountUsername: string;
    characterId: number;
    characterName: string;
    factionId: number;
    factionRank: number;
    accountLevel: number;
    accountXp: number;
    accountPayday: number;
    accountPlayTime: number;
}
/** characterId → PlayerMp  (O(1) lookup by character ID) */
export declare const onlineCharacters: Map<number, PlayerMp>;
/** player.id → SessionData  (tüm session verisi — player objesine eklenmez) */
export declare const playerSessions: Map<number, SessionData>;
/**
 * player.id için SessionData döndürür; yoksa yeni oluşturur (lazy init).
 * Tüm field'lar sınıf constructor'ında başlatıldığından V8 tek hidden class kullanır.
 */
export declare function getSession(player: PlayerMp): SessionData;
//# sourceMappingURL=playerRegistry.d.ts.map