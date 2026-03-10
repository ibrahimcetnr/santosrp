declare class FactionManager {
    private factions;
    /** DB'den tüm birlikleri çekip cache'e yükler */
    loadAllFactions(): Promise<void>;
    /** Cache'den birliği döndürür. Bulunamazsa null. */
    getFaction(id: number): Record<string, unknown> | null;
    /** Cache'deki tüm birlikleri döndürür */
    getAllFactions(): Record<string, unknown>[];
}
export declare const factionManager: FactionManager;
export declare function initFactionManager(): void;
export {};
//# sourceMappingURL=FactionManager.d.ts.map