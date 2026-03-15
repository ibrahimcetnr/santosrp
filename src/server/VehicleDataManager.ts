/**
 * SantosRP — Vehicle Data Manager
 * Veritabanındaki `vehicles_data` tablosunu RAM'e (Map) önbellekler.
 */
import { query } from './db';

import { VehicleModelData } from '../shared/types';

// Araç modeli (string) -> Araç Verisi
const vehicleDataCache = new Map<string, VehicleModelData>();

export async function initVehicleDataManager(): Promise<void> {
    console.log('[VEHICLE_DATA] Araç verileri veritabanından çekiliyor...');
    try {
        const result = await query('SELECT * FROM vehicles_data');
        
        result.rows.forEach((row) => {
            // Modelleri her zaman küçük harfle kaydediyoruz ki ararken sorun olmasın
            vehicleDataCache.set(row.model.toLowerCase(), {
                id: row.id,
                model: row.model,
                fuel_type: row.fuel_type,
                fuel_tank_size: row.fuel_tank_size,
                trunk_size: row.trunk_size,
                dealership_stock: row.dealership_stock,
                price: row.price
            });
        });

        console.log(`[VEHICLE_DATA] Başarıyla ${vehicleDataCache.size} araç modeli önbelleğe alındı.`);
    } catch (err) {
        console.error('[VEHICLE_DATA] Veri çekme hatası:', err);
    }
}

/**
 * Verilen modele ait temel araç verilerini döndürür.
 * @param model Araç modeli (örn: 'sultan', 'blista')
 */
export function getVehicleData(model: string): VehicleModelData | undefined {
    return vehicleDataCache.get(model.toLowerCase());
}