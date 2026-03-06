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
/**
 * Kuyruğa karakter verisi ekle (üst üste gelirse merge eder)
 */
export declare function queueCharacterSave(data: CharSaveData): void;
/**
 * Belirli bir karakteri kuyruktan anlık kaydet (kritik durumlar için — tek oyuncu).
 * Thundering Herd senaryosunda (1000 disconnect) requestFlush kullanın.
 */
export declare function flushCharacter(characterId: number): Promise<void>;
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