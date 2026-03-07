interface CharSaveData {
    characterId: number;
    money?: number;
    bank?: number;
    position?: {
        x: number;
        y: number;
        z: number;
    };
    job?: string | null;
}
interface AccountSaveData {
    accountId: number;
    level?: number;
    xp?: number;
    payday?: number;
    play_time?: number;
}
/**
 * Kuyruğa karakter verisi ekle (üst üste gelirse merge eder)
 */
export declare function queueCharacterSave(data: CharSaveData): void;
/**
 * Kuyruğa hesap (account) verisi ekle (level, xp, payday, play_time)
 */
export declare function queueAccountSave(data: AccountSaveData): void;
/**
 * Kuyruğa karakter sayısal delta ekle (+=).
 * Aynı karaktere birden fazla para/banka güncellemesi geldiğinde
 * değerler birikerek doğru toplam hesaplanır (üst üste yazma olmaz).
 * DB yazımında `SET money = money + $delta` kullanılır.
 */
export declare function updateNumericData(characterId: number, delta: {
    money?: number;
    bank?: number;
}): void;
/**
 * Hesap XP delta ekle (+=).
 */
export declare function updateAccountNumericData(accountId: number, delta: {
    xp?: number;
}): void;
/**
 * Belirli bir karakteri kuyruktan anlık kaydet (kritik durumlar için — tek oyuncu).
 * Thundering Herd senaryosunda (1000 disconnect) requestFlush kullanın.
 */
export declare function flushCharacter(characterId: number): Promise<void>;
/**
 * Disconnect'te anlık, garantili kayıt (Instant Disconnect Save).
 * requestFlush'un 500ms debounce penceresinin aksine veriyi hemen yazar;
 * süreç kapanmadan veya pointer geçersiz olmadan önce DB'ye ulaşır.
 * pendingFlushIds'den de temizler — debounce kuyruğunda çift yazma olmaz.
 */
export declare function flushCharacterSync(characterId: number): Promise<void>;
export declare function requestFlush(characterId: number): void;
/**
 * Tüm kuyruğu hemen kaydet (sunucu kapatılırken).
 * SIGTERM race condition önlemi:
 *   1. Debounce timer'ı iptal et — SIGTERM + timer çakışması engellenir
 *   2. pendingFlushIds'i temizle   — ID'ler saveQueue'da zaten mevcut
 *   3. Tüm kuyruğu chunk'lı flush et
 */
export declare function flushAll(): Promise<void>;
/**
 * Periyodik save döngüsünü başlat
 */
export declare function startSaveQueue(): void;
export declare function stopSaveQueue(): void;
export {};
//# sourceMappingURL=save-queue.d.ts.map