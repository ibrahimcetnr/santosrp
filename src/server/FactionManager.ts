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
    const res = await query('SELECT * FROM factions');
    this.factions.clear();

    for (const rawRow of res.rows) {
      const row = rowToCamel(rawRow) as Record<string, unknown>;

      // JSON string olarak saklanan dizi alanlarını parse et
      row['tasks']     = safeParse<unknown[]>(row['tasks'],     []);
      row['ranks']     = safeParse<unknown[]>(row['ranks'],     []);
      row['divisions'] = safeParse<unknown[]>(row['divisions'], []);
      row['members']   = safeParse<unknown[]>(row['members'],   []);
      row['approvals'] = safeParse<Record<string, boolean>>(row['approvals'], {});

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

  // Oyuncu bağlamını faction objesine ekle
  const payload: Record<string, unknown> = {
    ...faction,
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
