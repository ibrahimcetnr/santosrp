"use strict";
/**
 * SantosRP — Vehicle Damage Handler (Server-Side)
 * Araç kaporta hasarını dinler, şoförün client'ına deformasyon ölçümü tetikletir.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.initVehicleDamageEvents = initVehicleDamageEvents;
function initVehicleDamageEvents() {
    mp.events.add('vehicleDamage', (vehicle, bodyHealthLoss, _engineHealthLoss) => {
        if (bodyHealthLoss <= 0)
            return;
        const driver = mp.players.toArray().find((p) => p.vehicle === vehicle && p.seat === 0);
        if (driver) {
            driver.call('client:measureDeformation', [vehicle, bodyHealthLoss]);
        }
    });
    console.log('[VEHICLE] Araç hasar event listener aktif.');
}
//# sourceMappingURL=vehicleDamage.js.map