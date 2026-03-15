import { VehicleModelData } from '../shared/types';
export declare function initVehicleDataManager(): Promise<void>;
/**
 * Verilen modele ait temel araç verilerini döndürür.
 * @param model Araç modeli (örn: 'sultan', 'blista')
 */
export declare function getVehicleData(model: string): VehicleModelData | undefined;
//# sourceMappingURL=VehicleDataManager.d.ts.map