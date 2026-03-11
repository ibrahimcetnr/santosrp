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
      'SELECT id, name, type, approvals, stock_value, founder_id, tasks, ranks, divisions FROM factions'
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

  // Üyeleri characters tablosundan çek (canlı veri)
  const membersRaw = await query(
    'SELECT id, firstname, lastname, faction_rank AS rank, faction_division AS division FROM characters WHERE faction_id = $1',
    [factionId]
  );
  const members = membersRaw.rows.map((r: Record<string, unknown>) => ({
    id:       r['id'],
    name:     `${r['firstname']} ${r['lastname']}`,
    rank:     r['rank'],
    division: r['division'],
  }));

  // Araçları vehicles tablosundan çek
  const vehiclesResult = await query(
    'SELECT model, plate FROM vehicles WHERE faction_id = $1',
    [factionId]
  );

  // Birlik kategorisini belirle (10-19 → ŞİRKET)
  const factionType = faction['type'] as number;
  const isCompany   = factionType >= 10 && factionType <= 19;

  // "ŞİRKET" dışında hisse değeri gönderilmez
  const stockValue = isCompany ? (faction['stockValue'] ?? null) : null;

  // Oyuncu bağlamı + canlı verili payload
  const payload: Record<string, unknown> = {
    ...faction,
    members,
    vehicles: vehiclesResult.rows,
    stockValue,
    _playerContext: {
      characterId:   player.characterId   ?? null,
      characterName: player.characterName ?? player.name,
      factionRank:   player.factionRank   ?? 0,
    },
  };

  player.call('client:showFactionUI', [JSON.stringify(payload)]);
});

export function initFactionManager(): void {
  factionManager.loadAllFactions().catch((err) =>
    console.error('[FACTION] loadAllFactions hatası:', err)
  );
  console.log('[SERVER] Faction Manager başlatıldı.');
}
