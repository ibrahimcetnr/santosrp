/**
 * SantosRP — Vehicle Damage / Collision Monitor (Client)
 * RAGE:MP 1.1+ uyumlu, tamamen Client-Side çalışan Dinamik Hasar Algılayıcı.
 * Server eventi deprecated olduğu için, optimize edilmiş Interval kullanır.
 */import { BinarySerializer } from '../shared/BinarySerializer';
const DEFORMATION_THRESHOLD = 0.005;
const POLL_INTERVAL_MS      = 250; // Saniyede 4 kez kontrol
const DRIVER_SEAT           = -1;  // Şoför koltuğu

let lastBodyHealth = 1000;
let lastVehicle: VehicleMp | null = null;
let damageTimer: ReturnType<typeof setInterval> | null = null;
let isMonitorInitialized = false;
let cachedDimensions: { minimum: Vector3Mp, maximum: Vector3Mp } | null = null;

function checkVehicleDamage(): void {
    const player  = mp.players.local;
    const vehicle = player.vehicle;

    // Sadece oyuncu araçtaysa ve ŞOFÖRSE çalışır (Mükemmel Optimizasyon)
    if (vehicle && vehicle.getPedInSeat(DRIVER_SEAT) === player.handle) {
        // Ghost crash koruması: yeni araca ilk binişte hasar bazını sıfırla
        if (lastVehicle !== vehicle) {
            lastVehicle = vehicle;
            lastBodyHealth = vehicle.getBodyHealth();
            cachedDimensions = mp.game.gameplay.getModelDimensions(vehicle.model);
            return;
        }

        const currentHealth = vehicle.getBodyHealth();

        // Çarpışma Tespiti
        if (currentHealth < lastBodyHealth) {
            const healthLoss = lastBodyHealth - currentHealth;
            
            mp.gui.chat.push(
                `!{#ff5555}[ÇARPIŞMA] Kaporta hasar aldı! Kayıp: ${healthLoss.toFixed(1)} | Kalan Can: ${currentHealth.toFixed(0)}`
            );

            // GTA Motorunun metali yamultması için 150ms süre tanıyoruz
            setTimeout(() => {
                // Güvenlik: Araç o 150ms içinde silinmiş olabilir
                if (!vehicle || !mp.vehicles.exists(vehicle)) return;

                // 1. Dinamik Boyutları Çek (Bison ile Panto ayrımını yapan kod)
                const dims = cachedDimensions ?? mp.game.gameplay.getModelDimensions(vehicle.model);
                const min = dims.minimum;
                const max = dims.maximum;

                // 2. Dinamik Örümcek Ağı (Arabanın tam köşeleri)
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

                // 3. Hasar Tarama İşlemi
                for (const point of dynamicCheckPoints) {
                    const def = vehicle.getDeformationAtPos(
                        point.offset.x,
                        point.offset.y,
                        point.offset.z
                    );

                    const magnitude = Math.sqrt(def.x * def.x + def.y * def.y + def.z * def.z);

                    if (magnitude > DEFORMATION_THRESHOLD) {
                        const amount = (magnitude * 1500).toFixed(2);
                        mp.gui.chat.push(`!{#ffff00}[GÖÇÜK] Bölge: ${point.name} | Şiddet: ${amount}`);
                    }
                }

                // Hasar verisini topla ve sunucuya gönder
                extractVehicleDamage(vehicle);
            }, 150);
        }

        // Son canı güncelle ki sürekli chat'i spamlamasın
        lastBodyHealth = currentHealth;
    } else {
        // Araçtan inince veya yolcuyken canı sıfırla
        lastBodyHealth = 1000;
        lastVehicle = null;
        cachedDimensions = null;
    }
}

// Ana dosyadan (index.ts) çağrılacak başlatıcı fonksiyon
export function initVehicleDamageMonitor(): void {
    if (isMonitorInitialized) return; // Çift tetikleme koruması
    isMonitorInitialized = true;

    // Döngüyü başlat
    damageTimer = setInterval(checkVehicleDamage, POLL_INTERVAL_MS);
    console.log('[CLIENT] Dinamik Araç Hasar Monitorü Başlatıldı (Interval Modu).');
}

// --- Hasar Veri Toplama Fonksiyonu ---
mp._events.add('incomingDamage', (sourceEntity, sourcePlayer, targetEntity, weapon, boneIndex, damage) => {
    if(targetEntity.type === 'player' && damage > 5) mp.game.graphics.startScreenEffect("ExplosionJosh3", 0, true);
});

// src/client/vehicleDamage.ts veya damage.ts
// Sadece oyuna ilk girildiğinde 1 kere çalıştırılır: Kafadan tek yeme (Headshot) motorunu kapatır.
// Bu sayede Wasted ekranı bypass'ı garantiye alınır.

// Hasar yakalama eventi
let isWounded = false;

// Kafadan tek yeme (Headshot) motorunu baştan kapatıyoruz
mp.events.add('playerReady', () => {
    mp.game.invoke('0x8C0DCD641883B643', mp.players.local.handle, 0.0);
    mp.players.local.health = 100; // RAGE:MP'de tam can 100'dür
});

mp._events.add('incomingDamage', (sourceEntity, sourcePlayer, targetEntity, weapon, boneIndex, damage) => {
    if (targetEntity === mp.players.local) {
        
        // 1. HAYATİ KORUMA: Karakter zaten yerde yaralıysa, 
        // gelen diğer mermilerin oyunu "Wasted" ekranına sokmasını tamamen engelleriz!
        if (isWounded) return true;

        let damageToApply = 20; // Tüm silahlar sabit 20 vurur
        
        let currentArmor = mp.players.local.armour;
        let currentHealth = mp.players.local.health;

        // 2. Zırh (Armor) Kontrolü
        if (currentArmor > 0) {
            if (currentArmor >= damageToApply) {
                mp.players.local.armour = currentArmor - damageToApply;
                damageToApply = 0;
            } else {
                damageToApply -= currentArmor;
                mp.players.local.armour = 0;
            }
        }

        // 3. Cana (Health) Hasar Verme
        if (damageToApply > 0) {
            let newHealth = currentHealth - damageToApply;

            // RAGE:MP'de can 0'a düştüğünde oyun biter.
            if (newHealth <= 0) {
                
                // Karakteri script bazlı yaralı durumuna alıyoruz
                isWounded = true;

                // WASTED EKRANINI ENGELLEYEN SİHİR:
                // Canını 0 yapmak yerine güvenli bir seviyede (50) bırakıyoruz. 
                // Oyun motoru karakterin ölmediğini sanıyor, Wasted ekranı asla çıkmıyor!
                mp.players.local.health = 50; 

                // Merminin şiddetiyle gerçekçi fiziksel düşüş (Bez Bebek / Ragdoll)
                mp.players.local.setToRagdoll(4000, 4000, 0, true, true, false);

                // Sunucuya "Ben yaralandım, animasyonumu başlat" komutunu yolla
                mp.events.callRemote('server:playerDowned', weapon, boneIndex);
                
            } else {
                // Ölmediyse sadece canını azalt
                mp.players.local.health = newHealth;
            }
        }

        // 4. GTA V'in kendi hasar hesaplamasını %100 geçersiz kıl.
        return true; 
    }
});

// Hastanede veya bir admin tarafından canlandırıldığında state'i sıfırla
mp.events.add('client:revivePlayer', () => {
    isWounded = false;
    mp.players.local.health = 100;
    mp.players.local.clearTasksImmediately(); // Animasyonu/Ragdoll'u temizle
});

function extractVehicleDamage(vehicle: VehicleMp): void {
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
    const dims = cachedDimensions ?? mp.game.gameplay.getModelDimensions(vehicle.model);
    const min = dims.minimum;
    const max = dims.maximum;

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

    // Hasar paketini binary'ye sıkıştır ve Server'a yolla (JSON'a kıyasla ~%50-70 daha küçük)
    const windowsMask = BinarySerializer.packBools(damageData.windows.map((v: number) => v === 1));
    const doorsMask   = BinarySerializer.packBools(damageData.doors.map((v: number) => v === 1));
    const tiresMask   = BinarySerializer.packBools(damageData.tires.map((v: number) => v === 1));
    const encoded = BinarySerializer.encodeVehicleDamage({
        windows:      windowsMask,
        doors:        doorsMask,
        tires:        tiresMask,
        deformations: damageData.deformations,
    });
    mp.events.callRemote('s:rvd', vehicle, encoded);
}