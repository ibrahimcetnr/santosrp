"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.queueCharacterSave = queueCharacterSave;
exports.flushCharacter = flushCharacter;
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
let saveTimer = null;
/**
 * Kuyruğa karakter verisi ekle (üst üste gelirse merge eder)
 */
function queueCharacterSave(data) {
    const existing = saveQueue.get(data.characterId);
    if (existing) {
        // Mevcut veriye merge et (en son değerler kazanır)
        saveQueue.set(data.characterId, { ...existing, ...data });
    }
    else {
        saveQueue.set(data.characterId, data);
    }
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
        await Promise.allSettled(chunk.map(writeCharacterToDB));
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
        updateData.position = data.position;
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
            return; // Başarılı — döngüden çık
        }
        catch (err) {
            if (attempt === retries) {
                // Son deneme de başarısız — logla ve bırak
                console.error(`[SAVE-QUEUE] Karakter ${data.characterId} ${retries + 1} denemede kaydedilemedi:`, err);
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
 * Periyodik save döngüsünü başlat
 */
function startSaveQueue() {
    if (saveTimer)
        return;
    saveTimer = setInterval(async () => {
        if (saveQueue.size === 0)
            return;
        const entries = Array.from(saveQueue.values());
        saveQueue.clear();
        console.log(`[SAVE-QUEUE] Periyodik kaydetme başladı: ${entries.length} karakter`);
        // Chunk'lı flush: 20'lik gruplar, event loop açık kalır
        try {
            await flushInChunks(entries);
        }
        catch (err) {
            console.error('[SAVE-QUEUE] Periyodik flush hatası:', err);
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