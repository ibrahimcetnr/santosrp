/**
 * SantosRP — Vehicle Damage Handler (Server-Side)
 * Araç kaporta hasarını dinler, şoförün client'ına deformasyon ölçümü tetikletir.
 */

export function initVehicleDamageEvents(): void {
    // Client tarafı kendi setInterval'i ile hasarı takip ediyor;
    // server 'vehicleDamage' eventi artık kullanılmıyor.

    mp.events.add(
        'server:receiveVehicleDamage',
        (player: PlayerMp, vehicle: VehicleMp, damageJson: string) => {
            if (typeof damageJson !== 'string' || damageJson.length > 2500) return;
            try {
                const data = JSON.parse(damageJson);
                console.log(
                    `[VEHICLE_DAMAGE] player=${player.name} vehicle=#${vehicle.getVariable('dbId') ?? vehicle.id}`,
                    JSON.stringify(data)
                );
                // TODO: DB'ye kaydet
            } catch (err) {
                console.error('[VEHICLE_DAMAGE] JSON parse hatası:', err);
            }
        }
    );

    console.log('[VEHICLE] server:receiveVehicleDamage event listener aktif.');
}
