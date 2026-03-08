export declare function stopEngineLoop(dbId: number): void;
export declare function startEngineLoop(vehicle: VehicleMp): void;
/**
 * Dünyada bulunan tüm aktif araçların pozisyon ve metadata verilerini DB'ye yazar.
 * Sunucu kapatılırken ve 5 dakikada bir çağrılır.
 */
export declare function saveAllVehicles(): Promise<void>;
/**
 * Sunucu kapanırken dışarıda kalan araçları temizler.
 * index.ts'de initVehicleManager() öncesinde await ile çağrılmalı.
 */
export declare function recoverVehicles(): Promise<void>;
export declare function initVehicleManager(): void;
//# sourceMappingURL=VehicleManager.d.ts.map