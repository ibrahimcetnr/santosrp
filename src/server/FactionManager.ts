/**
 * SantosRP - Faction Manager (Server)
 * DB'den birlik listesini cache'leyen ve istemciye köprü kuran yönetici sınıfı.
 */
import { query } from './db';
import { safeEvent, isPlayerValid } from './utils/safeEvent';

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
  'SELECT id, name, type, approvals, stock_value, founder_id, tasks, ranks, divisions, brokerFee FROM factions'
);
    this.factions.clear();

    for (const rawRow of res.rows) {
      const row = rowToCamel(rawRow) as Record<string, unknown>;

      // JSON string olarak saklanan dizi alanlarını parse et
      row['tasks']     = safeParse<unknown[]>(row['tasks'],     []);
      row['ranks']     = safeParse<unknown[]>(row['ranks'],     []);
      row['divisions'] = safeParse<unknown[]>(row['divisions'], []);
      row['approvals'] = safeParse<Record<string, boolean>>(row['approvals'], {});
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

// ─── server:requestFactionData — İstemci F3'e bastığında çağrılır ────────────
safeEvent('server:requestFactionData', async (player: PlayerMp) => {
  if (!isPlayerValid(player)) return;

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
  if (!isPlayerValid(player) || !isMemberOf(player, factionId)) return;
  await query(
    'UPDATE characters SET faction_id = NULL, faction_rank = 0, faction_division = 0 WHERE id = $1 AND faction_id = $2',
    [targetCharId, factionId]
  );  // Çevrimiçi oyuncunun hafıza değişkenlerini güncelle — F3 menasını kapat
  const allPlayers: PlayerMp[] = (mp.players as any).toArray ? (mp.players as any).toArray() : [];
  const targetPlayer = allPlayers.find((p: PlayerMp) => (p as any).characterId === targetCharId);
  if (targetPlayer && isPlayerValid(targetPlayer)) {
    targetPlayer.setVariable('faction_id', null);
    targetPlayer.setVariable('faction_rank', 0);
    (targetPlayer as any).factionId   = null;
    (targetPlayer as any).factionRank = 0;
    targetPlayer.call('client:closeFactionUI', []);
    targetPlayer.call('chat:push', ['!{#ef4444}[BİRLİK] Birlikten atıldınız.']);
  }  player.call('chat:push', ['!{#34d399}[BİRLİK] Üye birlikten atıldı.']);
});

// ─── server:faction:editMemberRank — Üye rütbesi güncelle ────────────────────
safeEvent('server:faction:editMemberRank', async (player: PlayerMp, factionId: number, targetCharId: number, newRank: number) => {
  if (!isPlayerValid(player) || !isMemberOf(player, factionId)) return;
  const faction = factionManager.getFaction(factionId);
  const ranks   = (faction?.['ranks'] as any[] | undefined) ?? [];
  const rankNum = Number(newRank);
  if (!ranks.some((r: any) => Number(r.id) === rankNum)) return; // geçersiz rütbe
  await query(
    'UPDATE characters SET faction_rank = $1 WHERE id = $2 AND faction_id = $3',
    [rankNum, targetCharId, factionId]
  );
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
    const result = await query(
      'UPDATE characters SET faction_id = $1, faction_rank = 1, faction_division = 0 WHERE id = $2 AND (faction_id IS NULL OR faction_id != $1)',
      [offer.factionId, characterId]
    );
    const affected = (result as any).rowCount ?? 0;
    if (affected > 0) {
      player.setVariable('faction_id',   offer.factionId);
      player.setVariable('faction_rank', 1);
      (player as any).factionId   = offer.factionId;
      (player as any).factionRank = 1;
      player.call('chat:push', [`!{#34d399}[BİRLİK] "${offer.factionName}" birliğine katıldınız!`]);
      // Davet edeni bilgilendir
      const allPlayers: PlayerMp[] = (mp.players as any).toArray ? (mp.players as any).toArray() : [];
      const inviter = allPlayers.find((p: PlayerMp) => (p as any).characterId === offer.inviterCharId);
      if (inviter && isPlayerValid(inviter)) {
        inviter.call('chat:push', [`!{#34d399}[BİRLİK] Davet ettiğiniz oyuncu birliğe katıldı.`]);
      }
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

export function initFactionManager(): void {
  factionManager.loadAllFactions().catch((err) =>
    console.error('[FACTION] loadAllFactions hatası:', err)
  );
  console.log('[SERVER] Faction Manager başlatıldı.');
}
