"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.queueCharacterSave = queueCharacterSave;
exports.queueAccountSave = queueAccountSave;
exports.updateNumericData = updateNumericData;
exports.updateAccountNumericData = updateAccountNumericData;
exports.flushCharacter = flushCharacter;
exports.flushCharacterSync = flushCharacterSync;
exports.requestFlush = requestFlush;
exports.flushAll = flushAll;
exports.startSaveQueue = startSaveQueue;
exports.stopSaveQueue = stopSaveQueue;
/**
 * SantosRP - Save Queue
 * Karakter verilerini toplu kaydeder, DB yükünü minimize eder.
 * Her SAVE_INTERVAL ms'de bir kuyruktaki kayıtları toplu işler.
 */
const db_1 = require("./db");
const SAVE_INTERVAL = 30_000; // 30 saniye
const saveQueue = new Map();
const accountSaveQueue = new Map();
let saveTimer = null;
// ─── Numeric Delta Queues (Atomic Balance) ───────────────────────────────────
// Mutlak değer yerine birikimli delta saklar.
// DB yazımında `SET money = money + $delta` kullanılır → paralel güncellemeler güvenli.
const charNumericDeltaQueue = new Map();
const accountNumericDeltaQueue = new Map();
// ─── Circuit Breaker ──────────────────────────────────────────────────────────
let consecutiveDbErrors = 0;
const CIRCUIT_BREAKER_THRESHOLD = 5;
/**
 * Kuyruğa karakter verisi ekle (üst üste gelirse merge eder)
 */
function queueCharacterSave(data) {
    const existing = saveQueue.get(data.characterId);
    if (existing) {
        saveQueue.set(data.characterId, { ...existing, ...data });
    }
    else {
        saveQueue.set(data.characterId, data);
    }
}
/**
 * Kuyruğa hesap (account) verisi ekle (level, xp, payday, play_time)
 */
function queueAccountSave(data) {
    const existing = accountSaveQueue.get(data.accountId);
    if (existing) {
        accountSaveQueue.set(data.accountId, { ...existing, ...data });
    }
    else {
        accountSaveQueue.set(data.accountId, data);
    }
}
/**
 * Kuyruğa karakter sayısal delta ekle (+=).
 * Aynı karaktere birden fazla para/banka güncellemesi geldiğinde
 * değerler birikerek doğru toplam hesaplanır (üst üste yazma olmaz).
 * DB yazımında `SET money = money + $delta` kullanılır.
 */
function updateNumericData(characterId, delta) {
    const existing = charNumericDeltaQueue.get(characterId) ?? {};
    charNumericDeltaQueue.set(characterId, {
        money: (existing.money ?? 0) + (delta.money ?? 0),
        bank: (existing.bank ?? 0) + (delta.bank ?? 0),
    });
}
/**
 * Hesap XP delta ekle (+=).
 */
function updateAccountNumericData(accountId, delta) {
    const existing = accountNumericDeltaQueue.get(accountId) ?? {};
    accountNumericDeltaQueue.set(accountId, {
        xp: (existing.xp ?? 0) + (delta.xp ?? 0),
    });
}
/**
 * Belirli bir karakteri kuyruktan anlık kaydet (kritik durumlar için — tek oyuncu).
 * Thundering Herd senaryosunda (1000 disconnect) requestFlush kullanın.
 */
async function flushCharacter(characterId) {
    const data = saveQueue.get(characterId);
    if (!data)
        return;
    saveQueue.delete(characterId);
    await writeCharacterToDB(data);
}
/**
 * Disconnect'te anlık, garantili kayıt (Instant Disconnect Save).
 * requestFlush'un 500ms debounce penceresinin aksine veriyi hemen yazar;
 * süreç kapanmadan veya pointer geçersiz olmadan önce DB'ye ulaşır.
 * pendingFlushIds'den de temizler — debounce kuyruğunda çift yazma olmaz.
 */
async function flushCharacterSync(characterId, accountId) {
    // Varsa bekleyen debounce isteğini iptal et
    pendingFlushIds.delete(characterId);
    const data = saveQueue.get(characterId);
    const delta = charNumericDeltaQueue.get(characterId);
    const accData = accountId ? accountSaveQueue.get(accountId) : undefined;
    const accDelta = accountId ? accountNumericDeltaQueue.get(accountId) : undefined;
    if (data)
        saveQueue.delete(characterId);
    if (delta)
        charNumericDeltaQueue.delete(characterId);
    if (accData && accountId)
        accountSaveQueue.delete(accountId);
    if (accDelta && accountId)
        accountNumericDeltaQueue.delete(accountId);
    await Promise.allSettled([
        data ? writeCharacterToDB(data) : Promise.resolve(),
        delta ? writeCharacterNumericDeltaToDB(characterId, delta) : Promise.resolve(),
        accData ? writeAccountToDB(accData) : Promise.resolve(),
        (accDelta && accountId) ? (0, db_1.query)(`UPDATE accounts SET xp = xp + $1 WHERE id = $2`, [accDelta.xp ?? 0, accountId]) : Promise.resolve(),
    ]);
}
// ─── Debounced Toplu Flush (Thundering Herd Koruması) ────────────────────────
// 1000 oyuncu aynı anda disconnect olduğunda her biri requestFlush çağırır.
// 500ms debounce penceresi: bu süre içinde gelen tüm ID'ler tek bir
// chunk'lı batch'te işlenir → PgBouncer'a 1000 paralel UPDATE yerine
// max 20'lik gruplar halinde sıralı yazma.
const pendingFlushIds = new Set();
let flushDebounceTimer = null;
function requestFlush(characterId) {
    pendingFlushIds.add(characterId);
    if (flushDebounceTimer)
        return; // Zaten aktif bir timer var, ID eklendi, bekle
    flushDebounceTimer = setTimeout(async () => {
        flushDebounceTimer = null;
        const ids = Array.from(pendingFlushIds);
        pendingFlushIds.clear();
        const entries = [];
        for (const id of ids) {
            const data = saveQueue.get(id);
            if (data) {
                saveQueue.delete(id);
                entries.push(data);
            }
        }
        if (entries.length === 0)
            return;
        console.log(`[SAVE-QUEUE] Debounced toplu flush: ${entries.length} karakter`);
        try {
            await flushInChunks(entries);
        }
        catch (err) {
            console.error('[SAVE-QUEUE] Debounced flush hatası:', err);
        }
    }, 500); // 500ms içinde gelen tüm disconnect ID'lerini biriktir
}
/**
 * Girdi listesini chunk'lar halinde işler.
 * 1000 oyuncu ç 1 kaydetme = 1000 DB sorgusu değil; 20'lik gruplar halinde gönderir.
 * Her chunk arasında setImmediate ile event loop'a nefes aldırır.
 */
async function flushInChunks(entries, chunkSize = 20) {
    for (let i = 0; i < entries.length; i += chunkSize) {
        const chunk = entries.slice(i, i + chunkSize);
        await Promise.allSettled(chunk.map(data => writeCharacterToDB(data)));
        // Event loop'a nefes: chunk sonrası zamanı geri ver
        await new Promise(r => setImmediate(r));
    }
}
/**
 * Tüm kuyruğu hemen kaydet (sunucu kapatılırken).
 * SIGTERM race condition önlemi:
 *   1. Debounce timer'ı iptal et — SIGTERM + timer çakışması engellenir
 *   2. pendingFlushIds'i temizle   — ID'ler saveQueue'da zaten mevcut
 *   3. Tüm kuyruğu chunk'lı flush et
 */
async function flushAll() {
    // 1. Debounce timer'ı iptal et
    if (flushDebounceTimer) {
        clearTimeout(flushDebounceTimer);
        flushDebounceTimer = null;
    }
    // 2. pendingFlushIds'i boşalt — asıl veri saveQueue'da, ID'leri bırakıyoruz
    pendingFlushIds.clear();
    if (saveQueue.size === 0)
        return;
    const entries = Array.from(saveQueue.values());
    saveQueue.clear();
    console.log(`[SAVE-QUEUE] Toplu kaydetme başladı: ${entries.length} karakter`);
    await flushInChunks(entries);
    // Numeric delta queue'ları temizle
    const charDeltaEntries = Array.from(charNumericDeltaQueue.entries());
    charNumericDeltaQueue.clear();
    if (charDeltaEntries.length > 0) {
        await Promise.allSettled(charDeltaEntries.map(([id, delta]) => writeCharacterNumericDeltaToDB(id, delta)));
    }
    const accountEntries = Array.from(accountSaveQueue.values());
    accountSaveQueue.clear();
    if (accountEntries.length > 0) {
        console.log(`[SAVE-QUEUE] Hesap kaydetme başladı: ${accountEntries.length} hesap`);
        await Promise.allSettled(accountEntries.map(writeAccountToDB));
    }
    // Account numeric delta queue'ları temizle (xp)
    const accountDeltaEntries = Array.from(accountNumericDeltaQueue.entries());
    accountNumericDeltaQueue.clear();
    if (accountDeltaEntries.length > 0) {
        await Promise.allSettled(accountDeltaEntries.map(([id, delta]) => (0, db_1.query)(`UPDATE accounts SET xp = xp + $1 WHERE id = $2`, [delta.xp ?? 0, id]).then(() => { consecutiveDbErrors = 0; })
            .catch(err => console.error(`[SAVE-QUEUE] Account xp delta ${id} kaydedilemedi:`, err))));
    }
    console.log(`[SAVE-QUEUE] Toplu kaydetme tamamlandı.`);
}
/**
 * DB yazma — 2 retry ile Exponential Backoff.
 * Geçici PgBouncer timeout/connection hataları veri kaybına yol açmaz.
 *   Deneme 1 başarısız → 200ms bekle → Deneme 2
 *   Deneme 2 başarısız → 400ms bekle → Deneme 3
 *   Deneme 3 başarısız → hata logla, veri kaybını kabul et
 */
async function writeCharacterToDB(data, retries = 2) {
    const updateData = {};
    if (data.money !== undefined)
        updateData.money = data.money;
    if (data.bank !== undefined)
        updateData.bank = data.bank;
    if (data.position !== undefined)
        updateData.position = JSON.stringify(data.position);
    if (data.job !== undefined)
        updateData.job = data.job;
    if (Object.keys(updateData).length === 0)
        return;
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const keys = Object.keys(updateData);
            const values = Object.values(updateData);
            const setClause = keys.map((k, i) => `"${k}" = $${i + 1}`).join(', ');
            await (0, db_1.query)(`UPDATE characters SET ${setClause} WHERE id = $${keys.length + 1}`, [...values, data.characterId]);
            consecutiveDbErrors = 0; // Başarılı — hata sayıcısını sıfırla
            return; // Başarılı — döngüden çık
        }
        catch (err) {
            if (attempt === retries) {
                // Son deneme de başarısız — veriyi kaybetmemek için kuyruğa geri ekle
                console.error(`[SAVE-QUEUE] Karakter ${data.characterId} ${retries + 1} denemede kaydedilemedi, kuyruğa geri ekleniyor:`, err);
                consecutiveDbErrors++;
                if (consecutiveDbErrors >= CIRCUIT_BREAKER_THRESHOLD) {
                    console.error(`[SAVE-QUEUE] CRITICAL: DB bağlantı sorunu. Kuyruk sonraki turda tekrar deneyecek.`);
                    consecutiveDbErrors = 0;
                }
                // Dead-letter koruması: veriyi ana kuyruğa geri ekle
                queueCharacterSave(data);
            }
            else {
                // Exponential backoff: 200ms, 400ms...
                const delay = 200 * (attempt + 1);
                console.warn(`[SAVE-QUEUE] Karakter ${data.characterId} retry ${attempt + 1}/${retries} — ${delay}ms bekleniyor`);
                await new Promise(r => setTimeout(r, delay));
            }
        }
    }
}
/**
 * Hesap (account) verisini DB'ye yaz — level, xp, payday, play_time
 */
async function writeAccountToDB(data) {
    const updateData = {};
    if (data.level !== undefined)
        updateData.level = data.level;
    if (data.xp !== undefined)
        updateData.xp = data.xp;
    if (data.payday !== undefined)
        updateData.payday = data.payday;
    if (data.play_time !== undefined)
        updateData.play_time = data.play_time;
    if (Object.keys(updateData).length === 0)
        return;
    try {
        const keys = Object.keys(updateData);
        const values = Object.values(updateData);
        const setClause = keys.map((k, i) => `"${k}" = $${i + 1}`).join(', ');
        await (0, db_1.query)(`UPDATE accounts SET ${setClause} WHERE id = $${keys.length + 1}`, [...values, data.accountId]);
    }
    catch (err) {
        console.error(`[SAVE-QUEUE] Hesap ${data.accountId} kaydedilemedi:`, err);
    }
}
/**
 * Sayısal delta değerlerini DB'ye ekle (+=).
 * `SET money = money + $1` şeklinde günceller — mutlak değer üzerine yazmaz.
 * Paralel güncellemelerde race condition'dan korur.
 */
async function writeCharacterNumericDeltaToDB(characterId, delta) {
    const parts = [];
    const values = [];
    let idx = 1;
    if (delta.money) {
        parts.push(`money = money + $${idx++}`);
        values.push(delta.money);
    }
    if (delta.bank) {
        parts.push(`bank  = bank  + $${idx++}`);
        values.push(delta.bank);
    }
    if (parts.length === 0)
        return;
    values.push(characterId);
    try {
        await (0, db_1.query)(`UPDATE characters SET ${parts.join(', ')} WHERE id = $${idx}`, values);
        consecutiveDbErrors = 0;
    }
    catch (err) {
        consecutiveDbErrors++;
        console.error(`[SAVE-QUEUE] Numeric delta karakter ${characterId} kaydedilemedi, kuyruğa geri ekleniyor:`, err);
        if (consecutiveDbErrors >= CIRCUIT_BREAKER_THRESHOLD) {
            console.error(`[SAVE-QUEUE] CRITICAL: DB bağlantı sorunu. Kuyruk sonraki turda tekrar deneyecek.`);
            consecutiveDbErrors = 0;
        }
        // Dead-letter koruması: deltayı tekrar kuyruğa ekle
        const existing = charNumericDeltaQueue.get(characterId) ?? {};
        charNumericDeltaQueue.set(characterId, {
            money: (existing.money ?? 0) + (delta.money ?? 0),
            bank: (existing.bank ?? 0) + (delta.bank ?? 0),
        });
    }
}
/**
 * Periyodik save döngüsünü başlat
 */
function startSaveQueue() {
    if (saveTimer)
        return;
    let isFlushing = false; // Overlap (kuyruk çakışması) engelleme lock'u
    saveTimer = setInterval(async () => {
        if (isFlushing)
            return; // Önceki flush henüz tamamlanmadı, bu turu atla
        isFlushing = true;
        try {
            const charEntries = saveQueue.size > 0 ? Array.from(saveQueue.values()) : [];
            if (charEntries.length > 0)
                saveQueue.clear();
            const accEntries = accountSaveQueue.size > 0 ? Array.from(accountSaveQueue.values()) : [];
            if (accEntries.length > 0)
                accountSaveQueue.clear();
            if (charEntries.length > 0) {
                console.log(`[SAVE-QUEUE] Periyodik kaydetme başladı: ${charEntries.length} karakter`);
                try {
                    await flushInChunks(charEntries);
                }
                catch (err) {
                    console.error('[SAVE-QUEUE] Periyodik karakter flush hatası:', err);
                }
            }
            // Periyodik numeric delta flush
            const charDeltaEntries = Array.from(charNumericDeltaQueue.entries());
            if (charDeltaEntries.length > 0) {
                charNumericDeltaQueue.clear();
                try {
                    await Promise.allSettled(charDeltaEntries.map(([id, delta]) => writeCharacterNumericDeltaToDB(id, delta)));
                }
                catch (err) {
                    console.error('[SAVE-QUEUE] Periyodik numeric delta flush hatası:', err);
                }
            }
            if (accEntries.length > 0) {
                console.log(`[SAVE-QUEUE] Periyodik hesap kaydetme: ${accEntries.length} hesap`);
                try {
                    await Promise.allSettled(accEntries.map(writeAccountToDB));
                }
                catch (err) {
                    console.error('[SAVE-QUEUE] Periyodik hesap flush hatası:', err);
                }
            }
        }
        finally {
            isFlushing = false;
        }
    }, SAVE_INTERVAL);
    console.log(`[SAVE-QUEUE] Başlatıldı (${SAVE_INTERVAL / 1000}s aralık).`);
}
function stopSaveQueue() {
    if (saveTimer) {
        clearInterval(saveTimer);
        saveTimer = null;
    }
}
//# sourceMappingURL=save-queue.js.map