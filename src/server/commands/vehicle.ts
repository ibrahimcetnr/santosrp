/**
 * SantosRP — Araç Komutları
 * /aracgetir [ID]     — Park edilmiş aracı dünyaya çıkarır (DB ID ile)
 * /araclarim          — Sahip olunan araçları listeler
 * /parket             — Aracı hızlı park moduna alır (30dk zamanlayıcı)
 * /motor  (/m)        — Motoru aç/kapat
 * /kilit  (/l)        — Kilidi aç/kapat
 * /kemer  (/k)        — Emniyet kemerini tak/çıkar
 */
import { registerCommand } from '../cmdHandler';
import { safeEvent, isPlayerValid } from '../utils/safeEvent';
import { query } from '../db';
import { getVehicleData } from '../VehicleDataManager';
import { startEngineLoop, stopEngineLoop } from '../VehicleManager';
import { openDualInventory, ContainerType } from '../inventory';

function findNearestVehicle(player: PlayerMp, maxDistance = 5): VehicleMp | null {
    let nearest: VehicleMp | null = null;
    let nearestDist = maxDistance;
    const pPos = player.position;

    mp.vehicles.toArray().forEach((v: VehicleMp) => {
        try {
            const vPos = v.position;
            const dist = Math.sqrt(
                Math.pow(pPos.x - vPos.x, 2) +
                Math.pow(pPos.y - vPos.y, 2) +
                Math.pow(pPos.z - vPos.z, 2)
            );
            if (dist <= nearestDist) {
                nearestDist = dist;
                nearest = v;
            }
        } catch {
            // noop
        }
    });

    return nearest;
}

function isVehicleLocked(vehicle: VehicleMp): boolean {
    return !!vehicle.locked || !!vehicle.getVariable('lockedStatus');
}

// ─── /aracgetir [ID] ─────────────────────────────────────────────────────────

registerCommand(
    {
        name:        '/aracgetir',
        syntax:      '[ID]',
        description: 'Park edilmiş aracınızı DB ID ile dünyaya çıkarır',
    },
    async (player: PlayerMp, args: string[]) => {
        if (args.length === 0) {
            player.outputChatBox('!{#fbbf24}[KULLANIM] /aracgetir [ID]');
            player.outputChatBox('!{#94a3b8}Araç ID öğrenmek için /araclarim komutunu kullanın.');
            return;
        }

        if (!player.characterId) {
            player.outputChatBox('!{#ef4444}[HATA] Karakter ile giriş yapmanız gerekiyor.');
            return;
        }

        const dbId = parseInt(args[0], 10);
        if (isNaN(dbId)) {
            player.outputChatBox('!{#ef4444}[HATA] Geçersiz araç ID.');
            return;
        }

        // Veritabanı sorgusu — sahiplik kontrolü dahil
        let result;
        try {
            result = await query(
                'SELECT * FROM vehicles WHERE id = $1 AND owner_id = $2 LIMIT 1',
                [dbId, player.characterId]
            );
        } catch (err) {
            console.error('[ARACGETIR] DB sorgu hatası:', err);
            if (isPlayerValid(player))
                player.outputChatBox('!{#ef4444}[HATA] Veritabanı hatası, lütfen tekrar deneyin.');
            return;
        }

        if (!isPlayerValid(player)) return;

        if (result.rows.length === 0) {
            player.outputChatBox(`!{#ef4444}[HATA] #${dbId} ID'li araca sahip değilsiniz.`);
            return;
        }

        const v = result.rows[0];

        if (!v.is_parked) {
            player.outputChatBox('!{#fbbf24}[BİLGİ] Bu araç zaten dünyada bulunuyor.');
            return;
        }

        // Pozisyon verisini parse et; bozuksa oyuncunun bulunduğu konuma getir
        let pos: { x: number; y: number; z: number; h?: number; dimension?: number };
        try {
            const raw = typeof v.position === 'string' ? JSON.parse(v.position) : v.position;
            if (!raw?.x || !raw?.y || !raw?.z) throw new Error('Eksik koordinat');
            pos = raw;
        } catch {
            const pp = player.position;
            pos = { x: pp.x, y: pp.y, z: pp.z, h: player.heading, dimension: player.dimension };
            player.outputChatBox('!{#fbbf24}[BİLGİ] Araç konum verisi bozuktu, araç yanınıza getirildi.');
        }

        // Aracı dünyaya spawn et
        let veh: VehicleMp;
        try {
            veh = mp.vehicles.new(v.model, new mp.Vector3(pos.x, pos.y, pos.z), {
                heading:     pos.h ?? 0,
                numberPlate: v.plate,
                dimension:   pos.dimension ?? 0,
            });
            veh.setVariable('dbId', v.id);
            veh.setVariable('owner_id', player.characterId);

            const vData = getVehicleData(v.model);
            if (vData) {
                veh.setVariable('fuel_type', vData.fuel_type);
                veh.setVariable('max_fuel', vData.fuel_tank_size);
                veh.setVariable('trunk_size', vData.trunk_size);
            }
            veh.setVariable('fuel', vData ? vData.fuel_tank_size : 65);
            veh.engine = false;
            veh.setVariable('engineStatus', false);
        } catch (err) {
            console.error('[ARACGETIR] Spawn hatası:', err);
            if (isPlayerValid(player))
                player.outputChatBox('!{#ef4444}[HATA] Araç spawn edilemedi.');
            return;
        }

        // Veritabanını güncelle
        try {
            await query('UPDATE vehicles SET is_parked = false WHERE id = $1', [v.id]);
        } catch (err) {
            console.error('[ARACGETIR] DB güncelleme hatası:', err);
        }

        if (!isPlayerValid(player)) return;
        player.outputChatBox(`!{#22c55e}[BAŞARILI] #${v.id} ID'li araç (${v.plate}) çıkarıldı.`);
        console.log(`[ARACGETIR] charId=${player.characterId} aracı çıkardı: dbId=${v.id} plate=${v.plate}`);
    }
);

// ─── /araclarim ───────────────────────────────────────────────────────────────

registerCommand(
    {
        name:        '/araclarim',
        syntax:      '',
        description: 'Sahip olduğunuz araçları listeler',
    },
    async (player: PlayerMp) => {
        if (!player.characterId) {
            player.outputChatBox('!{#ef4444}[HATA] Karakter ile giriş yapmanız gerekiyor.');
            return;
        }

        let result;
        try {
            result = await query(
                'SELECT id, model, plate, is_parked FROM vehicles WHERE owner_id = $1 ORDER BY id',
                [player.characterId]
            );
        } catch (err) {
            console.error('[ARACLARIM] DB sorgu hatası:', err);
            if (isPlayerValid(player))
                player.outputChatBox('!{#ef4444}[HATA] Veritabanı hatası.');
            return;
        }

        if (!isPlayerValid(player)) return;

        if (result.rows.length === 0) {
            player.outputChatBox('!{#94a3b8}[ARAÇLARIM] Kayıtlı aracınız bulunmuyor.');
            return;
        }

        player.outputChatBox(`!{#c9a84c}[ARAÇLARIM] Toplam ${result.rows.length} araç:`);
        for (const v of result.rows) {
            const durum = v.is_parked ? '!{#ef4444}Parkta' : '!{#22c55e}Dünyada';
            player.outputChatBox(`!{#94a3b8}  [ID: ${v.id}] !{#ffffff}${v.model} !{#94a3b8}| Plaka: !{#ffffff}${v.plate} !{#94a3b8}| Durum: ${durum}`);
        }
    }
);

registerCommand(
    {
        name: '/bagaj',
        syntax: '',
        description: 'Araç dışındayken yakınınızdaki aracın bagajını açar',
    },
    async (player: PlayerMp) => {
        if (!player.characterId) {
            player.outputChatBox('!{#ef4444}[HATA] Karakter ile giriş yapmanız gerekiyor.');
            return;
        }

        if (player.vehicle) {
            player.outputChatBox('!{#fbbf24}[HATA] Araç içindeyken bagaja erişemezsiniz.');
            return;
        }

        const vehicle = findNearestVehicle(player, 5);
        if (!vehicle) {
            player.outputChatBox('!{#fbbf24}[HATA] Yakında bagaj açılacak bir araç bulunamadı.');
            return;
        }

        if (isVehicleLocked(vehicle)) {
            player.outputChatBox('!{#ef4444}[HATA] Araç kilitli olduğu için bagaja erişemezsiniz.');
            return;
        }

        const dbIdRaw = vehicle.getVariable('dbId');
        const vehicleDbId = Number(dbIdRaw);
        if (!Number.isInteger(vehicleDbId) || vehicleDbId <= 0) {
            player.outputChatBox('!{#ef4444}[HATA] Bu aracın geçerli veritabanı ID bilgisi yok.');
            return;
        }

        const trunkSizeRaw = Number(vehicle.getVariable('trunk_size'));
        const trunkMaxWeight = Number.isFinite(trunkSizeRaw) && trunkSizeRaw > 0 ? trunkSizeRaw : 50;

        await openDualInventory(
            player,
            ContainerType.VEHICLE_TRUNK,
            vehicleDbId,
            'Araç Bagajı',
            trunkMaxWeight
        );
    }
);

registerCommand(
    {
        name: '/torpido',
        syntax: '',
        description: 'Araç içindeyken torpido envanterini açar',
    },
    async (player: PlayerMp) => {
        if (!player.characterId) {
            player.outputChatBox('!{#ef4444}[HATA] Karakter ile giriş yapmanız gerekiyor.');
            return;
        }

        const vehicle = player.vehicle;
        if (!vehicle) {
            player.outputChatBox('!{#fbbf24}[HATA] Araç dışındayken torpidoya erişemezsiniz.');
            return;
        }

        const dbIdRaw = vehicle.getVariable('dbId');
        const vehicleDbId = Number(dbIdRaw);
        if (!Number.isInteger(vehicleDbId) || vehicleDbId <= 0) {
            player.outputChatBox('!{#ef4444}[HATA] Bu aracın geçerli veritabanı ID bilgisi yok.');
            return;
        }

        await openDualInventory(
            player,
            ContainerType.VEHICLE_GLOVEBOX,
            vehicleDbId,
            'Araç Torpidosu',
            20
        );
    }
);

// ─── /parket ─────────────────────────────────────────────────────────────────

registerCommand(
    {
        name:        '/parket',
        syntax:      '',
        description: 'Aracı hızlı park moduna alır (araçtan iner inmez 30dk zamanlayıcı başlar)',
    },
    (player: PlayerMp) => {
        const vehicle = player.vehicle;

        if (!vehicle) {
            player.outputChatBox('!{#fbbf24}[HATA] Bir araçta olmanız gerekiyor.');
            return;
        }

        // RAGE:MP: sürücü koltuğu sayısal değeri -1
        if ((player.seat as unknown as number) !== 0) {
            player.outputChatBox('!{#fbbf24}[HATA] Yalnızca sürücü bu komutu kullanabilir.');
            return;
        }

        vehicle.setVariable('fast_park', true);
        player.outputChatBox(
            '!{#00ff00}[SİSTEM] Araç hızlı park moduna alındı. ' +
            'Araçtan iner inmez 30 dakika içinde otomatik parka çekilecektir.'
        );
    }
);

// ─── /motor (/m) ─────────────────────────────────────────────────────────────

for (const name of ['/motor', '/m']) {
    registerCommand(
        { name, syntax: '', description: 'Araç motorunu açar/kapatır' },
        (player: PlayerMp) => {
            const vehicle = player.vehicle;
            if (!vehicle) {
                player.outputChatBox('!{#fbbf24}[HATA] Bir araçta olmanız gerekiyor.');
                return;
            }
            if ((player.seat as unknown as number) !== 0) {
                player.outputChatBox('!{#fbbf24}[HATA] Yalnızca sürücü bu komutu kullanabilir.');
                return;
            }
            if (vehicle.getVariable('owner_id') !== player.characterId) {
                player.outputChatBox('!{#ef4444}[HATA] Bu aracın anahtarına sahip değilsiniz.');
                return;
            }

            vehicle.engine = !vehicle.engine;
            vehicle.setVariable('engineStatus', vehicle.engine);

            if (vehicle.engine) {
                startEngineLoop(vehicle);
                player.outputChatBox('!{#22c55e}[MOTOR] Motor çalıştırıldı.');
            } else {
                stopEngineLoop(vehicle.getVariable('dbId') as number);
                player.outputChatBox('!{#ef4444}[MOTOR] Motor kapatıldı.');
            }
        }
    );
}

// ─── /kilit (/l) ─────────────────────────────────────────────────────────────

for (const name of ['/kilit', '/l']) {
    registerCommand(
        { name, syntax: '', description: 'Araç kilidini açar/kapatır' },
        (player: PlayerMp) => {
            let vehicle = player.vehicle;

            // Araçta değilse 5 metre yakınındaki en yakın aracı bul
            if (!vehicle) {
                let nearest: VehicleMp | null = null;
                let nearestDist = 5.0;
                const pPos = player.position;
                mp.vehicles.toArray().forEach((v: VehicleMp) => {
                    try {
                        const vPos = v.position;
                        const dist = Math.sqrt(
                            Math.pow(pPos.x - vPos.x, 2) +
                            Math.pow(pPos.y - vPos.y, 2) +
                            Math.pow(pPos.z - vPos.z, 2)
                        );
                        if (dist < nearestDist) {
                            nearestDist = dist;
                            nearest = v;
                        }
                    } catch {}
                });

                if (!nearest) {
                    player.outputChatBox('!{#fbbf24}[HATA] Yakında kilitlenebilecek bir araç yok.');
                    return;
                }
                vehicle = nearest;
            }

            if (vehicle.getVariable('owner_id') !== player.characterId) {
                player.outputChatBox('!{#ef4444}[HATA] Bu aracın anahtarına sahip değilsiniz.');
                return;
            }

            vehicle.locked = !vehicle.locked;
            vehicle.setVariable('lockedStatus', vehicle.locked);

            if (vehicle.locked) {
                player.outputChatBox('!{#ef4444}[KİLİT] Araç kilitlendi.');
            } else {
                player.outputChatBox('!{#22c55e}[KİLİT] Araç kilidi açıldı.');
            }
        }
    );
}

// ─── /kemer (/k) ─────────────────────────────────────────────────────────────

for (const name of ['/kemer', '/k']) {
    registerCommand(
        { name, syntax: '', description: 'Emniyet kemerini takar/çıkarır' },
        (player: PlayerMp) => {
            if (!player.vehicle) {
                player.outputChatBox('!{#fbbf24}[HATA] Bir araçta olmanız gerekiyor.');
                return;
            }

            const current = !!player.getVariable('seatbelt');
            player.setVariable('seatbelt', !current);

            if (!current) {
                player.outputChatBox('!{#22c55e}[KEMER] Emniyet kemeri takıldı.');
            } else {
                player.outputChatBox('!{#ef4444}[KEMER] Emniyet kemeri çıkarıldı.');
            }
        }
    );
}

// ─── /kapilar [ID] ───────────────────────────────────────────────────────────

registerCommand(
    {
        name:        '/kapilar',
        syntax:      '[ID]',
        description: 'Araç kapısını açar/kapatır (0=Sürücü 1=Yolcu 2=ArkaSol 3=ArkaSağ 4=Kaput 5=Bagaj)',
    },
    (player: PlayerMp, args: string[]) => {
        if (!player.vehicle) {
            player.outputChatBox('!{#fbbf24}[HATA] Bir araçta olmanız gerekiyor.');
            return;
        }
        if (args.length === 0) {
            player.outputChatBox('!{#fbbf24}[KULLANIM] /kapilar [ID]');
            player.outputChatBox('!{#94a3b8}ID: 0=Sürücü  1=Yolcu  2=ArkaSol  3=ArkaSağ  4=Kaput  5=Bagaj');
            return;
        }
        const doorId = parseInt(args[0], 10);
        if (isNaN(doorId) || doorId < 0 || doorId > 5) {
            player.outputChatBox('!{#ef4444}[HATA] Geçersiz kapı ID (0-5).');
            return;
        }
        // Kapı state'ini toggle et
        const key = `door_${doorId}`;
        const vehicle = player.vehicle;
        const isOpen = !!vehicle.getVariable(key);
        vehicle.setVariable(key, !isOpen);
        const doorNames = ['Sürücü kapısı', 'Yolcu kapısı', 'Arka sol kapı', 'Arka sağ kapı', 'Kaput', 'Bagaj'];
        player.outputChatBox(`!{#22c55e}[ARAÇ] ${doorNames[doorId]} ${!isOpen ? 'açıldı' : 'kapatıldı'}.`);
    }
);

// ─── /acam [ID] ──────────────────────────────────────────────────────────────

registerCommand(
    {
        name:        '/acam',
        syntax:      '[ID]',
        description: 'Araç camını indirir/kaldırır (0=Sürücü 1=Yolcu 2=ArkaSol 3=ArkaSağ)',
    },
    (player: PlayerMp, args: string[]) => {
        if (!player.vehicle) {
            player.outputChatBox('!{#fbbf24}[HATA] Bir araçta olmanız gerekiyor.');
            return;
        }
        if (args.length === 0) {
            player.outputChatBox('!{#fbbf24}[KULLANIM] /acam [ID]');
            player.outputChatBox('!{#94a3b8}ID: 0=Sürücü  1=Yolcu  2=ArkaSol  3=ArkaSağ');
            return;
        }
        const winId = parseInt(args[0], 10);
        if (isNaN(winId) || winId < 0 || winId > 3) {
            player.outputChatBox('!{#ef4444}[HATA] Geçersiz cam ID (0-3).');
            return;
        }
        const key = `window_${winId}`;
        const vehicle = player.vehicle;
        const isDown = !!vehicle.getVariable(key);
        vehicle.setVariable(key, !isDown);
        const winNames = ['Sürücü camı', 'Yolcu camı', 'Arka sol cam', 'Arka sağ cam'];
        player.outputChatBox(`!{#22c55e}[ARAÇ] ${winNames[winId]} ${!isDown ? 'indirildi' : 'kaldırıldı'}.`);
    }
);

// ─── /aracbul ────────────────────────────────────────────────────────────────

registerCommand(
    {
        name:        '/aracbul',
        syntax:      '[ID]',
        description: 'Sahip olduğunuz aracın konumunu haritada gösterir',
    },
    async (player: PlayerMp, args: string[]) => {
        if (!player.characterId) {
            player.outputChatBox('!{#ef4444}[HATA] Karakter ile giriş yapmanız gerekiyor.');
            return;
        }

        if (args.length === 0) {
            player.outputChatBox('!{#fbbf24}[KULLANIM] /aracbul [ID]');
            player.outputChatBox('!{#94a3b8}Araç ID öğrenmek için /araclarim kullanın.');
            return;
        }

        const dbId = parseInt(args[0], 10);
        if (isNaN(dbId)) {
            player.outputChatBox('!{#ef4444}[HATA] Geçersiz araç ID.');
            return;
        }

        // Önce dünyada ara
        const worldVeh = mp.vehicles.toArray().find(
            (v: VehicleMp) => v.getVariable('dbId') === dbId && v.getVariable('owner_id') === player.characterId
        );

        let posData: { x: number; y: number; z: number; plate: string };

        if (worldVeh) {
            const p = worldVeh.position;
            posData = { x: p.x, y: p.y, z: p.z, plate: worldVeh.numberPlate };
        } else {
            // Dünyada yoksa DB'den son konumu al
            let result;
            try {
                result = await query(
                    'SELECT position, plate FROM vehicles WHERE id = $1 AND owner_id = $2 LIMIT 1',
                    [dbId, player.characterId]
                );
            } catch (err) {
                console.error('[ARACBUL] DB hatası:', err);
                if (isPlayerValid(player)) player.outputChatBox('!{#ef4444}[HATA] Veritabanı hatası.');
                return;
            }

            if (!isPlayerValid(player)) return;

            if (result.rows.length === 0) {
                player.outputChatBox(`!{#ef4444}[HATA] #${dbId} ID'li araca sahip değilsiniz.`);
                return;
            }

            const v = result.rows[0];
            let raw;
            try {
                raw = typeof v.position === 'string' ? JSON.parse(v.position) : v.position;
            } catch {
                player.outputChatBox('!{#ef4444}[HATA] Araç konum verisi okunamadı.');
                return;
            }

            if (!raw?.x || !raw?.y || !raw?.z) {
                player.outputChatBox('!{#fbbf24}[BİLGİ] Araç henüz konumlandırılmamış.');
                return;
            }

            posData = { x: raw.x, y: raw.y, z: raw.z, plate: v.plate };
        }

        player.call('client:vehicle:blip', [posData.x, posData.y, posData.z, posData.plate]);
        player.outputChatBox(`!{#22c55e}[ARAÇBUL] ${posData.plate} plakalı araç haritada işaretlendi (60 sn).`);
        console.log(`[ARACBUL] charId=${player.characterId} tracked dbId=${dbId}`);
    }
);

// ─── vehicle:indicator event ─────────────────────────────────────────────────

safeEvent('vehicle:indicator', (player: PlayerMp, type: unknown) => {
    if (!isPlayerValid(player) || !player.vehicle) return;
    const veh = player.vehicle;
    if (type === 'left') {
        const on = !veh.getVariable('indLeft');
        veh.setVariable('indLeft', on);
        veh.setVariable('indRight', false);
        veh.setVariable('indHazard', false);
    } else if (type === 'right') {
        const on = !veh.getVariable('indRight');
        veh.setVariable('indRight', on);
        veh.setVariable('indLeft', false);
        veh.setVariable('indHazard', false);
    } else if (type === 'hazard') {
        const on = !veh.getVariable('indHazard');
        veh.setVariable('indHazard', on);
        veh.setVariable('indLeft', on);
        veh.setVariable('indRight', on);
    }
});
