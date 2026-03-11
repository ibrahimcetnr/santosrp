"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.factionManager = void 0;
exports.registerPlayerFactionOnline = registerPlayerFactionOnline;
exports.initFactionManager = initFactionManager;
/**
 * SantosRP - Faction Manager (Server)
 * DB'den birlik listesini cache'leyen ve istemciye köprü kuran yönetici sınıfı.
 */
const db_1 = require("./db");
const safeEvent_1 = require("./utils/safeEvent");
const playerRegistry_1 = require("./playerRegistry");
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
        const res = await (0, db_1.query)('SELECT id, name, type, approvals, stock_value, founder_id, tasks, ranks, divisions, brokerFee, balance, description, chat_enabled FROM factions');
        this.factions.clear();
        for (const rawRow of res.rows) {
            const row = rowToCamel(rawRow);
            // JSON string olarak saklanan dizi alanlarını parse et
            row['tasks'] = safeParse(row['tasks'], []);
            row['ranks'] = safeParse(row['ranks'], []);
            row['divisions'] = safeParse(row['divisions'], []);
            row['approvals'] = safeParse(row['approvals'], {});
            row['balance'] = Number(row['balance']) || 0;
            row['description'] = row['description'] || 'Bu birliğin henüz bir açıklaması bulunmuyor.';
            row['chatEnabled'] = row['chat_enabled'] !== false;
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
// ─── F3 Spam / DB Pool Exhaustion Koruması ──────────────────────────────────────────────────────
// playerId → son istek timestamp'i. Oyuncu/karakter 3 saniyede bir istek atabilir.
const factionRequestCooldowns = new Map();
// ─── Birlik Çevrimiiçi Oyuncu Cache'i ───────────────────────────────────────────────────────
// factionId → çevrimiiçi oyuncu Set'i. broadcastToFaction'daki O(N) maliyetini O(k)'ya düşürür.
const factionOnlinePlayers = new Map();
/** Oyuncu birliğe katıldığında veya karakter yüklenince çağrılır */
function registerPlayerFactionOnline(player, factionId) {
    let set = factionOnlinePlayers.get(factionId);
    if (!set) {
        set = new Set();
        factionOnlinePlayers.set(factionId, set);
    }
    set.add(player);
}
/** Oyuncu birlikten ayrıldığında / atıldığında / bağlantısı kesildiğinde çağrılır */
function unregisterPlayerFactionOnline(player, factionId) {
    const set = factionOnlinePlayers.get(factionId);
    if (!set)
        return;
    set.delete(player);
    if (set.size === 0)
        factionOnlinePlayers.delete(factionId);
}
// ─── Yardımcı: birlik üyelerini DB'den çek ───────────────────────────────────
async function fetchFactionMembers(factionId) {
    const raw = await (0, db_1.query)('SELECT id, first_name, last_name, faction_rank, faction_division FROM characters WHERE faction_id = $1', [factionId]);
    return raw.rows.map((r) => {
        const c = rowToCamel(r);
        return {
            id: c['id'],
            name: `${c['firstName']} ${c['lastName']}`,
            rank: c['factionRank'],
            division: c['factionDivision'],
        };
    });
}
// ─── Yardımcı: paneli açık birlik üyelerine patch yayınla ────────────────────
function broadcastToFaction(factionId, patch) {
    const set = factionOnlinePlayers.get(factionId);
    if (!set || set.size === 0)
        return;
    const patchJson = JSON.stringify(patch);
    for (const p of set) {
        if ((0, safeEvent_1.isPlayerValid)(p)) {
            p.call('client:faction:liveUpdate', [patchJson]);
        }
    }
}
// ─── server:requestFactionData — İstemci F3'e bastığında çağrılır ────────────
const FACTION_REQUEST_COOLDOWN_MS = 3_000;
(0, safeEvent_1.safeEvent)('server:requestFactionData', async (player) => {
    if (!(0, safeEvent_1.isPlayerValid)(player))
        return;
    // Rate-limit: 3 saniye cooldown
    const now = Date.now();
    const lastRequest = factionRequestCooldowns.get(player.id) ?? 0;
    if (now - lastRequest < FACTION_REQUEST_COOLDOWN_MS)
        return;
    factionRequestCooldowns.set(player.id, now);
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
        return; // Kendi kendini atamazsın
    const myCharId = player.characterId;
    if (myCharId && myCharId === targetCharId)
        return;
    await (0, db_1.query)('UPDATE characters SET faction_id = NULL, faction_rank = 0, faction_division = 0 WHERE id = $1 AND faction_id = $2', [targetCharId, factionId]); // Çevrimiçi oyuncunun hafıza değişkenlerini güncelle — F3 menasını kapat
    const targetPlayer = playerRegistry_1.onlineCharacters.get(targetCharId) ?? null;
    if (targetPlayer && (0, safeEvent_1.isPlayerValid)(targetPlayer)) {
        targetPlayer.setVariable('faction_id', null);
        targetPlayer.setVariable('faction_rank', 0);
        targetPlayer.factionId = null;
        targetPlayer.factionRank = 0;
        unregisterPlayerFactionOnline(targetPlayer, factionId);
        targetPlayer.call('client:closeFactionUI', []);
        targetPlayer.call('chat:push', ['!{#ef4444}[BİRLİK] Birlikten atıldınız.']);
    }
    player.call('chat:push', ['!{#34d399}[BİRLİK] Üye birlikten atıldı.']);
    broadcastToFaction(factionId, { members: await fetchFactionMembers(factionId) });
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
    // Kendi rütbesini düzenleyemez
    const myCharId = player.characterId;
    if (myCharId && myCharId === targetCharId)
        return;
    // Kendi rütbesinden daha yetkili birini atayamaz (1 = en yüksek yetki)
    const playerRank = player.getVariable('faction_rank') ?? 999;
    if (rankNum < playerRank) {
        player.call('chat:push', ['!{#ef4444}[BİRLİK] Kendinizden yetkili bir rütbe atayamazsınız.']);
        return;
    }
    await (0, db_1.query)('UPDATE characters SET faction_rank = $1 WHERE id = $2 AND faction_id = $3', [rankNum, targetCharId, factionId]);
    broadcastToFaction(factionId, { members: await fetchFactionMembers(factionId) });
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
    broadcastToFaction(factionId, { members: await fetchFactionMembers(factionId) });
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
    broadcastToFaction(factionId, { ranks });
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
    broadcastToFaction(factionId, { divisions });
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
    broadcastToFaction(factionId, { ranks });
});
// ─── server:faction:updateRankPermissions — Rütbe izinleri güncelle ──────────
(0, safeEvent_1.safeEvent)('server:faction:updateRankPermissions', async (player, factionId, rankId, permissionsJson) => {
    if (!(0, safeEvent_1.isPlayerValid)(player) || !isMemberOf(player, factionId))
        return;
    const faction = exports.factionManager.getFaction(factionId);
    if (!faction)
        return;
    let permissions;
    try {
        permissions = JSON.parse(permissionsJson);
    }
    catch {
        return;
    }
    if (!Array.isArray(permissions))
        return;
    const ranks = faction['ranks'];
    const rank = ranks.find((r) => Number(r.id) === Number(rankId));
    if (!rank)
        return;
    rank.permissions = permissions;
    await (0, db_1.query)('UPDATE factions SET ranks = $1 WHERE id = $2', [JSON.stringify(ranks), factionId]);
    broadcastToFaction(factionId, { ranks });
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
    broadcastToFaction(factionId, { divisions });
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
        // En düşük rütbeyi bul (id sayısı en büyük olan = en az yetkili)
        const joinFaction = exports.factionManager.getFaction(offer.factionId);
        const joinRanks = joinFaction?.['ranks'] ?? [];
        const lowestRank = joinRanks.length > 0
            ? Math.max(...joinRanks.map((r) => Number(r.id)))
            : 1;
        const result = await (0, db_1.query)('UPDATE characters SET faction_id = $1, faction_rank = $2, faction_division = 0 WHERE id = $3 AND (faction_id IS NULL OR faction_id != $1)', [offer.factionId, lowestRank, characterId]);
        const affected = result.rowCount ?? 0;
        if (affected > 0) {
            player.setVariable('faction_id', offer.factionId);
            player.setVariable('faction_rank', lowestRank);
            player.factionId = offer.factionId;
            player.factionRank = lowestRank;
            registerPlayerFactionOnline(player, offer.factionId);
            player.call('chat:push', [`!{#34d399}[BİRLİK] "${offer.factionName}" birliğine katıldınız!`]);
            // Davet edeni bilgilendir — O(1) Map lookup
            const inviter = playerRegistry_1.onlineCharacters.get(offer.inviterCharId) ?? null;
            if (inviter && (0, safeEvent_1.isPlayerValid)(inviter)) {
                inviter.call('chat:push', [`!{#34d399}[BİRLİK] Davet ettiğiniz oyuncu birliğe katıldı.`]);
            }
            broadcastToFaction(offer.factionId, { members: await fetchFactionMembers(offer.factionId) });
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
// ─── server:faction:leaveFaction — Birlikten ayrıl ──────────────────────────────
(0, safeEvent_1.safeEvent)('server:faction:leaveFaction', async (player, factionId) => {
    if (!(0, safeEvent_1.isPlayerValid)(player) || !isMemberOf(player, factionId))
        return;
    const characterId = player.characterId;
    if (!characterId)
        return;
    await (0, db_1.query)('UPDATE characters SET faction_id = NULL, faction_rank = 0, faction_division = 0 WHERE id = $1 AND faction_id = $2', [characterId, factionId]);
    player.setVariable('faction_id', null);
    player.setVariable('faction_rank', 0);
    player.factionId = null;
    player.factionRank = 0;
    unregisterPlayerFactionOnline(player, factionId);
    player.call('client:closeFactionUI', []);
    player.call('chat:push', ['!{#fbbf24}[BİRLİK] Birlikten ayrıldınız.']);
    broadcastToFaction(factionId, { members: await fetchFactionMembers(factionId) });
});
// ─── server:faction:treasuryDeposit — Kasaya para at ────────────────────────
(0, safeEvent_1.safeEvent)('server:faction:treasuryDeposit', async (player, factionId, amount) => {
    if (!(0, safeEvent_1.isPlayerValid)(player) || !isMemberOf(player, factionId))
        return;
    const amt = Math.floor(Number(amount));
    if (isNaN(amt) || amt <= 0)
        return;
    const characterId = player.characterId;
    if (!characterId)
        return;
    // Oyuncunun paranı kontrol et
    const charRow = await (0, db_1.query)('SELECT money FROM characters WHERE id = $1', [characterId]);
    const playerMoney = Number(charRow.rows[0]?.money ?? 0);
    if (playerMoney < amt) {
        player.call('chat:push', ['!{#ef4444}[BİRLİK KASASI] Yeterli paranız yok.']);
        return;
    }
    await (0, db_1.query)('UPDATE characters SET money = money - $1 WHERE id = $2', [amt, characterId]);
    await (0, db_1.query)('UPDATE factions SET balance = balance + $1 WHERE id = $2', [amt, factionId]);
    const faction = exports.factionManager.getFaction(factionId);
    if (faction)
        faction['balance'] = (Number(faction['balance']) || 0) + amt;
    player.call('chat:push', [`!{#34d399}[BİRLİK KASASI] ₺${amt.toLocaleString()} birlik kasasına yatırıldı.`]);
    broadcastToFaction(factionId, { balance: faction?.['balance'] });
});
// ─── server:faction:treasuryWithdraw — Kasadan para çek ──────────────────────
(0, safeEvent_1.safeEvent)('server:faction:treasuryWithdraw', async (player, factionId, amount) => {
    if (!(0, safeEvent_1.isPlayerValid)(player) || !isMemberOf(player, factionId))
        return;
    const amt = Math.floor(Number(amount));
    if (isNaN(amt) || amt <= 0)
        return;
    const faction = exports.factionManager.getFaction(factionId);
    const currentBalance = Number(faction?.['balance'] ?? 0);
    if (amt > currentBalance) {
        player.call('chat:push', ['!{#ef4444}[BİRLİK KASASI] Kasada yeterli bakiye yok.']);
        return;
    }
    const characterId = player.characterId;
    if (!characterId)
        return;
    await (0, db_1.query)('UPDATE factions SET balance = balance - $1 WHERE id = $2', [amt, factionId]);
    await (0, db_1.query)('UPDATE characters SET money = money + $1 WHERE id = $2', [amt, characterId]);
    if (faction)
        faction['balance'] = currentBalance - amt;
    player.call('chat:push', [`!{#34d399}[BİRLİK KASASI] ₺${amt.toLocaleString()} kasadan çekildi.`]);
    broadcastToFaction(factionId, { balance: faction?.['balance'] });
});
// ─── server:faction:setChatEnabled — F Chat aç/kapat ───────────────────────────
(0, safeEvent_1.safeEvent)('server:faction:setChatEnabled', async (player, factionId, enabled) => {
    if (!(0, safeEvent_1.isPlayerValid)(player) || !isMemberOf(player, factionId))
        return;
    // Sadece en yüksek rütbe (1) yapabilir
    const playerRank = player.getVariable('faction_rank') ?? 999;
    if (playerRank !== 1)
        return;
    await (0, db_1.query)('UPDATE factions SET chat_enabled = $1 WHERE id = $2', [enabled, factionId]);
    const faction = exports.factionManager.getFaction(factionId);
    if (faction)
        faction['chatEnabled'] = enabled;
    broadcastToFaction(factionId, { chatEnabled: enabled });
});
// ─── server:faction:updateDescription — Açıklama güncelle ───────────────────────
(0, safeEvent_1.safeEvent)('server:faction:updateDescription', async (player, factionId, newDesc) => {
    if (!(0, safeEvent_1.isPlayerValid)(player) || !isMemberOf(player, factionId))
        return;
    const playerRank = player.getVariable('faction_rank') ?? 999;
    if (playerRank !== 1)
        return;
    const trimmed = String(newDesc).trim().slice(0, 500);
    await (0, db_1.query)('UPDATE factions SET description = $1 WHERE id = $2', [trimmed, factionId]);
    const faction = exports.factionManager.getFaction(factionId);
    if (faction)
        faction['description'] = trimmed;
    broadcastToFaction(factionId, { description: trimmed });
});
function initFactionManager() {
    exports.factionManager.loadAllFactions().catch((err) => console.error('[FACTION] loadAllFactions hatası:', err));
    // Oyuncu bağlantısı kesildiğinde birlik online cache'ini ve cooldown kaydını temizle
    mp.events.add('playerQuit', (player) => {
        const factionId = player.getVariable('faction_id');
        if (factionId)
            unregisterPlayerFactionOnline(player, factionId);
        factionRequestCooldowns.delete(player.id);
    });
    console.log('[SERVER] Faction Manager başlatıldı.');
}
//# sourceMappingURL=FactionManager.js.map