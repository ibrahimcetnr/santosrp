"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initVehicleDamageEvents = initVehicleDamageEvents;
/**
 * SantosRP — Vehicle Damage Handler (Server-Side)
 * Araç kaporta hasarını dinler, şoförün client'ına deformasyon ölçümü tetikletir.
 */ const BinarySerializer_1 = require("../shared/BinarySerializer");
function initVehicleDamageEvents() {
    // Client tarafı kendi setInterval'i ile hasarı takip ediyor;
    // server 'vehicleDamage' eventi artık kullanılmıyor.
    mp.events.add('s:rvd', (player, vehicle, encoded) => {
        if (typeof encoded !== 'string' || encoded.length > 512)
            return;
        try {
            // Binary deserialize — JSON.parse yerine DataView (sıfır heap allocation)
            const data = BinarySerializer_1.BinarySerializer.decodeVehicleDamage(encoded);
            console.log(`[VEHICLE_DAMAGE] player=${player.name} vehicle=#${vehicle.getVariable('dbId') ?? vehicle.id}`, `windows=${data.windows.toString(2)} doors=${data.doors.toString(2)} tires=${data.tires.toString(2)} deforms=${data.deformations.length}`);
            // TODO: DB'ye kaydet
        }
        catch (err) {
            console.error('[VEHICLE_DAMAGE] Binary decode hatası:', err);
        }
    });
    console.log('[VEHICLE] s:rvd event listener aktif.');
}
//# sourceMappingURL=vehicleDamage.js.map