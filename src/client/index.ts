/**
 * RAGE:MP - Client Entry Point
 * SantosRP Client-Tarafı Ana Dosyası
 */
import { registerClientAuthEvents } from './auth';
import { initHUD } from './hud';
import { initNametags } from './nametags';
import { initFaction } from './faction';
import { initScrollMenu } from './scrollMenu';

// RAGE native chat'i en erken anda kapat — "Multiplayer Started" mesajını engeller

// ─── Global Blip Yöneticisi ───────────────────────────────────────────────────
// Her event'te ayrı setInterval açmak Memory Leak yaratır.
// Tek bir global döngü tüm aktif blipleri yönetir.
interface TrackedBlip {
    blip: any;
    x: number;
    y: number;
    z: number;
    expiresAt: number;
}
const activeBlips = new Set<TrackedBlip>();

setInterval(() => {
    if (activeBlips.size === 0) return;
    const now = Date.now();
    const pPos = mp.players.local.position;
    for (const entry of activeBlips) {
        const dx = pPos.x - entry.x;
        const dy = pPos.y - entry.y;
        const dz = pPos.z - entry.z;
        const distSq = dx * dx + dy * dy + dz * dz; // sqrt yok — çarpım yeterli (30m → 900)
        if (distSq < 900 || now >= entry.expiresAt) {
            try { entry.blip.destroy(); } catch {}
            activeBlips.delete(entry);
        }
    }
}, 2000);

mp.gui.chat.activate(false);
mp.gui.chat.show(false);
mp.game.ui.displayHud(false);
mp.game.ui.displayRadar(false);

// ─── Genel RP Ayarları ────────────────────────────────────────────────────────

// Ortam seslerini kıs
mp.game.audio.startAudioScene("CHARACTER_CHANGE_IN_SKY_SCENE");

// AFK kamerasını engelle (daha seyrek tetikleme — idle spike azaltma)
setInterval(() => mp.game.invoke("0xF4F2C0D4EE209E20"), 120000);

// Ölüm sonrası ekran kararmasını kapat
mp.game.gameplay.setFadeOutAfterDeath(false);

// Otomatik can yenilenmesini kapat
mp.game.player.setHealthRechargeMultiplier(0.0);

// Kontrol bug'ını önle
mp.game.controls.setControlNormal(27, 86, 1.0);

// Varsayılan motor davranışını kapat
mp.game.vehicle.defaultEngineBehaviour = false;

// Ped'in kontağı otomatik çevirmesini engelle
mp.players.local.setConfigFlag(429, true);

// Auth sistemini başlat
registerClientAuthEvents();

// HUD sistemini başlat
initHUD();

// Nametag sistemini başlat (modül yüklenince render event'i kaydeder)
initNametags();

// Birlik sistemini başlat
initFaction();

// Scroll (etkileşim) menüsünü başlat
initScrollMenu();

mp.events.add('browserCreated', (browser: BrowserMp) => {
  console.log('[CLIENT] Browser oluşturuldu.');
});

console.log('[CLIENT] SantosRP client-side başlatıldı!');
import { initCreator } from './creator';
initCreator();

// ─── Araç Tuş Bağlamaları ────────────────────────────────────────────────────

function isUIOpen(): boolean {
    return mp.gui.cursor.visible || mp.game.ui.isPauseMenuActive();
}

// M (77): Motor aç/kapat
mp.keys.bind(77, true, () => {
    if (isUIOpen()) return;
    mp.events.callRemote('runCommand', '/motor');
});

// L (76): Kilit aç/kapat
mp.keys.bind(76, true, () => {
    if (isUIOpen()) return;
    mp.events.callRemote('runCommand', '/kilit');
});

// K (75): Emniyet kemeri
mp.keys.bind(75, true, () => {
    if (isUIOpen()) return;
    if (!mp.players.local.vehicle) return;
    mp.events.callRemote('runCommand', '/kemer');
});

// ─── Otomatik Motor Engeli ────────────────────────────────────────────────────

mp.events.add('entityStreamIn', (entity: EntityMp) => {
    if(entity.type == 'vehicle'){
        const eStatus = entity.getVariable('engine') as boolean | undefined;
        // Sunucu tarafında değer sadece tanımlıysa senkronize et;
        // tanımsızsa motoru zorla kapatma — stream desync önlemi
        if (eStatus !== undefined) {
            setTimeout((_: any) => {
                if (entity && mp.vehicles.exists(entity as VehicleMp)) {
                    (entity as VehicleMp).setEngineOn(eStatus, true, true);
                }
            }, 100);
        }
    }
});

mp.events.addDataHandler('engine', (entity: EntityMp, eStatus: boolean) => {
    setTimeout((_: any) => {
        if (entity && mp.vehicles.exists(entity as VehicleMp)) {
            (entity as VehicleMp).setEngineOn(eStatus, true, true);
        }
    }, 100);
});



// ─── Emniyet Kemeri Render ───────────────────────────────────────────────────

mp.events.add('render', () => {
    const player = mp.players.local;
    const veh    = player.vehicle;

    // Yakın dövüş silahı kontrolü
    if (mp.game.weapon.isPedArmed(player.handle, 6)) {
        mp.game.controls.disableControlAction(0, 140, true);
        mp.game.controls.disableControlAction(0, 141, true);
        mp.game.controls.disableControlAction(0, 142, true);
    }

    // Chat'te yazı yazarken pause menüsünü engelle (P: 199, ESC: 200)
    if (player.isTypingInTextChat) {
        mp.game.controls.disableControlAction(0, 199, true);
        mp.game.controls.disableControlAction(0, 200, true);
    }

    // Gizli yürüyüşü engelle (tuş devre dışı bırakma ile — setStealthMovement render spam'i önlendi)
    mp.game.controls.disableControlAction(0, 36, true); // INPUT_DUCK

    // Araç içindeyse
    if (veh) {
        // Radyo değiştirme tuşlarını engelle (FPS drop önlemi — radyoyu araca binişte tek seferlik kapatıyoruz)
        mp.game.controls.disableControlAction(0, 19, true);  // INPUT_VEH_NEXT_RADIO_TRACK
        mp.game.controls.disableControlAction(0, 20, true);  // INPUT_VEH_PREV_RADIO_TRACK
        mp.game.controls.disableControlAction(0, 134, true); // INPUT_VEH_RADIO_WHEEL

        // Hız sabitleyici
        if (cruiseActive) {
            if (!veh.engine) {
                cruiseActive = false;
            } else if (mp.game.controls.isControlPressed(0, 72) || mp.game.controls.isControlPressed(0, 76)) {
                cruiseActive = false;
                mp.events.call('chat:push', '!{#94a3b8}[HIZ SABİTLEYİCİ] Fren algılandı — devre dışı.');
            } else {
                if (mp.vehicles.exists(veh)) {
                    mp.game.controls.disableControlAction(0, 71, true);
                    const cur  = veh.getSpeed();
                    const diff = cruiseTargetSpeed - cur;
                    if (diff > 0.3) {
                        mp.game.controls.setControlNormal(0, 71, Math.min(diff * 0.6, 1.0));
                    }
                }
            }
        }
    }
});

// ─── Otomatik Motor Başlatmayı Engelle ───────────────────────────────────────

// ─── Otomatik Motor Başlatmayı ve Kapatmayı Engelle ─────────────────────────

// Emniyet kemeri değiştiğinde ConfigFlag 32'yi tek seferlik güncelle (render spam önlendi)
mp.events.addDataHandler('seatbelt', (entity: EntityMp, value: boolean) => {
    if (entity.type === 'player' && entity === (mp.players.local as any)) {
        mp.players.local.setConfigFlag(32, !value);
    }
});

// Araca BİNERKEN: Otomatik çalıştırmayı engelle ve radyoyu bir kez kapat
mp.events.add('playerEnteringVehicle', (vehicle: VehicleMp, seat: number) => {
    const player = mp.players.local;
    player.setConfigFlag(429, true); // GTA'nın motoru otomatik çalıştırmasını engelle
    player.setConfigFlag(241, true); // GTA'nın araçtan inerken motoru otomatik kapatmasını engelle
    // Radyoyu araca binişte tek seferlik kapat (render döngüsünde çağırmak yerine)
    mp.game.audio.setRadioToStationName('OFF');
    mp.game.audio.setUserRadioControlEnabled(false);
});

// Araçtan tamamen ÇIKILDIĞINDA (Animasyon bittiğinde)
mp.events.add('playerExitVehicle', (vehicle: VehicleMp, _seat: number) => {
    if (parkingBrakeOn) {
        parkingBrakeOn = false;
        if (vehicle && mp.vehicles.exists(vehicle) && vehicle.handle !== 0) {
            try {
                mp.game.invoke('0x684785568EF26A22', vehicle.handle, false);
            } catch {}
        }
    }
    if (cruiseActive) {
        cruiseActive = false;
        mp.events.call('chat:push', '!{#94a3b8}[HIZ SABİTLEYİCİ] Araçtan çıkıldı — devre dışı.');
    }
});

// ============================================================================
// ARAÇ SENKRONİZASYON SİSTEMİ (Sinyaller, Kapılar, Camlar)
// RAGE:MP Native Wrapper'ları kullanılmıştır. Hatasızdır.
// ============================================================================

// ─── 1. Sinyal (Indicator) Senkronizasyonu ──────────────────────────────────
// Race condition (yarış durumu) önlemek için tek bir merkezi kontrolcü:
function updateIndicators(entity: EntityMp) {
    if (entity.type !== 'vehicle') return;

    const indLeft = !!entity.getVariable('indLeft');
    const indRight = !!entity.getVariable('indRight');
    const indHazard = !!entity.getVariable('indHazard');

    if (indHazard) {
        // Dörtlü açıksa her halükarda ikisini de yak
        entity.setIndicatorLights(1, true);
        entity.setIndicatorLights(0, true);
    } else {
        // Değilse bireysel değişkenlere göre yak/kapat
        entity.setIndicatorLights(1, indLeft);
        entity.setIndicatorLights(0, indRight);
    }
}

// Tüm sinyal değişkenleri aynı kontrolcüye gider, böylece sinyaller birbirini ezmez
mp.events.addDataHandler('indLeft', updateIndicators);
mp.events.addDataHandler('indRight', updateIndicators);
mp.events.addDataHandler('indHazard', updateIndicators);

// ─── 2. Kapı Senkronizasyonu (0-5 Kapılar) ──────────────────────────────────
for (let i = 0; i <= 5; i++) {
    mp.events.addDataHandler(`door_${i}`, (entity: EntityMp, value: boolean) => {
        if (entity.type === 'vehicle') {
            try {
                if (value) {
                    entity.setDoorOpen(i, false, false); // Kapıyı animasyonlu aç
                } else {
                    entity.setDoorShut(i, false);        // Kapıyı animasyonlu kapat
                }
            } catch (err) {} // Araçta bu kapı yoksa (örn: motosiklet) hatayı yut
        }
    });
}

// ─── 3. Cam Senkronizasyonu (0-3 Camlar) ────────────────────────────────────
for (let i = 0; i <= 3; i++) {
    mp.events.addDataHandler(`window_${i}`, (entity: EntityMp, value: boolean) => {
        if (entity.type === 'vehicle') {
            try {
                if (value) {
                    entity.rollDownWindow(i); // Camı indir
                } else {
                    entity.rollUpWindow(i);   // Camı kaldır
                }
            } catch (err) {}
        }
    });
}

// ─── 4. Görüş Alanına Giren Araçlar İçin (Stream In) ────────────────────────
// Aracı sonradan gören oyuncular kapı/cam/sinyalleri doğru durumda görsün diye
mp.events.add('entityStreamIn', (entity: EntityMp) => {
    if (entity.type === 'vehicle') {
        
        // Sinyallerin Durumu
        const indLeft = !!entity.getVariable('indLeft');
        const indRight = !!entity.getVariable('indRight');
        const indHazard = !!entity.getVariable('indHazard');

        if (indHazard) {
            entity.setIndicatorLights(1, true);
            entity.setIndicatorLights(0, true);
        } else {
            entity.setIndicatorLights(1, indLeft);
            entity.setIndicatorLights(0, indRight);
        }

        // Kapı ve cam sync'i rastgele 100–500ms geciktir: kalabalık alanlarda
        // aynı anda 50 araç stream-in olsa bile native çağrılar farklı frame'lere dağılır.
        const streamVehicle = entity as VehicleMp;
        const streamDelay = 100 + Math.random() * 400;
        setTimeout(() => {
            if (!mp.vehicles.exists(streamVehicle)) return;

            // Kapıların Durumu
            for (let i = 0; i <= 5; i++) {
                try {
                    if (streamVehicle.getVariable(`door_${i}`)) {
                        streamVehicle.setDoorOpen(i, false, true);
                    } else {
                        streamVehicle.setDoorShut(i, true);
                    }
                } catch (err) {}
            }

            // Camların Durumu
            for (let i = 0; i <= 3; i++) {
                try {
                    if (streamVehicle.getVariable(`window_${i}`)) {
                        streamVehicle.rollDownWindow(i);
                    } else {
                        streamVehicle.rollUpWindow(i);
                    }
                } catch (err) {}
            }
        }, streamDelay);
    }
});

// ─── Araç Takip Blip ─────────────────────────────────────────────────────────
// Yakınlık ve zaman kontrolü Global Blip Yöneticisi tarafından yapılır.
// Bu event sadece yeni blip'i Set'e ekler — setInterval/setTimeout açılmaz.

mp.events.add('client:vehicle:blip', (x: number, y: number, z: number, plate: string) => {
    try {
        const blip = mp.blips.new(66, new mp.Vector3(x, y, z), {
            name: `Araç: ${plate}`,
            color: 3,
            scale: 1.0,
            shortRange: false,
        });
        activeBlips.add({ blip, x, y, z, expiresAt: Date.now() + 60_000 });
    } catch {}
});

// ─── El Freni / Hız Sabitleyici / Sinyal — State ─────────────────────────────

let parkingBrakeOn    = false;
let cruiseActive      = false;
let cruiseTargetSpeed = 0; // m/s

// X (88): El freni toggle
mp.keys.bind(88, true, () => {
    if (isUIOpen()) return;
    const vehicle = mp.players.local.vehicle;
    if (!vehicle || !mp.vehicles.exists(vehicle) || vehicle.handle === 0) return;
    if (!mp.game.vehicle.getIsVehicleEngineRunning(vehicle.handle)) return;

    parkingBrakeOn = !parkingBrakeOn;
    try {
        mp.game.invoke('0x684785568EF26A22', vehicle.handle, parkingBrakeOn);
    } catch {}

    mp.events.call('chat:push', parkingBrakeOn
        ? '!{#ef4444}[EL FRENİ] Çekildi.'
        : '!{#94a3b8}[EL FRENİ] Bırakıldı.');
});

// . (190): Hız sabitleyici toggle
mp.keys.bind(190, true, () => {
    if (isUIOpen()) return;
    const veh = mp.players.local.vehicle;
    if (!veh || !veh.engine) return;
    if (veh.getPedInSeat(-1) !== mp.players.local.handle) return;
    if (!cruiseActive) {
        const vel = veh.velocity;
        const spd = Math.sqrt(vel.x ** 2 + vel.y ** 2 + vel.z ** 2);
        if (spd < 3.0) {
            mp.events.call('chat:push', '!{#fbbf24}[HIZ SABİTLEYİCİ] En az 10 km/h hızda olun.');
            return;
        }
        cruiseActive = true;
        cruiseTargetSpeed = spd;
        mp.events.call('chat:push', `!{#3b82f6}[HIZ SABİTLEYİCİ] ${Math.round(spd * 3.6)} km/h hızında sabitlendi.`);
    } else {
        cruiseActive = false;
        mp.events.call('chat:push', '!{#94a3b8}[HIZ SABİTLEYİCİ] Devre dışı.');
    }
});

// ─── Sinyal Tuşları ───────────────────────────────────────────────────────────

// ğ (219 = [ key): Sol sinyal
mp.keys.bind(219, true, () => {
    if (isUIOpen() || !mp.players.local.vehicle) return;
    mp.events.callRemote('vehicle:indicator', 'left');
});

// ü (221 = ] key): Sağ sinyal
mp.keys.bind(221, true, () => {
    if (isUIOpen() || !mp.players.local.vehicle) return;
    mp.events.callRemote('vehicle:indicator', 'right');
});

// P (80): Dörtlü (hazard)
mp.keys.bind(80, true, () => {
    if (isUIOpen() || !mp.players.local.vehicle) return;
    mp.events.callRemote('vehicle:indicator', 'hazard');
});

// ============================================================================
// YENİ NESİL FAR SİSTEMİ (Sabah & Araç Dışı Korumalı)
// ============================================================================
// Far durumlarını araç bazlı hafızada tut (Araçtan inince sönmemesi için)
const vehicleLightStates = new Map<number, number>();

// Araç ekrandan çıkınca far hafızasını temizle (memory leak önlemi)
mp.events.add('entityStreamOut', (entity: EntityMp) => {
    if (entity.type === 'vehicle') vehicleLightStates.delete(entity.remoteId);
});

// H (72): Far Döngüsü (Kapalı -> Gerçek Park -> Kısa)
mp.keys.bind(72, true, () => {
    if (isUIOpen() || !mp.players.local.vehicle) return;
    const veh = mp.players.local.vehicle;

    let state = vehicleLightStates.get(veh.remoteId) || 0;
    state = (state + 1) % 3;
    vehicleLightStates.set(veh.remoteId, state);

    // Gerçek GTA far kademelerini uygula
    // 0x1FD09E7390A74D54 -> SET_VEHICLE_LIGHTS
    // 0: Normal, 1: Sadece Parklar, 2: Kısa Farlar
    mp.game.invoke('0x1FD09E7390A74D54', veh.handle, state);

    const labels = ["KAPALI", "PARK (GERÇEK)", "KISA"];
    mp.events.call('chat:push', `!{#94a3b8}[FAR] ${labels[state]}`);
});

mp.events.add('playerLeaveVehicle', (vehicle: VehicleMp) => {
    if (vehicle && vehicle.handle !== 0) {
        // Araçtan inince hafızadaki far durumu neyse onu tekrar zorla
        const lastState = vehicleLightStates.get(vehicle.remoteId) || 0;
        
        // 500ms sonra (İnme animasyonu biterken) farı tekrar hafızadaki moda sok
        setTimeout(() => {
            if (vehicle && mp.vehicles.exists(vehicle) && vehicle.handle !== 0) {
                mp.game.invoke('0x1FD09E7390A74D54', vehicle.handle, lastState);
            }
        }, 500);
    }
});

// Q (81): Selektör
mp.keys.bind(81, true, () => {
    const veh = mp.players.local.vehicle;
    if (!isUIOpen() && veh) {
        mp.game.invoke('0x8B7FD87F0DDB421E', veh.handle, true); // SET_VEHICLE_FULLBEAM
    }
});

mp.keys.bind(81, false, () => {
    const veh = mp.players.local.vehicle;
    if (veh) {
        mp.game.invoke('0x8B7FD87F0DDB421E', veh.handle, false);
    }
});
// Tab (9): Envanter
mp.keys.bind(9, true, () => {
    if (isUIOpen()) return; // Zaten açıksa veya başka UI açıksa tetikleme
    mp.events.callRemote('client:inventory:requestOpen');
});

// Envanter Kapanma İsteği
mp.events.add('server:inventory:close', () => {
    mp.events.callRemote('client:inventory:closed');
    // UI tarafında closeInventory() çağrılmış olmalı veya Rpc ile yönetilmeli.
    // Şimdilik sadece cursor gizleme vs.
    mp.gui.cursor.show(false, false);
});


// Envanter Aç (Sunucudan gelen veriyle)
mp.events.add('client:inventory:openUI', (payloadJson: string) => {
    import('./auth').then(({ getGameBrowser }) => {
        const browser = getGameBrowser();
        if (browser) {
            mp.gui.cursor.show(true, true);
            browser.execute(`window.openInventory('${payloadJson.replace(/'/g, "\\'")}')`);
        }
    });
});

mp.events.add('server:inventory:moveSlot', (fromSlot: number, toSlot: number, amount: number, otherType?: number, otherId?: number) => {
    mp.events.callRemote('server:inventory:moveSlot', fromSlot, toSlot, amount, otherType ?? null, otherId ?? null);
});

mp.events.add('server:inventory:moveOtherSlot', (fromSlot: number, toSlot: number, amount: number, otherType: number, otherId: number) => {
    mp.events.callRemote('server:inventory:moveOtherSlot', fromSlot, toSlot, amount, otherType, otherId);
});

mp.events.add('server:inventory:takeFromOther', (fromSlot: number, toSlot: number, amount: number, otherType: number, otherId: number) => {
    mp.events.callRemote('server:inventory:takeFromOther', fromSlot, toSlot, amount, otherType, otherId);
});

mp.events.add('server:inventory:putToOther', (fromSlot: number, toSlot: number, amount: number, otherType: number, otherId: number) => {
    mp.events.callRemote('server:inventory:putToOther', fromSlot, toSlot, amount, otherType, otherId);
});

mp.events.add('server:inventory:useItem', (slot: number, otherType?: number, otherId?: number) => {
    mp.events.callRemote('server:inventory:useItem', slot, otherType ?? null, otherId ?? null);
});

mp.events.add('server:inventory:dropItem', (slot: number, amount: number, otherType?: number, otherId?: number) => {
    mp.events.callRemote('server:inventory:dropItem', slot, amount, otherType ?? null, otherId ?? null);
});

mp.events.add('server:inventory:splitSlot', (slot: number, amount: number, otherType?: number, otherId?: number) => {
    mp.events.callRemote('server:inventory:splitSlot', slot, amount, otherType ?? null, otherId ?? null);
});

mp.events.add('client:inventory:closeRequest', () => {
    mp.events.callRemote('server:inventory:close');
});
