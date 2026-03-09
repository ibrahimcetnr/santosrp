/**
 * RAGE:MP - Client Entry Point
 * SantosRP Client-Tarafı Ana Dosyası
 */
import { registerClientAuthEvents } from './auth';
import { initHUD } from './hud';
import { initNametags } from './nametags';

// RAGE native chat'i en erken anda kapat — "Multiplayer Started" mesajını engeller
mp.gui.chat.activate(false);
mp.gui.chat.show(false);
mp.game.ui.displayHud(false);
mp.game.ui.displayRadar(false);

// ─── Genel RP Ayarları ────────────────────────────────────────────────────────

// Ortam seslerini kıs
mp.game.audio.startAudioScene("CHARACTER_CHANGE_IN_SKY_SCENE");

// AFK kamerasını engelle
setInterval(() => mp.game.invoke("0xF4F2C0D4EE209E20"), 29500);

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

// Yeni araç stream'e girdiğinde motoru varsayılan kapalı yap
mp.events.add('entityStreamIn', (entity: EntityMp) => {
    if (entity.type !== 'vehicle') return;
    const vehicle = entity as VehicleMp;
    try {
        mp.game.vehicle.setVehicleEngineOn(vehicle.handle, false, true, true);
        mp.game.vehicle.setVehicleUndriveable(vehicle.handle, true);
    } catch {}
});

// Araca binince engineStatus variable'ına göre motor durumunu uygula
mp.events.add('playerEnterVehicle', (vehicle: VehicleMp, _seat: number) => {
    if (!vehicle) return;
    try {
        const engineOn = !!vehicle.getVariable('engineStatus');
        mp.game.vehicle.setVehicleEngineOn(vehicle.handle, engineOn, true, true);
        mp.game.vehicle.setVehicleUndriveable(vehicle.handle, !engineOn);
    } catch {}
});

// ─── Emniyet Kemeri Render ───────────────────────────────────────────────────

mp.events.add('render', () => {
    const player = mp.players.local;

    // Yakın dövüş silahı kontrolü
    if (mp.game.invoke('0x475768A975D5AD17', player.handle, 6)) {
        mp.game.controls.disableControlAction(0, 140, true);
        mp.game.controls.disableControlAction(0, 141, true);
        mp.game.controls.disableControlAction(0, 142, true);
    }

    // Chat'te yazı yazarken pause menüsünü engelle (P: 199, ESC: 200)
    if (player.isTypingInTextChat) {
        mp.game.controls.disableControlAction(0, 199, true);
        mp.game.controls.disableControlAction(0, 200, true);
    }

    // Gizli yürüyüşü engelle
    player.setStealthMovement(false, '0');

    // Araç içindeyse
    if (player.vehicle) {
        // Radyoyu zorla kapat
        mp.game.audio.setRadioToStationName("OFF");
        mp.game.audio.setUserRadioControlEnabled(false);

        // Config Flag 32: Camdan fırlama izni.
        // Kemer takılıysa (true) fırlamayı kapat (false).
        // Kemer takılı değilse (false) fırlamayı aç (true).
        const hasSeatbelt = !!player.getVariable('seatbelt');
        player.setConfigFlag(32, !hasSeatbelt);

        // El freni — her frame uygulanmalı
        if (parkingBrakeOn) {
            try { mp.game.invoke('0x684785568EF26A22', player.vehicle.handle, true); } catch {}
        }

        // Hız sabitleyici
        if (cruiseActive) {
            if (!player.vehicle.engine) {
                cruiseActive = false;
            } else if (mp.game.controls.isControlPressed(0, 72)) {
                cruiseActive = false;
                mp.events.call('chat:push', '!{#94a3b8}[HIZ SABİTLEYİCİ] Fren algılandı — devre dışı.');
            } else {
                try {
                    mp.game.controls.disableControlAction(0, 71, true);
                    const vel  = player.vehicle.velocity;
                    const cur  = Math.sqrt(vel.x ** 2 + vel.y ** 2 + vel.z ** 2);
                    const diff = cruiseTargetSpeed - cur;
                    if (diff > 0.3) {
                        mp.game.controls.setControlNormal(0, 71, Math.min(diff * 0.6, 1.0));
                    }
                } catch {}
            }
        }

        // Yerel araç sinyallerini uygula (server variable)
        try {
            const indLeft  = !!player.vehicle.getVariable('indLeft');
            const indRight = !!player.vehicle.getVariable('indRight');
            (mp.game.vehicle as any).setVehicleIndicatorLights(player.vehicle.handle, 0, indLeft);
            (mp.game.vehicle as any).setVehicleIndicatorLights(player.vehicle.handle, 1, indRight);
        } catch {}
    }
});

// ─── Otomatik Motor Başlatmayı Engelle ───────────────────────────────────────

mp.events.add('playerEnteringVehicle', (vehicle: VehicleMp, seat: number) => {
    const player = mp.players.local;
    // 429: CPED_CONFIG_FLAG_DisableStartingVehEngine
    // Oyuncunun araca binerken GTA'nın motoru otomatik çalıştırmasını engeller.
    player.setConfigFlag(429, true);
});

// ─── Araç Kapı Kontrolü ───────────────────────────────────────────────────────

mp.events.add('client:vehicle:door', (vehicleId: number, doorId: number, open: boolean) => {
    const vehicle = mp.vehicles.at(vehicleId);
    if (!vehicle) return;
    try {
        if (open) {
            mp.game.vehicle.setVehicleDoorOpen(vehicle.handle, doorId, false, false);
        } else {
            mp.game.vehicle.setVehicleDoorShut(vehicle.handle, doorId, false);
        }
    } catch {}
});

// ─── Araç Cam Kontrolü ────────────────────────────────────────────────────────

mp.events.add('client:vehicle:window', (vehicleId: number, winId: number, down: boolean) => {
    const vehicle = mp.vehicles.at(vehicleId);
    if (!vehicle) return;
    try {
        if (down) {
            mp.game.vehicle.rollDownWindow(vehicle.handle, winId);
        } else {
            mp.game.vehicle.rollUpWindow(vehicle.handle, winId);
        }
    } catch {}
});

// ─── Araç Takip Blip ─────────────────────────────────────────────────────────

mp.events.add('client:vehicle:blip', (x: number, y: number, z: number, plate: string) => {
    try {
        const blip = mp.blips.new(66, new mp.Vector3(x, y, z), {
            name: `Araç: ${plate}`,
            color: 3,
            scale: 1.0,
            shortRange: false,
        });

        // Oyuncu yaklaşırsa (30m) veya 60 saniye sonra blip'i sil
        let removed = false;
        const removeBlip = () => {
            if (removed) return;
            removed = true;
            try { blip.destroy(); } catch {}
            clearInterval(proximityCheck);
        };

        const proximityCheck = setInterval(() => {
            if (!blip) { removeBlip(); return; }
            try {
                const pPos = mp.players.local.position;
                const dist = Math.sqrt(
                    Math.pow(pPos.x - x, 2) +
                    Math.pow(pPos.y - y, 2) +
                    Math.pow(pPos.z - z, 2)
                );
                if (dist < 30) removeBlip();
            } catch { removeBlip(); }
        }, 2000);

        setTimeout(removeBlip, 60_000);
    } catch {}
});

// ─── El Freni / Hız Sabitleyici / Sinyal — State ─────────────────────────────

let parkingBrakeOn    = false;
let cruiseActive      = false;
let cruiseTargetSpeed = 0; // m/s

// Araçtan çıkınca sıfırla
mp.events.add('playerExitVehicle', (_vehicle: VehicleMp, _seat: number) => {
    parkingBrakeOn = false;
    if (cruiseActive) {
        cruiseActive = false;
        mp.events.call('chat:push', '!{#94a3b8}[HIZ SABİTLEYİCİ] Araçtan çıkıldı — devre dışı.');
    }
});

// X (88): El freni toggle
mp.keys.bind(88, true, () => {
    if (isUIOpen() || !mp.players.local.vehicle) return;
    parkingBrakeOn = !parkingBrakeOn;
    mp.events.call('chat:push', parkingBrakeOn
        ? '!{#ef4444}[EL FRENİ] Çekildi.'
        : '!{#94a3b8}[EL FRENİ] Bırakıldı.');
});

// . (190): Hız sabitleyici toggle
mp.keys.bind(190, true, () => {
    if (isUIOpen()) return;
    const veh = mp.players.local.vehicle;
    if (!veh || !veh.engine) return;
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

// Q (81): Selektör — kısa far flaşı
mp.keys.bind(81, true, () => {
    if (isUIOpen() || !mp.players.local.vehicle) return;
    const veh = mp.players.local.vehicle;
    try {
        mp.game.invoke('0x1FD09E7390A74D54', veh.handle, true); // SET_VEHICLE_FULLBEAM
        setTimeout(() => {
            try { mp.game.invoke('0x1FD09E7390A74D54', veh.handle, false); } catch {}
        }, 400);
    } catch {}
});

// ─── Diğer Araçların Sinyal Senkronizasyonu ──────────────────────────────────

const indicatorTimers = new Map<number, ReturnType<typeof setInterval>>();

mp.events.add('entityStreamIn', (entity: EntityMp) => {
    if (entity.type !== 'vehicle') return;
    const veh = entity as VehicleMp;
    const key = veh.id;
    if (indicatorTimers.has(key)) return;
    const timer = setInterval(() => {
        if (!mp.vehicles.exists(veh)) {
            clearInterval(timer);
            indicatorTimers.delete(key);
            return;
        }
        try {
            const left  = !!veh.getVariable('indLeft');
            const right = !!veh.getVariable('indRight');
            (mp.game.vehicle as any).setVehicleIndicatorLights(veh.handle, 0, left);
            (mp.game.vehicle as any).setVehicleIndicatorLights(veh.handle, 1, right);
        } catch {}
    }, 150);
    indicatorTimers.set(key, timer);
});

mp.events.add('entityStreamOut', (entity: EntityMp) => {
    if (entity.type !== 'vehicle') return;
    const key = (entity as VehicleMp).id;
    const timer = indicatorTimers.get(key);
    if (timer) { clearInterval(timer); indicatorTimers.delete(key); }
});

