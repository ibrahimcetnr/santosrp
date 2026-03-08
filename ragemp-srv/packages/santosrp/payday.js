"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadPlayerProgression = loadPlayerProgression;
exports.startPayday = startPayday;
/**
 * SantosRP - Payday (Maaş) & Progression Sistemi
 *
 * Her 1 dakikada bir tüm oyuncuların play_time ve payday sayacını artırır.
 * 60 dakika dolunca maaş (250$) ödenir, 1 XP verilir ve level kontrolü yapılır.
 * Tüm hesap verileri save-queue üzerinden DB'ye periyodik kaydedilir.
 */
const db_1 = require("./db");
const save_queue_1 = require("./save-queue");
const safeEvent_1 = require("./utils/safeEvent");
const PAYDAY_TICK_MS = 60_000; // 1 dakika
const PAYDAY_THRESHOLD = 60; // 60 tick = 60 dakika
const PAYDAY_SALARY = 250; // Maaş tutarı ($)
function getRequiredXP(level) {
    return level * 4;
}
// ─── Karakter seçildiğinde hesap progression verilerini yükle ────────────────
async function loadPlayerProgression(player) {
    const accountId = player.accountId;
    if (!accountId)
        return;
    try {
        const res = await (0, db_1.query)('SELECT level, xp, payday, play_time FROM accounts WHERE id = $1', [accountId]);
        if (!(0, safeEvent_1.isPlayerValid)(player))
            return;
        const row = res.rows[0];
        if (row) {
            player.accountLevel = row.level ?? 1;
            player.accountXp = row.xp ?? 0;
            player.accountPayday = row.payday ?? 0;
            player.accountPlayTime = row.play_time ?? 0;
        }
        else {
            player.accountLevel = 1;
            player.accountXp = 0;
            player.accountPayday = 0;
            player.accountPlayTime = 0;
        }
    }
    catch (err) {
        console.error('[PAYDAY] Hesap verisi yüklenemedi:', err);
    }
}
// ─── Payday tick döngüsü ──────────────────────────────────────────────────────
function startPayday() {
    setInterval(() => {
        mp.players.forEach((player) => {
            try {
                if (!(0, safeEvent_1.isPlayerValid)(player) || !player.accountId || !player.characterId)
                    return;
                // play_time: istatistik amaçlı toplam oynama süresi (dakika)
                player.accountPlayTime = (player.accountPlayTime ?? 0) + 1;
                // payday sayacını artır
                player.accountPayday = (player.accountPayday ?? 0) + 1;
                if (player.accountPayday >= PAYDAY_THRESHOLD) {
                    player.accountPayday = 0;
                    // Karakterin banka hesabına maaşı güvenli Delta Queue ile ekle
                    (0, save_queue_1.updateNumericData)(player.characterId, { bank: PAYDAY_SALARY });
                    // XP ver
                    player.accountXp = (player.accountXp ?? 0) + 1;
                    const currentLevel = player.accountLevel ?? 1;
                    const requiredXP = getRequiredXP(currentLevel);
                    let isLevelUp = false;
                    if (player.accountXp >= requiredXP) {
                        player.accountXp = 0;
                        player.accountLevel = currentLevel + 1;
                        isLevelUp = true;
                        player.outputChatBox(`!{#f59e0b}╔═══════════════════════════╗\n` +
                            `!{#f59e0b}║  !{#ffffff}TEBRİKLER — SEVİYE ATLADINIZ!  !{#f59e0b}║\n` +
                            `!{#f59e0b}║  !{#22c55e}Yeni Seviye: !{#ffffff}${player.accountLevel}  !{#f59e0b}║\n` +
                            `!{#f59e0b}╚═══════════════════════════╝`);
                    }
                    const level = player.accountLevel ?? 1;
                    const xp = player.accountXp ?? 0;
                    const reqXp = getRequiredXP(level);
                    player.outputChatBox('!{#c9a84c}╔══════════════════════════════╗');
                    player.outputChatBox('!{#c9a84c}║     !{#ffffff}MAAŞ BORDROSU             !{#c9a84c}║');
                    player.outputChatBox('!{#c9a84c}╠══════════════════════════════╣');
                    player.outputChatBox(`!{#c9a84c}║  !{#22c55e}Maaş:    !{#ffffff}${PAYDAY_SALARY}$`);
                    player.outputChatBox(`!{#c9a84c}║  !{#3b82f6}Seviye:  !{#ffffff}${level}`);
                    player.outputChatBox(`!{#c9a84c}║  !{#a78bfa}XP:      !{#ffffff}${xp} / ${reqXp}`);
                    if (isLevelUp) {
                        player.outputChatBox('!{#c9a84c}║  !{#f59e0b}★ SEVİYE ATLADINIZ!');
                    }
                    player.outputChatBox('!{#c9a84c}╚══════════════════════════════╝');
                    console.log(`[PAYDAY] ${player.characterName || player.accountUsername}: ` +
                        `+${PAYDAY_SALARY}$ | Level ${level} | XP ${xp}/${reqXp}${isLevelUp ? ' | LEVELUP' : ''}`);
                }
                // Güncel hesap verilerini kaydet
                (0, save_queue_1.queueAccountSave)({
                    accountId: player.accountId,
                    level: player.accountLevel,
                    xp: player.accountXp,
                    payday: player.accountPayday,
                    play_time: player.accountPlayTime,
                });
            }
            catch (err) {
                console.error('[PAYDAY] Oyuncu döngüsü hatası:', err);
            }
        });
    }, PAYDAY_TICK_MS);
    console.log('[PAYDAY] Payday sistemi başlatıldı.');
}
//# sourceMappingURL=payday.js.map