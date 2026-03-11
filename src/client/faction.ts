/**
 * SantosRP - Faction Client Controller
 * F3 ile panel açma/kapama (toggle), sunucu-istemci UI köprüsü
 */
import { getGameBrowser } from './auth';

let isFactionPanelOpen = false;

function isUIOpen(): boolean {
  return mp.gui.cursor.visible || mp.game.ui.isPauseMenuActive();
}

function closeFactionPanel() {
  if (!isFactionPanelOpen) return;
  isFactionPanelOpen = false;
  mp.gui.cursor.show(false, false);
  const browser = getGameBrowser();
  if (browser) browser.execute('window.closeFactionUI && window.closeFactionUI();');
}

// ─── F3 (114): Birlik Paneli Toggle ───────────────────────────────────────────
mp.keys.bind(114, true, () => {
  if (isFactionPanelOpen) {
    closeFactionPanel();
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
// Hem Svelte kapatma butonundan (mp.trigger), hem sunucudan (player.call) tetiklenebilir.
// isFactionPanelOpen TRUE ise → sunucudan zorla kapatma → browser'ı kapat
// isFactionPanelOpen FALSE ise → Svelte zaten kapattı → sadece cursor sıfırla
mp.events.add('client:closeFactionUI', () => {
  if (isFactionPanelOpen) {
    // Server forced close (kick vs.) — UI'yı da kapat
    closeFactionPanel();
  } else {
    // Svelte zaten UI'yı kapattı, sadece cursor'ı garantile
    mp.gui.cursor.show(false, false);
  }
});

// ─── client:factionInviteClick — Svelte 'Üye Al' butonundan gelen istek ──────
mp.events.add('client:factionInviteClick', () => {
  mp.events.callRemote('server:factionInviteRequest');
});

// ─── İstemci → Sunucu köprüleri (Birlik panel action event'leri) ──────────────
mp.events.add('client:faction:inviteMember', (factionId: number, targetCharId: number) => {
  mp.events.callRemote('server:faction:inviteMember', factionId, targetCharId);
});

mp.events.add('client:faction:kickMember', (factionId: number, targetCharId: number) => {
  mp.events.callRemote('server:faction:kickMember', factionId, targetCharId);
});

mp.events.add('client:faction:editMemberRank', (factionId: number, targetCharId: number, newRank: number) => {
  mp.events.callRemote('server:faction:editMemberRank', factionId, targetCharId, newRank);
});

mp.events.add('client:faction:editMemberDivision', (factionId: number, targetCharId: number, newDivision: number) => {
  mp.events.callRemote('server:faction:editMemberDivision', factionId, targetCharId, newDivision);
});

mp.events.add('client:faction:updateRankCount', (factionId: number, ranksJson: string) => {
  mp.events.callRemote('server:faction:updateRankCount', factionId, ranksJson);
});

mp.events.add('client:faction:updateDivisionCount', (factionId: number, divisionsJson: string) => {
  mp.events.callRemote('server:faction:updateDivisionCount', factionId, divisionsJson);
});

mp.events.add('client:faction:updateRankName', (factionId: number, rankId: number, newName: string) => {
  mp.events.callRemote('server:faction:updateRankName', factionId, rankId, newName);
});

mp.events.add('client:faction:updateDivisionName', (factionId: number, divId: number, newName: string) => {
  mp.events.callRemote('server:faction:updateDivisionName', factionId, divId, newName);
});

mp.events.add('client:faction:updateRankPermissions', (factionId: number, rankId: number, permissionsJson: string) => {
  mp.events.callRemote('server:faction:updateRankPermissions', factionId, rankId, permissionsJson);
});

// ─── client:faction:liveUpdate — Sunucudan gelen canlı patch güncellemesi ────────
mp.events.add('client:faction:liveUpdate', (patchJson: string) => {
  const browser = getGameBrowser();
  if (!browser) return;
  const escaped = patchJson.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  browser.execute(`window.patchFactionUI && window.patchFactionUI('${escaped}')`);
});

// ─── Teklif/Davet sistemi köprüsü ─────────────────────────────────────────────

mp.events.add('client:receiveOffer', (offerJson: string) => {
  const browser = getGameBrowser();
  if (!browser) return;
  const escaped = offerJson.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  browser.execute(`window.showOffer && window.showOffer('${escaped}')`);
});

mp.events.add('client:acceptOffer', (offerId: string) => {
  mp.events.callRemote('server:faction:acceptOffer', offerId);
});

mp.events.add('client:rejectOffer', (offerId: string) => {
  mp.events.callRemote('server:faction:rejectOffer', offerId);
});

mp.events.add('client:faction:leaveFaction', (factionId: number) => {
  mp.events.callRemote('server:faction:leaveFaction', factionId);
});

mp.events.add('client:faction:treasuryDeposit', (factionId: number, amount: number) => {
  mp.events.callRemote('server:faction:treasuryDeposit', factionId, amount);
});

mp.events.add('client:faction:treasuryWithdraw', (factionId: number, amount: number) => {
  mp.events.callRemote('server:faction:treasuryWithdraw', factionId, amount);
});

mp.events.add('client:faction:setChatEnabled', (factionId: number, enabled: boolean) => {
  mp.events.callRemote('server:faction:setChatEnabled', factionId, enabled);
});

mp.events.add('client:faction:updateDescription', (factionId: number, text: string) => {
  mp.events.callRemote('server:faction:updateDescription', factionId, text);
});

export function initFaction(): void {
  console.log('[CLIENT] Faction sistemi başlatıldı.');
}
