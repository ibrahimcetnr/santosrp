"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.factionManager = void 0;
exports.initFactionManager = initFactionManager;
/**
 * SantosRP - Faction Manager (Server)
 * DB'den birlik listesini cache'leyen ve istemciye köprü kuran yönetici sınıfı.
 */
const db_1 = require("./db");
const safeEvent_1 = require("./utils/safeEvent");
// ─── JSON parse yardımcısı (parse hatası → fallback döner) ───────────────────
function safeParse(raw, fallback) {
    if (raw === null || raw === undefined)
        return fallback;
    if (typeof raw !== 'string')
        return raw;
    try {
        return JSON.parse(raw);
    }
    catch {
        return fallback;
    }
}
// ─── snake_case → camelCase dönüştürücü ────────────────────────────────────
function toCamel(s) {
    return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}
function rowToCamel(row) {
    const out = {};
    for (const key of Object.keys(row)) {
        out[toCamel(key)] = row[key];
    }
    return out;
}
// ─── FactionManager Sınıfı ───────────────────────────────────────────────────
class FactionManager {
    factions = new Map();
    /** DB'den tüm birlikleri çekip cache'e yükler */
    async loadAllFactions() {
        const res = await (0, db_1.query)('SELECT * FROM factions');
        this.factions.clear();
        for (const rawRow of res.rows) {
            const row = rowToCamel(rawRow);
            // JSON string olarak saklanan dizi alanlarını parse et
            row['tasks'] = safeParse(row['tasks'], []);
            row['ranks'] = safeParse(row['ranks'], []);
            row['divisions'] = safeParse(row['divisions'], []);
            row['members'] = safeParse(row['members'], []);
            row['approvals'] = safeParse(row['approvals'], {});
            const id = row['id'];
            this.factions.set(id, row);
        }
        console.log(`[FACTION] ${this.factions.size} birlik cache'e yüklendi.`);
    }
    /** Cache'den birliği döndürür. Bulunamazsa null. */
    getFaction(id) {
        return this.factions.get(id) ?? null;
    }
    /** Cache'deki tüm birlikleri döndürür */
    getAllFactions() {
        return Array.from(this.factions.values());
    }
}
exports.factionManager = new FactionManager();
// ─── server:requestFactionData — İstemci F3'e bastığında çağrılır ────────────
(0, safeEvent_1.safeEvent)('server:requestFactionData', async (player) => {
    if (!(0, safeEvent_1.isPlayerValid)(player))
        return;
    const factionId = player.getVariable('faction_id');
    if (!factionId) {
        player.call('chat:push', ['!{#ef4444}[HATA] Bir birliğe üye değilsiniz.']);
        return;
    }
    const faction = exports.factionManager.getFaction(factionId);
    if (!faction) {
        player.call('chat:push', ['!{#ef4444}[HATA] Birlik verisi bulunamadı.']);
        return;
    }
    // Oyuncu bağlamını faction objesine ekle
    const payload = {
        ...faction,
        _playerContext: {
            characterId: player.characterId ?? null,
            characterName: player.characterName ?? player.name,
            factionRank: player.factionRank ?? 0,
        },
    };
    player.call('client:showFactionUI', [JSON.stringify(payload)]);
});
function initFactionManager() {
    exports.factionManager.loadAllFactions().catch((err) => console.error('[FACTION] loadAllFactions hatası:', err));
    console.log('[SERVER] Faction Manager başlatıldı.');
}
//# sourceMappingURL=FactionManager.js.map