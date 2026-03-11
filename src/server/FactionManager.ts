/**
 * SantosRP - Faction Manager (Server)
 * DB'den birlik listesini cache'leyen ve istemciye köprü kuran yönetici sınıfı.
 */
import { query } from './db';
import { safeEvent, isPlayerValid } from './utils/safeEvent';
import { onlineCharacters } from './playerRegistry';

// ─── JSON parse yardımcısı (parse hatası → fallback döner) ───────────────────
function safeParse<T>(raw: unknown, fallback: T): T {
  if (raw === null || raw === undefined) return fallback;
  if (typeof raw !== 'string') return raw as T;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

// ─── snake_case → camelCase dönüştürücü ────────────────────────────────────
function toCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function rowToCamel(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(row)) {
    out[toCamel(key)] = row[key];
  }
  return out;
}

// ─── FactionManager Sınıfı ───────────────────────────────────────────────────
class FactionManager {
  private factions: Map<number, Record<string, unknown>> = new Map();

  /** DB'den tüm birlikleri çekip cache'e yükler */
  async loadAllFactions(): Promise<void> {
    const res = await query(
  'SELECT id, name, type, approvals, stock_value, founder_id, tasks, ranks, divisions, brokerFee, balance, description, chat_enabled FROM factions'
);
    this.factions.clear();

    for (const rawRow of res.rows) {
      const row = rowToCamel(rawRow) as Record<string, unknown>;

      // JSON string olarak saklanan dizi alanlarını parse et
      row['tasks']     = safeParse<unknown[]>(row['tasks'],     []);
      row['ranks']     = safeParse<unknown[]>(row['ranks'],     []);
      row['divisions'] = safeParse<unknown[]>(row['divisions'], []);
      row['approvals'] = safeParse<Record<string, boolean>>(row['approvals'], {});
      row['balance']     = Number(row['balance']) || 0;
      row['description'] = (row['description'] as string) || 'Bu birliğin henüz bir açıklaması bulunmuyor.';
      row['chatEnabled']  = row['chat_enabled'] !== false;
      // members artık characters tablosundan dinamik çekildiğinden cache'e almayız

      const id = row['id'] as number;
      this.factions.set(id, row);
    }

    console.log(`[FACTION] ${this.factions.size} birlik cache'e yüklendi.`);
  }

  /** Cache'den birliği döndürür. Bulunamazsa null. */
  getFaction(id: number): Record<string, unknown> | null {
    return this.factions.get(id) ?? null;
  }

  /** Cache'deki tüm birlikleri döndürür */
  getAllFactions(): Record<string, unknown>[] {
    return Array.from(this.factions.values());
  }
}

// ─── Bekleyen teklif/davet haritası ────────────────────────────────────────────
interface PendingOffer {
  type: 'faction_invite';
  factionId: number;
  factionName: string;
  inviterCharId: number;
  inviterName: string;
}
const pendingOffers = new Map<string, PendingOffer>();

export const factionManager = new FactionManager();

// ─── F3 Spam / DB Pool Exhaustion Koruması ──────────────────────────────────────────────────────
// playerId → son istek timestamp'i. Oyuncu/karakter 3 saniyede bir istek atabilir.
const factionRequestCooldowns = new Map<number, number>();

// ─── Birlik Çevrimiiçi Oyuncu Cache'i ───────────────────────────────────────────────────────
// factionId → çevrimiiçi oyuncu Set'i. broadcastToFaction'daki O(N) maliyetini O(k)'ya düşürür.
const factionOnlinePlayers = new Map<number, Set<PlayerMp>>();

/** Oyuncu birliğe katıldığında veya karakter yüklenince çağrılır */
export function registerPlayerFactionOnline(player: PlayerMp, factionId: number): void {
  let set = factionOnlinePlayers.get(factionId);
  if (!set) {
    set = new Set<PlayerMp>();
    factionOnlinePlayers.set(factionId, set);
  }
  set.add(player);
}

/** Oyuncu birlikten ayrıldığında / atıldığında / bağlantısı kesildiğinde çağrılır */
function unregisterPlayerFactionOnline(player: PlayerMp, factionId: number): void {
  const set = factionOnlinePlayers.get(factionId);
  if (!set) return;
  set.delete(player);
  if (set.size === 0) factionOnlinePlayers.delete(factionId);
}

// ─── Yardımcı: birlik üyelerini DB'den çek ───────────────────────────────────
async function fetchFactionMembers(factionId: number): Promise<Record<string, unknown>[]> {
  const raw = await query(
    'SELECT id, first_name, last_name, faction_rank, faction_division FROM characters WHERE faction_id = $1',
    [factionId]
  );
  return raw.rows.map((r: Record<string, unknown>) => {
    const c = rowToCamel(r);
    return {
      id:       c['id'],
      name:     `${c['firstName']} ${c['lastName']}`,
      rank:     c['factionRank'],
      division: c['factionDivision'],
    };
  });
}

// ─── Yardımcı: paneli açık birlik üyelerine patch yayınla ────────────────────
function broadcastToFaction(factionId: number, patch: Record<string, unknown>): void {
  const set = factionOnlinePlayers.get(factionId);
  if (!set || set.size === 0) return;
  const patchJson = JSON.stringify(patch);
  for (const p of set) {
    if (isPlayerValid(p)) {
      p.call('client:faction:liveUpdate', [patchJson]);
    }
  }
}

// ─── server:requestFactionData — İstemci F3'e bastığında çağrılır ────────────
const FACTION_REQUEST_COOLDOWN_MS = 3_000;
safeEvent('server:requestFactionData', async (player: PlayerMp) => {
  if (!isPlayerValid(player)) return;

  // Rate-limit: 3 saniye cooldown
  const now = Date.now();
  const lastRequest = factionRequestCooldowns.get(player.id) ?? 0;
  if (now - lastRequest < FACTION_REQUEST_COOLDOWN_MS) return;
  factionRequestCooldowns.set(player.id, now);

  const factionId: number | null | undefined = player.getVariable('faction_id');

  if (!factionId) {
    player.call('chat:push', ['!{#ef4444}[HATA] Bir birliğe üye değilsiniz.']);
    return;
  }

  const faction = factionManager.getFaction(factionId);

  if (!faction) {
    player.call('chat:push', ['!{#ef4444}[HATA] Birlik verisi bulunamadı.']);
    return;
  }

  // Üyeleri characters tablosundan çek (canlı veri — snake_case → camelCase)
  const membersRaw = await query(
    'SELECT id, first_name, last_name, faction_rank, faction_division FROM characters WHERE faction_id = $1',
    [factionId]
  );
  const members = membersRaw.rows.map((r: Record<string, unknown>) => {
    const c = rowToCamel(r);
    return {
      id:       c['id'],
      name:     `${c['firstName']} ${c['lastName']}`,
      rank:     c['factionRank'],
      division: c['factionDivision'],
    };
  });

  // Araçları vehicles tablosundan çek
  const vehiclesResult = await query(
    'SELECT model, plate FROM vehicles WHERE faction_id = $1',
    [factionId]
  );
  const vehicles = vehiclesResult.rows.map((r: Record<string, unknown>) => rowToCamel(r));

  // Birlik kategorisini belirle (10-19 → ŞİRKET)
  const factionType = faction['type'] as number;
  const isCompany   = factionType >= 10 && factionType <= 19;

  // "ŞİRKET" dışında hisse değeri gönderilmez
  const stockValue = isCompany ? (faction['stockValue'] ?? null) : null;

  // Oyuncu bağlamı + canlı verili payload
  const payload: Record<string, unknown> = {
    ...faction,
    members,
    vehicles,
    stockValue,
    _playerContext: {
      characterId:   player.characterId   ?? null,
      characterName: player.characterName ?? player.name,
      factionRank:   player.factionRank   ?? 0,
    },
  };

  player.call('client:showFactionUI', [JSON.stringify(payload)]);
});

// ─── Yardımcı: oyuncu birliğin üyesi mi? ─────────────────────────────────────
function isMemberOf(player: PlayerMp, factionId: number): boolean {
  return (player.getVariable('faction_id') as number | null | undefined) === factionId;
}

// ─── server:faction:inviteMember — Teklif gönder (artık doğrudan eklemez) ──────────────
safeEvent('server:faction:inviteMember', async (player: PlayerMp, factionId: number, targetPlayerId: number) => {
  if (!isPlayerValid(player) || !isMemberOf(player, factionId)) return;
  const faction = factionManager.getFaction(factionId);
  if (!faction) return;

  const target: PlayerMp | null = (mp.players as any).at(targetPlayerId) ?? null;
  if (!target || !isPlayerValid(target)) {
    player.call('chat:push', ['!{#ef4444}[BİRLİK] Belirtilen ID\'li oyuncu sunucuda bulunamadı.']);
    return;
  }
  if (target === player) {
    player.call('chat:push', ['!{#fbbf24}[BİRLİK] Kendinizi davet edemezsiniz.']);
    return;
  }
  const targetFactionId = target.getVariable('faction_id') as number | null | undefined;
  if (targetFactionId) {
    player.call('chat:push', ['!{#fbbf24}[BİRLİK] Bu oyuncu zaten bir birliğe üyedir.']);
    return;
  }

  const offerId = `fi_${factionId}_${Date.now()}`;
  pendingOffers.set(offerId, {
    type: 'faction_invite',
    factionId,
    factionName: faction['name'] as string,
    inviterCharId: (player as any).characterId ?? 0,
    inviterName: (player as any).characterName ?? player.name,
  });

  // Teklifin otomatik süresini temizle (30 saniye)
  setTimeout(() => pendingOffers.delete(offerId), 31_000);

  const offerPayload = JSON.stringify({
    id: offerId,
    type: 'faction_invite',
    title: 'Birlik Daveti',
    description: `${(player as any).characterName ?? player.name} sizi "${faction['name']}" birliğine davet etti.`,
    from: (player as any).characterName ?? player.name,
    timeout: 30,
  });
  target.call('client:receiveOffer', [offerPayload]);
  player.call('chat:push', [`!{#34d399}[BİRLİK] Davet gönderildi.`]);
});

// ─── server:faction:kickMember — Üye at ──────────────────────────────────────
safeEvent('server:faction:kickMember', async (player: PlayerMp, factionId: number, targetCharId: number) => {
  if (!isPlayerValid(player) || !isMemberOf(player, factionId)) return;  // Kendi kendini atamazsın
  const myCharId = (player as any).characterId as number | undefined;
  if (myCharId && myCharId === targetCharId) return;  await query(
    'UPDATE characters SET faction_id = NULL, faction_rank = 0, faction_division = 0 WHERE id = $1 AND faction_id = $2',
    [targetCharId, factionId]
  );  // Çevrimiçi oyuncunun hafıza değişkenlerini güncelle — F3 menasını kapat
  const targetPlayer = onlineCharacters.get(targetCharId) ?? null;
  if (targetPlayer && isPlayerValid(targetPlayer)) {
    targetPlayer.setVariable('faction_id', null);
    targetPlayer.setVariable('faction_rank', 0);
    (targetPlayer as any).factionId   = null;
    (targetPlayer as any).factionRank = 0;
    unregisterPlayerFactionOnline(targetPlayer, factionId);
    targetPlayer.call('client:closeFactionUI', []);
    targetPlayer.call('chat:push', ['!{#ef4444}[BİRLİK] Birlikten atıldınız.']);
  }  player.call('chat:push', ['!{#34d399}[BİRLİK] Üye birlikten atıldı.']);
  broadcastToFaction(factionId, { members: await fetchFactionMembers(factionId) });
});

// ─── server:faction:editMemberRank — Üye rütbesi güncelle ────────────────────
safeEvent('server:faction:editMemberRank', async (player: PlayerMp, factionId: number, targetCharId: number, newRank: number) => {
  if (!isPlayerValid(player) || !isMemberOf(player, factionId)) return;
  const faction = factionManager.getFaction(factionId);
  const ranks   = (faction?.['ranks'] as any[] | undefined) ?? [];
  const rankNum = Number(newRank);
  if (!ranks.some((r: any) => Number(r.id) === rankNum)) return; // geçersiz rütbe
  // Kendi rütbesini düzenleyemez
  const myCharId = (player as any).characterId as number | undefined;
  if (myCharId && myCharId === targetCharId) return;
  // Kendi rütbesinden daha yetkili birini atayamaz (1 = en yüksek yetki)
  const playerRank = (player.getVariable('faction_rank') as number | null | undefined) ?? 999;
  if (rankNum < playerRank) {
    player.call('chat:push', ['!{#ef4444}[BİRLİK] Kendinizden yetkili bir rütbe atayamazsınız.']);
    return;
  }
  await query(
    'UPDATE characters SET faction_rank = $1 WHERE id = $2 AND faction_id = $3',
    [rankNum, targetCharId, factionId]
  );
  broadcastToFaction(factionId, { members: await fetchFactionMembers(factionId) });
});

// ─── server:faction:editMemberDivision — Üye divizyonu güncelle ──────────────
safeEvent('server:faction:editMemberDivision', async (player: PlayerMp, factionId: number, targetCharId: number, newDivision: number) => {
  if (!isPlayerValid(player) || !isMemberOf(player, factionId)) return;
  const faction   = factionManager.getFaction(factionId);
  const divisions = (faction?.['divisions'] as any[] | undefined) ?? [];
  const divNum    = Number(newDivision);
  if (!divisions.some((d: any) => Number(d.id) === divNum)) return; // geçersiz divizyon
  await query(
    'UPDATE characters SET faction_division = $1 WHERE id = $2 AND faction_id = $3',
    [divNum, targetCharId, factionId]
  );
  broadcastToFaction(factionId, { members: await fetchFactionMembers(factionId) });
});

// ─── server:faction:updateRankCount — Rütbe sayısını güncelle (DB + cache) ───
safeEvent('server:faction:updateRankCount', async (player: PlayerMp, factionId: number, ranksJson: string) => {
  if (!isPlayerValid(player) || !isMemberOf(player, factionId)) return;
  let ranks: unknown[];
  try { ranks = JSON.parse(ranksJson); } catch { return; }
  if (!Array.isArray(ranks) || ranks.length < 1 || ranks.length > 15) return;
  await query('UPDATE factions SET ranks = $1 WHERE id = $2', [JSON.stringify(ranks), factionId]);
  const faction = factionManager.getFaction(factionId);
  if (faction) faction['ranks'] = ranks;
  broadcastToFaction(factionId, { ranks });
});

// ─── server:faction:updateDivisionCount — Divizyon sayısını güncelle ─────────
safeEvent('server:faction:updateDivisionCount', async (player: PlayerMp, factionId: number, divisionsJson: string) => {
  if (!isPlayerValid(player) || !isMemberOf(player, factionId)) return;
  let divisions: unknown[];
  try { divisions = JSON.parse(divisionsJson); } catch { return; }
  if (!Array.isArray(divisions) || divisions.length < 1 || divisions.length > 10) return;
  await query('UPDATE factions SET divisions = $1 WHERE id = $2', [JSON.stringify(divisions), factionId]);
  const faction = factionManager.getFaction(factionId);
  if (faction) faction['divisions'] = divisions;
  broadcastToFaction(factionId, { divisions });
});

// ─── server:faction:updateRankName — Rütbe adı güncelle ─────────────────────
safeEvent('server:faction:updateRankName', async (player: PlayerMp, factionId: number, rankId: number, newName: string) => {
  if (!isPlayerValid(player) || !isMemberOf(player, factionId)) return;
  const faction = factionManager.getFaction(factionId);
  if (!faction) return;
  const ranks = (faction['ranks'] as any[]);
  const rank = ranks.find((r: any) => Number(r.id) === Number(rankId));
  if (!rank) return;
  const trimmed = String(newName).trim().slice(0, 40);
  if (!trimmed) return;
  rank.name = trimmed;
  await query('UPDATE factions SET ranks = $1 WHERE id = $2', [JSON.stringify(ranks), factionId]);
  broadcastToFaction(factionId, { ranks });
});

// ─── server:faction:updateRankPermissions — Rütbe izinleri güncelle ──────────
safeEvent('server:faction:updateRankPermissions', async (player: PlayerMp, factionId: number, rankId: number, permissionsJson: string) => {
  if (!isPlayerValid(player) || !isMemberOf(player, factionId)) return;
  const faction = factionManager.getFaction(factionId);
  if (!faction) return;
  let permissions: string[];
  try { permissions = JSON.parse(permissionsJson); } catch { return; }
  if (!Array.isArray(permissions)) return;
  const ranks = (faction['ranks'] as any[]);
  const rank  = ranks.find((r: any) => Number(r.id) === Number(rankId));
  if (!rank) return;
  rank.permissions = permissions;
  await query('UPDATE factions SET ranks = $1 WHERE id = $2', [JSON.stringify(ranks), factionId]);
  broadcastToFaction(factionId, { ranks });
});

// ─── server:faction:updateDivisionName — Divizyon adı güncelle ──────────────
safeEvent('server:faction:updateDivisionName', async (player: PlayerMp, factionId: number, divId: number, newName: string) => {
  if (!isPlayerValid(player) || !isMemberOf(player, factionId)) return;
  const faction = factionManager.getFaction(factionId);
  if (!faction) return;
  const divisions = (faction['divisions'] as any[]);
  const div = divisions.find((d: any) => Number(d.id) === Number(divId));
  if (!div) return;
  const trimmed = String(newName).trim().slice(0, 40);
  if (!trimmed) return;
  div.name = trimmed;
  await query('UPDATE factions SET divisions = $1 WHERE id = $2', [JSON.stringify(divisions), factionId]);
  broadcastToFaction(factionId, { divisions });
});

// ─── server:faction:acceptOffer — Teklifi kabul et ───────────────────────────
safeEvent('server:faction:acceptOffer', async (player: PlayerMp, offerId: string) => {
  if (!isPlayerValid(player)) return;
  const offer = pendingOffers.get(offerId);
  if (!offer) {
    player.call('chat:push', ['!{#ef4444}[BİRLİK] Bu davet artık geçerli değil veya süresi dolmuş.']);
    return;
  }
  pendingOffers.delete(offerId);

  if (offer.type === 'faction_invite') {
    const characterId = (player as any).characterId;
    if (!characterId) return;
    // En düşük rütbeyi bul (id sayısı en büyük olan = en az yetkili)
    const joinFaction = factionManager.getFaction(offer.factionId);
    const joinRanks   = (joinFaction?.['ranks'] as any[] | undefined) ?? [];
    const lowestRank  = joinRanks.length > 0
      ? Math.max(...joinRanks.map((r: any) => Number(r.id)))
      : 1;
    const result = await query(
      'UPDATE characters SET faction_id = $1, faction_rank = $2, faction_division = 0 WHERE id = $3 AND (faction_id IS NULL OR faction_id != $1)',
      [offer.factionId, lowestRank, characterId]
    );
    const affected = (result as any).rowCount ?? 0;
    if (affected > 0) {
      player.setVariable('faction_id',   offer.factionId);
      player.setVariable('faction_rank', lowestRank);
      (player as any).factionId   = offer.factionId;
      (player as any).factionRank = lowestRank;
      registerPlayerFactionOnline(player, offer.factionId);
      player.call('chat:push', [`!{#34d399}[BİRLİK] "${offer.factionName}" birliğine katıldınız!`]);
      // Davet edeni bilgilendir — O(1) Map lookup
      const inviter = onlineCharacters.get(offer.inviterCharId) ?? null;
      if (inviter && isPlayerValid(inviter)) {
        inviter.call('chat:push', [`!{#34d399}[BİRLİK] Davet ettiğiniz oyuncu birliğe katıldı.`]);
      }
      broadcastToFaction(offer.factionId, { members: await fetchFactionMembers(offer.factionId) });
    } else {
      player.call('chat:push', ['!{#fbbf24}[BİRLİK] Zaten bir birliğe üye olduğunuz için bu daveti kabul edemezsiniz.']);
    }
  }
});

// ─── server:faction:rejectOffer — Teklifi reddet ─────────────────────────────
safeEvent('server:faction:rejectOffer', async (player: PlayerMp, offerId: string) => {
  if (!isPlayerValid(player)) return;
  pendingOffers.delete(offerId);
});

// ─── server:faction:leaveFaction — Birlikten ayrıl ──────────────────────────────
safeEvent('server:faction:leaveFaction', async (player: PlayerMp, factionId: number) => {
  if (!isPlayerValid(player) || !isMemberOf(player, factionId)) return;
  const characterId = (player as any).characterId as number | undefined;
  if (!characterId) return;
  await query(
    'UPDATE characters SET faction_id = NULL, faction_rank = 0, faction_division = 0 WHERE id = $1 AND faction_id = $2',
    [characterId, factionId]
  );
  player.setVariable('faction_id', null);
  player.setVariable('faction_rank', 0);
  (player as any).factionId   = null;
  (player as any).factionRank = 0;
  unregisterPlayerFactionOnline(player, factionId);
  player.call('client:closeFactionUI', []);
  player.call('chat:push', ['!{#fbbf24}[BİRLİK] Birlikten ayrıldınız.']);
  broadcastToFaction(factionId, { members: await fetchFactionMembers(factionId) });
});

// ─── server:faction:treasuryDeposit — Kasaya para at ────────────────────────
safeEvent('server:faction:treasuryDeposit', async (player: PlayerMp, factionId: number, amount: number) => {
  if (!isPlayerValid(player) || !isMemberOf(player, factionId)) return;
  const amt = Math.floor(Number(amount));
  if (isNaN(amt) || amt <= 0) return;
  const characterId = (player as any).characterId as number | undefined;
  if (!characterId) return;
  // Oyuncunun paranı kontrol et
  const charRow = await query('SELECT money FROM characters WHERE id = $1', [characterId]);
  const playerMoney = Number(charRow.rows[0]?.money ?? 0);
  if (playerMoney < amt) {
    player.call('chat:push', ['!{#ef4444}[BİRLİK KASASI] Yeterli paranız yok.']);
    return;
  }
  await query('UPDATE characters SET money = money - $1 WHERE id = $2', [amt, characterId]);
  await query('UPDATE factions SET balance = balance + $1 WHERE id = $2', [amt, factionId]);
  const faction = factionManager.getFaction(factionId);
  if (faction) faction['balance'] = (Number(faction['balance']) || 0) + amt;
  player.call('chat:push', [`!{#34d399}[BİRLİK KASASI] ₺${amt.toLocaleString()} birlik kasasına yatırıldı.`]);
  broadcastToFaction(factionId, { balance: faction?.['balance'] });
});

// ─── server:faction:treasuryWithdraw — Kasadan para çek ──────────────────────
safeEvent('server:faction:treasuryWithdraw', async (player: PlayerMp, factionId: number, amount: number) => {
  if (!isPlayerValid(player) || !isMemberOf(player, factionId)) return;
  const amt = Math.floor(Number(amount));
  if (isNaN(amt) || amt <= 0) return;
  const faction = factionManager.getFaction(factionId);
  const currentBalance = Number(faction?.['balance'] ?? 0);
  if (amt > currentBalance) {
    player.call('chat:push', ['!{#ef4444}[BİRLİK KASASI] Kasada yeterli bakiye yok.']);
    return;
  }
  const characterId = (player as any).characterId as number | undefined;
  if (!characterId) return;
  await query('UPDATE factions SET balance = balance - $1 WHERE id = $2', [amt, factionId]);
  await query('UPDATE characters SET money = money + $1 WHERE id = $2', [amt, characterId]);
  if (faction) faction['balance'] = currentBalance - amt;
  player.call('chat:push', [`!{#34d399}[BİRLİK KASASI] ₺${amt.toLocaleString()} kasadan çekildi.`]);
  broadcastToFaction(factionId, { balance: faction?.['balance'] });
});

// ─── server:faction:setChatEnabled — F Chat aç/kapat ───────────────────────────
safeEvent('server:faction:setChatEnabled', async (player: PlayerMp, factionId: number, enabled: boolean) => {
  if (!isPlayerValid(player) || !isMemberOf(player, factionId)) return;
  // Sadece en yüksek rütbe (1) yapabilir
  const playerRank = (player.getVariable('faction_rank') as number | null | undefined) ?? 999;
  if (playerRank !== 1) return;
  await query('UPDATE factions SET chat_enabled = $1 WHERE id = $2', [enabled, factionId]);
  const faction = factionManager.getFaction(factionId);
  if (faction) faction['chatEnabled'] = enabled;
  broadcastToFaction(factionId, { chatEnabled: enabled });
});

// ─── server:faction:updateDescription — Açıklama güncelle ───────────────────────
safeEvent('server:faction:updateDescription', async (player: PlayerMp, factionId: number, newDesc: string) => {
  if (!isPlayerValid(player) || !isMemberOf(player, factionId)) return;
  const playerRank = (player.getVariable('faction_rank') as number | null | undefined) ?? 999;
  if (playerRank !== 1) return;
  const trimmed = String(newDesc).trim().slice(0, 500);
  await query('UPDATE factions SET description = $1 WHERE id = $2', [trimmed, factionId]);
  const faction = factionManager.getFaction(factionId);
  if (faction) faction['description'] = trimmed;
  broadcastToFaction(factionId, { description: trimmed });
});

export function initFactionManager(): void {
  factionManager.loadAllFactions().catch((err) =>
    console.error('[FACTION] loadAllFactions hatası:', err)
  );
  // Oyuncu bağlantısı kesildiğinde birlik online cache'ini ve cooldown kaydını temizle
  mp.events.add('playerQuit', (player: PlayerMp) => {
    const factionId = player.getVariable('faction_id') as number | null | undefined;
    if (factionId) unregisterPlayerFactionOnline(player, factionId);
    factionRequestCooldowns.delete(player.id);
  });
  console.log('[SERVER] Faction Manager başlatıldı.');
}
