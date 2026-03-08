"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initVehicleDataManager = initVehicleDataManager;
exports.getVehicleData = getVehicleData;
/**
 * SantosRP — Vehicle Data Manager
 * Veritabanındaki `vehicles_data` tablosunu RAM'e (Map) önbellekler.
 */
const db_1 = require("./db");
// Araç modeli (string) -> Araç Verisi
const vehicleDataCache = new Map();
async function initVehicleDataManager() {
    console.log('[VEHICLE_DATA] Araç verileri veritabanından çekiliyor...');
    try {
        const result = await (0, db_1.query)('SELECT * FROM vehicles_data');
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
    }
    catch (err) {
        console.error('[VEHICLE_DATA] Veri çekme hatası:', err);
    }
}
/**
 * Verilen modele ait temel araç verilerini döndürür.
 * @param model Araç modeli (örn: 'sultan', 'blista')
 */
function getVehicleData(model) {
    return vehicleDataCache.get(model.toLowerCase());
}
//# sourceMappingURL=VehicleDataManager.js.map