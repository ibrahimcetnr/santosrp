/**
 * SantosRP - Faction Client Controller
 * F3 ile panel açma/kapama (toggle), sunucu-istemci UI köprüsü
 */
import { getGameBrowser } from './auth';

let isFactionPanelOpen = false;

function isUIOpen(): boolean {
  return mp.gui.cursor.visible || mp.game.ui.isPauseMenuActive();
}

// ─── F3 (114): Birlik Paneli Toggle ───────────────────────────────────────────
mp.keys.bind(114, true, () => {
  if (isFactionPanelOpen) {
    // Panel açıksa kapat
    const browser = getGameBrowser();
    if (browser) browser.execute('window.closeFactionUI && window.closeFactionUI();');
    return;
  }
  if (isUIOpen()) return;
  mp.events.callRemote('server:requestFactionData');
});

// ─── client:showFactionUI — Sunucudan gelen veriyi UI'ya ilet ─────────────────
mp.events.add('client:showFactionUI', (factionDataJson: string) => {
  const browser = getGameBrowser();
  if (!browser) return;

  isFactionPanelOpen = true;
  mp.gui.cursor.show(true, true);

  // JSON string'i tek tırnak içine güvenle yerleştirmek için kaçış uygula
  const escaped = factionDataJson.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  browser.execute(`window.openFactionUI && window.openFactionUI('${escaped}')`);

  // 'Üye Al' butonu için CEF → Client köprüsünü UI'ya enjekte et
  browser.execute(`
    window.__factionInviteBridge = function() {
      if (typeof window.mp !== 'undefined') {
        window.mp.trigger('client:factionInviteClick');
      }
    };
  `);
});

// ─── client:closeFactionUI — Svelte'den gelen kapatma isteğini işle ──────────
mp.events.add('client:closeFactionUI', () => {
  isFactionPanelOpen = false;
  mp.gui.cursor.show(false, false);
});

// ─── client:factionInviteClick — Svelte 'Üye Al' butonundan gelen istek ──────
mp.events.add('client:factionInviteClick', () => {
  mp.events.callRemote('server:factionInviteRequest');
});

export function initFaction(): void {
  console.log('[CLIENT] Faction sistemi başlatıldı.');
}
