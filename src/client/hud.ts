/**
 * SantosRP - HUD Controller (Client)
 * Oyun içi HUD yönetimi: konum/yön, sunucu saati, para, özel chat sistemi
 */
import { getGameBrowser } from './auth';
import { getMinimapAnchor } from './minimap';

let chatOpen  = false;
let hudActive = false;

// ── Yardımcı Fonksiyonlar ─────────────────────────────────────────────────────

function formatMoney(amount: number): string {
  return String(Math.floor(amount)).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + '$';
}

function headingToDirection(h: number): string {
  // GTA V: 0=Kuzey, counterclockwise artar (Batı→Güney→Doğu)
  const dirs = ['K', 'KB', 'B', 'GB', 'G', 'GD', 'D', 'KD'];
  return dirs[Math.round(((h % 360) + 360) % 360 / 45) % 8];
}

/** Browser'daki window fonksiyonunu güvenli şekilde çağırır */
function sendToHUD(fn: string, data: unknown): void {
  const browser = getGameBrowser();
  if (!browser) return;
  try {
    browser.execute(`window.${fn} && window.${fn}(${JSON.stringify(data)})`);
  } catch {}
}

/** RAGE:MP player.zone property ile bölge adını döndürür */
function getZoneName(): string {
  try {
    const raw = mp.players.local.zone as string;
    if (raw && typeof raw === 'string' && raw.length > 0) {
      // "HAWICK" → "Hawick", "EAST_LS" → "East Ls"
      return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase().replace(/_/g, ' ');
    }
  } catch {}
  return '';
}

// ── Konum & Yön Poll ──────────────────────────────────────────────────────────

let pollInterval: ReturnType<typeof setInterval> | null = null;
let lastZone: string = '';
let lastDirection: string = '';

function startPolling(): void {
  if (pollInterval) clearInterval(pollInterval);
  pollInterval = setInterval(() => {
    if (!getGameBrowser()) return;
    try {
      const location  = getZoneName();
      const direction = headingToDirection(mp.players.local.heading);
      
      // Sadece değişiklik varsa gönder
      if (location !== lastZone || direction !== lastDirection) {
        lastZone = location;
        lastDirection = direction;
        if (location) sendToHUD('hudUpdateLocation', { location, direction });
      }
    } catch {}
  }, 2000);
}

// ── Chat Yönetimi ─────────────────────────────────────────────────────────────
// markAsChat() ile bağlı browser'da mp.invoke('focus', true/false) ile yönetilir.
// openChat() kaldırıldı - native bridge handles it.

// ── initHUD ───────────────────────────────────────────────────────────────────

export function initHUD(): void {

  // Oyun HUD başlatma (server:playCharacter / server:saveCharacterAppearance sonrası)
  mp.events.add('client:startHUD', (charName: string, playerId: number, money: number) => {
    hudActive = true;
    // Browser zaten canlı (hideLoginUI yok etmedi); view='playing' olmuş durumda.
    // Kısa gecikme: Svelte'nin DOM güncellemesini tamamlamasını bekle.
    setTimeout(() => {
      sendToHUD('hudInit', { charName, playerId, money: formatMoney(money) });
      
      // Minimap pos sync
      const anchor = getMinimapAnchor();
      sendToHUD('syncMinimap', anchor);
    }, 800);
    startPolling();
  });

  // Sunucu saat/tarih yayını
  mp.events.add('client:hudTime', (timeStr: string, dateStr: string) => {
    sendToHUD('hudUpdateTime', { time: timeStr, date: dateStr });
  });

  // Para güncelleme (alışveriş, iş, vb.)
  mp.events.add('client:hudMoney', (amount: number) => {
    sendToHUD('hudUpdateMoney', { money: formatMoney(amount) });
  });

  // Chat mesajları (sunucudan yönlendirilen - fallback; native bridge chat:push kullanır)
  mp.events.add('client:hudMessage', (msgType: string, text: string) => {
    sendToHUD('hudMessage', { type: msgType, text });
  });

  // Native bridge: server outputChatBox → chat:push → addChatMessage
  mp.events.add('chat:push', (text: string) => {
    const browser = getGameBrowser();
    if (!browser) return;
    try {
      browser.execute(`window.addChatMessage && window.addChatMessage(${JSON.stringify(text)})`);
    } catch (err: any) {
      mp.console.logError(`[CHAT-FAIL] Svelte'e mesaj gönderilemedi: ${err?.message ?? err}`);
    }
  });

  // T tuşu algılama: render loop'ta her frame INPUT_CHAT (245) kontrol et.
  // mp.gui.chat.activate(false) native chat'i kapattığından bu kontrole düşer.
  mp.events.add('render', () => {
    if (!hudActive) return;
    try {
      mp.game.controls.disableControlAction(0, 245, true);
    } catch {}
  });

 // ── Araç HUD Poller (100ms) ───────────────────────────────────────────────
  // Hız ve araç durumu gibi sık değişen veriler için 100ms hızlı döngü.
  // Yakıt, motor, kilit, kemer gibi seyrek değişen veriler ayrı data handler'larla gönderilir.

  // ── Araç Boolean Bitmask Sabitleri ─────────────────────────────────────────
  // JSON'da "engineOn":true (16 byte) → "f":1 (5 byte): %68 payload tasarrufu.
  // Birden fazla flag aynı tick içinde değişirse 100ms loop'ta tek pakete birleşir.
  const VFLAG_ENGINE   = 1;       // bit 0
  const VFLAG_LOCKED   = 1 << 1;  // bit 1 = 2
  const VFLAG_SEATBELT = 1 << 2;  // bit 2 = 4

  let vehicleFlags = 0;    // güncel bitmask
  let flagsDirty   = false; // 100ms loop'a "gönder" sinyali

  let lastVehicleData = {
    inVehicle: false,
    speed: -1,
    fuel: -1,
  };

  // Hızlı yol: hız + araçta olma + bekleyen flag değişiklikleri
  setInterval(() => {
    if (!hudActive) return;
    const player  = mp.players.local;
    const vehicle = player.vehicle;

    if (!vehicle) {
      if (lastVehicleData.inVehicle) {
        sendToHUD('chv', { inVehicle: false });
        lastVehicleData.inVehicle = false;
        lastVehicleData.speed     = -1;
        lastVehicleData.fuel      = -1;
        vehicleFlags = 0;
        flagsDirty   = false;
      }
      return;
    }

    const speed = Math.round(vehicle.getSpeed() * 3.6);
    if (!lastVehicleData.inVehicle || lastVehicleData.speed !== speed) {
      sendToHUD('chv', { inVehicle: true, speed });
      lastVehicleData.inVehicle = true;
      lastVehicleData.speed     = speed;
    }
    // Birden fazla flag aynı tick içinde değişirse tek JSON'da birleştirilir
    if (flagsDirty) {
      sendToHUD('chv', { f: vehicleFlags });
      flagsDirty = false;
    }
  }, 100);

  // Yavaş yol: sunucu değişkeni güncellendiğinde tetiklenir (sıfır gereksiz polling)
  mp.events.addDataHandler('fuel', (entity: EntityMp, value: number) => {
    if (!hudActive) return;
    if (entity !== mp.players.local.vehicle) return;
    const fuel = (value as number | undefined) ?? 100;
    if (lastVehicleData.fuel === fuel) return;
    lastVehicleData.fuel = fuel;
    sendToHUD('chv', { fuel });
  });

  // Bitmask yolu — 3 boolean → tek int, 100ms loop'ta gönderilir
  mp.events.addDataHandler('engineStatus', (entity: EntityMp, value: boolean) => {
    if (!hudActive) return;
    if (entity !== mp.players.local.vehicle) return;
    if (value) vehicleFlags |= VFLAG_ENGINE; else vehicleFlags &= ~VFLAG_ENGINE;
    flagsDirty = true;
  });

  mp.events.addDataHandler('lockedStatus', (entity: EntityMp, value: boolean) => {
    if (!hudActive) return;
    if (entity !== mp.players.local.vehicle) return;
    if (value) vehicleFlags |= VFLAG_LOCKED; else vehicleFlags &= ~VFLAG_LOCKED;
    flagsDirty = true;
  });

  mp.events.addDataHandler('seatbelt', (entity: EntityMp, value: boolean) => {
    if (!hudActive || entity.type !== 'player' || entity !== (mp.players.local as any)) return;
    if (value) vehicleFlags |= VFLAG_SEATBELT; else vehicleFlags &= ~VFLAG_SEATBELT;
    flagsDirty = true;
  });
}