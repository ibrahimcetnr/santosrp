/**
 * SantosRP - Payday (Maaş) & Progression Sistemi
 *
 * Her 1 dakikada bir tüm oyuncuların play_time ve payday sayacını artırır.
 * 60 dakika dolunca maaş (250$) ödenir, 1 XP verilir ve level kontrolü yapılır.
 * Tüm hesap verileri save-queue üzerinden DB'ye periyodik kaydedilir.
 */
import { query } from './db';
import { queueAccountSave, updateNumericData } from './save-queue';
import { safeEvent, isPlayerValid } from './utils/safeEvent';
import { playerSessions } from './playerRegistry';

const PAYDAY_TICK_MS    = 60_000; // 1 dakika
const PAYDAY_THRESHOLD  = 60;     // 60 tick = 60 dakika
const PAYDAY_SALARY     = 250;    // Maaş tutarı ($)

function getRequiredXP(level: number): number {
  return level * 4;
}

// ─── Karakter seçildiğinde hesap progression verilerini yükle ────────────────
export async function loadPlayerProgression(player: PlayerMp): Promise<void> {
  const sess = playerSessions.get(player.id);
  const accountId = sess?.accountId || player.accountId;
  if (!accountId) return;

  try {
    const res = await query(
      'SELECT level, xp, payday, play_time FROM accounts WHERE id = $1',
      [accountId]
    );
    if (!isPlayerValid(player)) return;

    const row = res.rows[0];
    if (row) {
      player.accountLevel    = row.level    ?? 1;
      player.accountXp       = row.xp       ?? 0;
      player.accountPayday   = row.payday   ?? 0;
      player.accountPlayTime = row.play_time ?? 0;
      // SessionData'ya da yaz — hot loop buradan okur
      if (sess) {
        sess.accountLevel    = player.accountLevel    ?? 1;
        sess.accountXp       = player.accountXp       ?? 0;
        sess.accountPayday   = player.accountPayday   ?? 0;
        sess.accountPlayTime = player.accountPlayTime ?? 0;
      }
    } else {
      player.accountLevel    = 1;
      player.accountXp       = 0;
      player.accountPayday   = 0;
      player.accountPlayTime = 0;
      if (sess) { sess.accountLevel = 1; sess.accountXp = 0; sess.accountPayday = 0; sess.accountPlayTime = 0; }
    }
  } catch (err) {
    console.error('[PAYDAY] Hesap verisi yüklenemedi:', err);
  }
}

// ─── Payday tick döngüsü ──────────────────────────────────────────────────────
export function startPayday(): void {
  setInterval(async () => {
    // ── Phase 1: Senkron in-memory güncellemeler + chat mesajları ──────────────
    // await olmadan tüm oyuncular hızlıca taranır; DB yazımı sonraki aşamada toplu yapılır.
    interface AccountSnapshot {
      accountId: number;
      level: number;
      xp: number;
      payday: number;
      play_time: number;
    }
    const accountSnapshots: AccountSnapshot[] = [];
    const bankCreditCharIds: number[]         = []; // Bu tick'te maaş hak kazanan karakterler

    mp.players.forEach((player: PlayerMp) => {
      try {
        // SessionData'dan oku — V8 tek hidden class, IC %100 hit
        const sess = playerSessions.get(player.id);
        if (!isPlayerValid(player) || !sess || !sess.accountId || !sess.characterId) return;

        // play_time: istatistik amaçlı toplam oynama süresi (dakika)
        sess.accountPlayTime++;

        // payday sayacını artır
        sess.accountPayday++;

        if (sess.accountPayday >= PAYDAY_THRESHOLD) {
          sess.accountPayday = 0;
          bankCreditCharIds.push(sess.characterId);

          // XP ver
          sess.accountXp++;

          const currentLevel = sess.accountLevel;
          const requiredXP   = getRequiredXP(currentLevel);
          let isLevelUp = false;

          if (sess.accountXp >= requiredXP) {
            sess.accountXp    = 0;
            sess.accountLevel = currentLevel + 1;
            isLevelUp         = true;
            player.outputChatBox(
              `!{#f59e0b}╔═══════════════════════════╗\n` +
              `!{#f59e0b}║  !{#ffffff}TEBRİKLER — SEVİYE ATLADINIZ!  !{#f59e0b}║\n` +
              `!{#f59e0b}║  !{#22c55e}Yeni Seviye: !{#ffffff}${sess.accountLevel}  !{#f59e0b}║\n` +
              `!{#f59e0b}╚═══════════════════════════╝`
            );
          }

          const level  = sess.accountLevel;
          const xp     = sess.accountXp;
          const reqXp  = getRequiredXP(level);

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

          console.log(
            `[PAYDAY] ${sess.characterName || sess.accountUsername}: ` +
            `+${PAYDAY_SALARY}$ | Level ${level} | XP ${xp}/${reqXp}${isLevelUp ? ' | LEVELUP' : ''}`
          );
        }

        // Snapshot — DB'ye bulk olarak yollanacak, bireysel queue yok
        accountSnapshots.push({
          accountId:  sess.accountId,
          level:      sess.accountLevel,
          xp:         sess.accountXp,
          payday:     sess.accountPayday,
          play_time:  sess.accountPlayTime,
        });

      } catch (err) {
        console.error('[PAYDAY] Oyuncu döngüsü hatası:', err);
      }
    });

    if (accountSnapshots.length === 0) return;

    // ── Phase 2: Bulk DB Yazımı — 1000 oyuncu → tek sorgu ─────────────────────

    // 2a. Bulk account UPDATE (level, xp, payday, play_time) — json_array_elements
    try {
      const json = JSON.stringify(
        accountSnapshots.map(a => ({
          id:        a.accountId,
          level:     a.level,
          xp:        a.xp,
          payday:    a.payday,
          play_time: a.play_time,
        }))
      );
      await query(
        `UPDATE accounts AS a
           SET level     = (d.data->>'level')::int,
               xp        = (d.data->>'xp')::int,
               payday    = (d.data->>'payday')::int,
               play_time = (d.data->>'play_time')::int
           FROM (SELECT json_array_elements($1::json) AS data) AS d
           WHERE a.id = (d.data->>'id')::int`,
        [json]
      );
    } catch (err) {
      // Fallback: bireysel save-queue'ya düşür — veri kaybolmaz
      console.error('[PAYDAY] Bulk hesap kayıt hatası, bireysel kuyruğa düşüyor:', err);
      for (const snap of accountSnapshots) queueAccountSave(snap);
    }

    // 2b. Bulk bank credit — WHERE id = ANY($2) ile tek sorgu
    if (bankCreditCharIds.length > 0) {
      try {
        await query(
          `UPDATE characters SET bank = bank + $1 WHERE id = ANY($2::int[])`,
          [PAYDAY_SALARY, bankCreditCharIds]
        );
        console.log(`[PAYDAY] Bulk maaş ödendi: ${bankCreditCharIds.length} karakter +${PAYDAY_SALARY}$`);
      } catch (err) {
        // Fallback: delta kuyruğuna ekle — bir sonraki 30s flush'ta yazılır
        console.error('[PAYDAY] Bulk bank credit hatası, delta kuyruğuna düşüyor:', err);
        for (const charId of bankCreditCharIds) updateNumericData(charId, { bank: PAYDAY_SALARY });
      }
    }

  }, PAYDAY_TICK_MS);

  console.log('[PAYDAY] Payday sistemi başlatıldı.');
}
