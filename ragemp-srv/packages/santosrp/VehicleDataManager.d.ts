export interface VehicleData {
    id: number;
    model: string;
    fuel_type: string;
    fuel_tank_size: number;
    trunk_size: number;
    dealership_stock: number;
    price: number;
}
export declare function initVehicleDataManager(): Promise<void>;
/**
 * Verilen modele ait temel araç verilerini döndürür.
 * @param model Araç modeli (örn: 'sultan', 'blista')
 */
export declare function getVehicleData(model: string): VehicleData | undefined;
//# sourceMappingURL=VehicleDataManager.d.ts.map