/**
 * SantosRP — Vehicle Damage Handler (Server-Side)
 * Araç kaporta hasarını dinler, şoförün client'ına deformasyon ölçümü tetikletir.
 */
import { safeEvent, isPlayerValid } from './utils/safeEvent';
import { BinarySerializer } from '../shared/BinarySerializer';
export function initVehicleDamageEvents(): void {
    // Client tarafı kendi setInterval'i ile hasarı takip ediyor;
    // server 'vehicleDamage' eventi artık kullanılmıyor.

    safeEvent(
        's:rvd',
        (player: PlayerMp, vehicle: VehicleMp, encoded: string) => {
            if (typeof encoded !== 'string' || encoded.length > 512) return;
            try {
                // Binary deserialize — JSON.parse yerine DataView (sıfır heap allocation)
                const data = BinarySerializer.decodeVehicleDamage(encoded);
                console.log(
                    `[VEHICLE_DAMAGE] player=${player.name} vehicle=#${vehicle.getVariable('dbId') ?? vehicle.id}`,
                    `windows=${data.windows.toString(2)} doors=${data.doors.toString(2)} tires=${data.tires.toString(2)} deforms=${data.deformations.length}`
                );
                // TODO: DB'ye kaydet
            } catch (err) {
                console.error('[VEHICLE_DAMAGE] Binary decode hatası:', err);
            }
        }
    );

    console.log('[VEHICLE] s:rvd event listener aktif.');
}
