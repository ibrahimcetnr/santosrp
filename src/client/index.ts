/**
 * RAGE:MP - Client Entry Point
 * SantosRP Client-Tarafı Ana Dosyası
 */
import { registerClientAuthEvents } from './auth';
import { initHUD } from './hud';

// RAGE native chat'i en erken anda kapat — "Multiplayer Started" mesajını engeller
mp.gui.chat.activate(false);
mp.gui.chat.show(false);
mp.game.ui.displayHud(false);
mp.game.ui.displayRadar(false);

// Auth sistemini başlat
registerClientAuthEvents();

// HUD sistemini başlat
initHUD();

mp.events.add('browserCreated', (browser: BrowserMp) => {
  console.log('[CLIENT] Browser oluşturuldu.');
});

console.log('[CLIENT] SantosRP client-side başlatıldı!');
import { initCreator } from './creator';
initCreator();
