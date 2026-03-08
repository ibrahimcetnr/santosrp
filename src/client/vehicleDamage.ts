// --- src/client/vehicleDamage.ts DOSYASININ EN ALTINA EKLE ---

mp.events.add('client:extractVehicleDamage', (vehicle: VehicleMp) => {
    if (!vehicle || !mp.vehicles.exists(vehicle)) return;

    let damageData = {
        windows: [] as number[],
        doors: [] as number[],
        tires: [] as number[],
        deformations: [] as any[]
    };

    // 1. Camları Oku (0 = Sağlam, 1 = Kırık)
    for (let i = 0; i <= 7; i++) {
        let isIntact = mp.game.invoke('0x46E571A0E20D01F1', vehicle.handle, i);
        damageData.windows.push(isIntact ? 0 : 1);
    }

    // 2. Kapıları Oku (0-5 index)
    for (let i = 0; i <= 5; i++) {
        let isMissing = mp.game.invoke('0x3560EA4CEE78EDCE', vehicle.handle, i);
        damageData.doors.push(isMissing ? 1 : 0);
    }

    // 3. Lastikleri Oku
    let tireBones = [0, 1, 4, 5, 45, 46];
    for (let bone of tireBones) {
        let isBurst = mp.game.invoke('0xBAEB28E346258CB2', vehicle.handle, bone, false);
        damageData.tires.push(isBurst ? 1 : 0);
    }

    // 4. Göçükleri (Deformations) Oku - Senin Dinamik Boyut Algoritmanla!
    const modelDimensions = mp.game.gameplay.getModelDimensions(vehicle.model);
    const min = modelDimensions.minimum;
    const max = modelDimensions.maximum;

    const dynamicCheckPoints = [
        { name: 'Ön Tampon',        offset: { x: 0.0,   y: max.y, z: 0.0 } },
        { name: 'Arka Tampon',      offset: { x: 0.0,   y: min.y, z: 0.0 } },
        { name: 'Sol Ön Çamurluk',  offset: { x: min.x, y: max.y * 0.75, z: 0.0 } },
        { name: 'Sağ Ön Çamurluk',  offset: { x: max.x, y: max.y * 0.75, z: 0.0 } },
        { name: 'Sol Arka Çamurluk',offset: { x: min.x, y: min.y * 0.75, z: 0.0 } },
        { name: 'Sağ Arka Çamurluk',offset: { x: max.x, y: min.y * 0.75, z: 0.0 } },
        { name: 'Sol Kapı',         offset: { x: min.x, y: 0.0,   z: 0.0 } },
        { name: 'Sağ Kapı',         offset: { x: max.x, y: 0.0,   z: 0.0 } },
        { name: 'Tavan',            offset: { x: 0.0,   y: 0.0,   z: max.z } },
    ];

    for (const point of dynamicCheckPoints) {
        const def = vehicle.getDeformationAtPos(point.offset.x, point.offset.y, point.offset.z);
        const magnitude = Math.sqrt(def.x * def.x + def.y * def.y + def.z * def.z);

        if (magnitude > DEFORMATION_THRESHOLD) { // Bizim o 0.005 sınırımız
            damageData.deformations.push({
                x: point.offset.x, 
                y: point.offset.y, 
                z: point.offset.z, 
                amount: magnitude * 1500
            });
        }
    }

    // Hasar paketini kargola ve Server'a yolla!
    mp.events.callRemote('server:receiveVehicleDamage', vehicle, JSON.stringify(damageData));
});