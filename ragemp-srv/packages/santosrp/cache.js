"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCachedAccount = getCachedAccount;
exports.invalidateAccountCache = invalidateAccountCache;
exports.getCacheStats = getCacheStats;
const db_1 = require("./db");
const CACHE_TTL_MS = 5 * 60_000;
const MAX_CACHE_SIZE = 2_000;
const accountCache = new Map();
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of accountCache) {
        if (now >= entry.expiry)
            accountCache.delete(key);
    }
}, 2 * 60_000);
async function getCachedAccount(username) {
    const key = username.toLowerCase();
    const cached = accountCache.get(key);
    if (cached && Date.now() < cached.expiry) {
        return cached.data;
    }
    const res = await (0, db_1.query)("SELECT * FROM accounts WHERE username = $1 LIMIT 1", [key]);
    let account = res.rows[0];
    if (account) {
        // password_hash'i ayrı tut — cache'e koymayacağız
        const passwordHash = account.password;
        account = {
            ...account,
            adminLevel: account.admin_level,
            banReason: account.ban_reason,
            lastLogin: account.last_login,
            socialId: account.social_id,
            passwordHash // bcrypt compare için gerekli, cache'e de eklenir ama SELECT * yerine sadece bunu tutar
        };
        // Orijinal snake_case password alanını sil
        delete account.password;
    }
    if (account) {
        if (accountCache.size >= MAX_CACHE_SIZE) {
            const firstKey = accountCache.keys().next().value;
            if (firstKey !== undefined)
                accountCache.delete(firstKey);
        }
        accountCache.set(key, { data: account, expiry: Date.now() + CACHE_TTL_MS });
    }
    return account;
}
function invalidateAccountCache(username) {
    accountCache.delete(username.toLowerCase());
}
function getCacheStats() {
    return { accountCacheSize: accountCache.size };
}
//# sourceMappingURL=cache.js.map