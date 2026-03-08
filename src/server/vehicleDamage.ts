/**
 * SantosRP — Vehicle Damage Handler (Server-Side)
 * Araç kaporta hasarını dinler, şoförün client'ına deformasyon ölçümü tetikletir.
 */

export function initVehicleDamageEvents(): void {
    mp.events.add(
        'vehicleDamage',
        (vehicle: VehicleMp, bodyHealthLoss: number, _engineHealthLoss: number) => {
            if (bodyHealthLoss <= 0) return;

            const driver = mp.players.toArray().find(
                (p: PlayerMp) => p.vehicle === vehicle && p.seat === 0
            );

            if (driver) {
                driver.call('client:measureDeformation', [vehicle, bodyHealthLoss]);
            }
        }
    );

    console.log('[VEHICLE] Araç hasar event listener aktif.');
}
