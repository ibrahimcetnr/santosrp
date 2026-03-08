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
    if (!player.vehicle) return;

    const hasSeatbelt = !!player.getVariable('seatbelt');
    if (hasSeatbelt) {
        mp.game.player.setCanBeKnockedOffVehicle(true);
        mp.game.player.setConfigFlag(149, true);
    }
});

