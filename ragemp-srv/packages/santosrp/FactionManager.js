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
        const res = await (0, db_1.query)('SELECT id, name, type, approvals, stock_value, founder_id, tasks, ranks, divisions, brokerFee FROM factions');
        this.factions.clear();
        for (const rawRow of res.rows) {
            const row = rowToCamel(rawRow);
            // JSON string olarak saklanan dizi alanlarını parse et
            row['tasks'] = safeParse(row['tasks'], []);
            row['ranks'] = safeParse(row['ranks'], []);
            row['divisions'] = safeParse(row['divisions'], []);
            row['approvals'] = safeParse(row['approvals'], {});
            // members artık characters tablosundan dinamik çekildiğinden cache'e almayız
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
const pendingOffers = new Map();
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
    // Üyeleri characters tablosundan çek (canlı veri — snake_case → camelCase)
    const membersRaw = await (0, db_1.query)('SELECT id, first_name, last_name, faction_rank, faction_division FROM characters WHERE faction_id = $1', [factionId]);
    const members = membersRaw.rows.map((r) => {
        const c = rowToCamel(r);
        return {
            id: c['id'],
            name: `${c['firstName']} ${c['lastName']}`,
            rank: c['factionRank'],
            division: c['factionDivision'],
        };
    });
    // Araçları vehicles tablosundan çek
    const vehiclesResult = await (0, db_1.query)('SELECT model, plate FROM vehicles WHERE faction_id = $1', [factionId]);
    const vehicles = vehiclesResult.rows.map((r) => rowToCamel(r));
    // Birlik kategorisini belirle (10-19 → ŞİRKET)
    const factionType = faction['type'];
    const isCompany = factionType >= 10 && factionType <= 19;
    // "ŞİRKET" dışında hisse değeri gönderilmez
    const stockValue = isCompany ? (faction['stockValue'] ?? null) : null;
    // Oyuncu bağlamı + canlı verili payload
    const payload = {
        ...faction,
        members,
        vehicles,
        stockValue,
        _playerContext: {
            characterId: player.characterId ?? null,
            characterName: player.characterName ?? player.name,
            factionRank: player.factionRank ?? 0,
        },
    };
    player.call('client:showFactionUI', [JSON.stringify(payload)]);
});
// ─── Yardımcı: oyuncu birliğin üyesi mi? ─────────────────────────────────────
function isMemberOf(player, factionId) {
    return player.getVariable('faction_id') === factionId;
}
// ─── server:faction:inviteMember — Teklif gönder (artık doğrudan eklemez) ──────────────
(0, safeEvent_1.safeEvent)('server:faction:inviteMember', async (player, factionId, targetPlayerId) => {
    if (!(0, safeEvent_1.isPlayerValid)(player) || !isMemberOf(player, factionId))
        return;
    const faction = exports.factionManager.getFaction(factionId);
    if (!faction)
        return;
    const target = mp.players.at(targetPlayerId) ?? null;
    if (!target || !(0, safeEvent_1.isPlayerValid)(target)) {
        player.call('chat:push', ['!{#ef4444}[BİRLİK] Belirtilen ID\'li oyuncu sunucuda bulunamadı.']);
        return;
    }
    if (target === player) {
        player.call('chat:push', ['!{#fbbf24}[BİRLİK] Kendinizi davet edemezsiniz.']);
        return;
    }
    const targetFactionId = target.getVariable('faction_id');
    if (targetFactionId) {
        player.call('chat:push', ['!{#fbbf24}[BİRLİK] Bu oyuncu zaten bir birliğe üyedir.']);
        return;
    }
    const offerId = `fi_${factionId}_${Date.now()}`;
    pendingOffers.set(offerId, {
        type: 'faction_invite',
        factionId,
        factionName: faction['name'],
        inviterCharId: player.characterId ?? 0,
        inviterName: player.characterName ?? player.name,
    });
    // Teklifin otomatik süresini temizle (30 saniye)
    setTimeout(() => pendingOffers.delete(offerId), 31_000);
    const offerPayload = JSON.stringify({
        id: offerId,
        type: 'faction_invite',
        title: 'Birlik Daveti',
        description: `${player.characterName ?? player.name} sizi "${faction['name']}" birliğine davet etti.`,
        from: player.characterName ?? player.name,
        timeout: 30,
    });
    target.call('client:receiveOffer', [offerPayload]);
    player.call('chat:push', [`!{#34d399}[BİRLİK] Davet gönderildi.`]);
});
// ─── server:faction:kickMember — Üye at ──────────────────────────────────────
(0, safeEvent_1.safeEvent)('server:faction:kickMember', async (player, factionId, targetCharId) => {
    if (!(0, safeEvent_1.isPlayerValid)(player) || !isMemberOf(player, factionId))
        return;
    await (0, db_1.query)('UPDATE characters SET faction_id = NULL, faction_rank = 0, faction_division = 0 WHERE id = $1 AND faction_id = $2', [targetCharId, factionId]); // Çevrimiçi oyuncunun hafıza değişkenlerini güncelle — F3 menasını kapat
    const allPlayers = mp.players.toArray ? mp.players.toArray() : [];
    const targetPlayer = allPlayers.find((p) => p.characterId === targetCharId);
    if (targetPlayer && (0, safeEvent_1.isPlayerValid)(targetPlayer)) {
        targetPlayer.setVariable('faction_id', null);
        targetPlayer.setVariable('faction_rank', 0);
        targetPlayer.factionId = null;
        targetPlayer.factionRank = 0;
        targetPlayer.call('client:closeFactionUI', []);
        targetPlayer.call('chat:push', ['!{#ef4444}[BİRLİK] Birlikten atıldınız.']);
    }
    player.call('chat:push', ['!{#34d399}[BİRLİK] Üye birlikten atıldı.']);
});
// ─── server:faction:editMemberRank — Üye rütbesi güncelle ────────────────────
(0, safeEvent_1.safeEvent)('server:faction:editMemberRank', async (player, factionId, targetCharId, newRank) => {
    if (!(0, safeEvent_1.isPlayerValid)(player) || !isMemberOf(player, factionId))
        return;
    const faction = exports.factionManager.getFaction(factionId);
    const ranks = faction?.['ranks'] ?? [];
    const rankNum = Number(newRank);
    if (!ranks.some((r) => Number(r.id) === rankNum))
        return; // geçersiz rütbe
    await (0, db_1.query)('UPDATE characters SET faction_rank = $1 WHERE id = $2 AND faction_id = $3', [rankNum, targetCharId, factionId]);
});
// ─── server:faction:editMemberDivision — Üye divizyonu güncelle ──────────────
(0, safeEvent_1.safeEvent)('server:faction:editMemberDivision', async (player, factionId, targetCharId, newDivision) => {
    if (!(0, safeEvent_1.isPlayerValid)(player) || !isMemberOf(player, factionId))
        return;
    const faction = exports.factionManager.getFaction(factionId);
    const divisions = faction?.['divisions'] ?? [];
    const divNum = Number(newDivision);
    if (!divisions.some((d) => Number(d.id) === divNum))
        return; // geçersiz divizyon
    await (0, db_1.query)('UPDATE characters SET faction_division = $1 WHERE id = $2 AND faction_id = $3', [divNum, targetCharId, factionId]);
});
// ─── server:faction:updateRankCount — Rütbe sayısını güncelle (DB + cache) ───
(0, safeEvent_1.safeEvent)('server:faction:updateRankCount', async (player, factionId, ranksJson) => {
    if (!(0, safeEvent_1.isPlayerValid)(player) || !isMemberOf(player, factionId))
        return;
    let ranks;
    try {
        ranks = JSON.parse(ranksJson);
    }
    catch {
        return;
    }
    if (!Array.isArray(ranks) || ranks.length < 1 || ranks.length > 15)
        return;
    await (0, db_1.query)('UPDATE factions SET ranks = $1 WHERE id = $2', [JSON.stringify(ranks), factionId]);
    const faction = exports.factionManager.getFaction(factionId);
    if (faction)
        faction['ranks'] = ranks;
});
// ─── server:faction:updateDivisionCount — Divizyon sayısını güncelle ─────────
(0, safeEvent_1.safeEvent)('server:faction:updateDivisionCount', async (player, factionId, divisionsJson) => {
    if (!(0, safeEvent_1.isPlayerValid)(player) || !isMemberOf(player, factionId))
        return;
    let divisions;
    try {
        divisions = JSON.parse(divisionsJson);
    }
    catch {
        return;
    }
    if (!Array.isArray(divisions) || divisions.length < 1 || divisions.length > 10)
        return;
    await (0, db_1.query)('UPDATE factions SET divisions = $1 WHERE id = $2', [JSON.stringify(divisions), factionId]);
    const faction = exports.factionManager.getFaction(factionId);
    if (faction)
        faction['divisions'] = divisions;
});
// ─── server:faction:updateRankName — Rütbe adı güncelle ─────────────────────
(0, safeEvent_1.safeEvent)('server:faction:updateRankName', async (player, factionId, rankId, newName) => {
    if (!(0, safeEvent_1.isPlayerValid)(player) || !isMemberOf(player, factionId))
        return;
    const faction = exports.factionManager.getFaction(factionId);
    if (!faction)
        return;
    const ranks = faction['ranks'];
    const rank = ranks.find((r) => Number(r.id) === Number(rankId));
    if (!rank)
        return;
    const trimmed = String(newName).trim().slice(0, 40);
    if (!trimmed)
        return;
    rank.name = trimmed;
    await (0, db_1.query)('UPDATE factions SET ranks = $1 WHERE id = $2', [JSON.stringify(ranks), factionId]);
});
// ─── server:faction:updateDivisionName — Divizyon adı güncelle ──────────────
(0, safeEvent_1.safeEvent)('server:faction:updateDivisionName', async (player, factionId, divId, newName) => {
    if (!(0, safeEvent_1.isPlayerValid)(player) || !isMemberOf(player, factionId))
        return;
    const faction = exports.factionManager.getFaction(factionId);
    if (!faction)
        return;
    const divisions = faction['divisions'];
    const div = divisions.find((d) => Number(d.id) === Number(divId));
    if (!div)
        return;
    const trimmed = String(newName).trim().slice(0, 40);
    if (!trimmed)
        return;
    div.name = trimmed;
    await (0, db_1.query)('UPDATE factions SET divisions = $1 WHERE id = $2', [JSON.stringify(divisions), factionId]);
});
// ─── server:faction:acceptOffer — Teklifi kabul et ───────────────────────────
(0, safeEvent_1.safeEvent)('server:faction:acceptOffer', async (player, offerId) => {
    if (!(0, safeEvent_1.isPlayerValid)(player))
        return;
    const offer = pendingOffers.get(offerId);
    if (!offer) {
        player.call('chat:push', ['!{#ef4444}[BİRLİK] Bu davet artık geçerli değil veya süresi dolmuş.']);
        return;
    }
    pendingOffers.delete(offerId);
    if (offer.type === 'faction_invite') {
        const characterId = player.characterId;
        if (!characterId)
            return;
        const result = await (0, db_1.query)('UPDATE characters SET faction_id = $1, faction_rank = 1, faction_division = 0 WHERE id = $2 AND (faction_id IS NULL OR faction_id != $1)', [offer.factionId, characterId]);
        const affected = result.rowCount ?? 0;
        if (affected > 0) {
            player.setVariable('faction_id', offer.factionId);
            player.setVariable('faction_rank', 1);
            player.factionId = offer.factionId;
            player.factionRank = 1;
            player.call('chat:push', [`!{#34d399}[BİRLİK] "${offer.factionName}" birliğine katıldınız!`]);
            // Davet edeni bilgilendir
            const allPlayers = mp.players.toArray ? mp.players.toArray() : [];
            const inviter = allPlayers.find((p) => p.characterId === offer.inviterCharId);
            if (inviter && (0, safeEvent_1.isPlayerValid)(inviter)) {
                inviter.call('chat:push', [`!{#34d399}[BİRLİK] Davet ettiğiniz oyuncu birliğe katıldı.`]);
            }
        }
        else {
            player.call('chat:push', ['!{#fbbf24}[BİRLİK] Zaten bir birliğe üye olduğunuz için bu daveti kabul edemezsiniz.']);
        }
    }
});
// ─── server:faction:rejectOffer — Teklifi reddet ─────────────────────────────
(0, safeEvent_1.safeEvent)('server:faction:rejectOffer', async (player, offerId) => {
    if (!(0, safeEvent_1.isPlayerValid)(player))
        return;
    pendingOffers.delete(offerId);
});
function initFactionManager() {
    exports.factionManager.loadAllFactions().catch((err) => console.error('[FACTION] loadAllFactions hatası:', err));
    console.log('[SERVER] Faction Manager başlatıldı.');
}
//# sourceMappingURL=FactionManager.js.map