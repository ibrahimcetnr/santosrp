/**
 * SantosRP - Server Auth Sistemi
 *
 * Güvenlik katmanları:
 *  1. Girdi doğrulama  — tip kontrolü + uzunluk sınırı (bcrypt DoS önlemi)
 *  2. Rate limiting    — socialClub ID bazlı (NAT arkasında yanlış blok yok)
 *  3. Bellek yönetimi  — periyodik Map temizliği (memory leak önlemi)
 *  4. Player geçerlilik — async işlem sonrası disconnect kontrolü
 *  5. In-memory cache  — tekrarlayan DB SELECT'lerini önler
 *  6. Duplicate session — aynı hesap iki kez açılamaz
 */
import { bcryptCompare } from './bcrypt-pool';
import { query } from './db';
import { getCachedAccount, invalidateAccountCache } from './cache';
import { safeEvent, isPlayerValid } from './utils/safeEvent';
import { registerPlayerFactionOnline } from './FactionManager';
import { onlineCharacters, getSession } from './playerRegistry';
import { applyPlayerAppearance } from './utils/appearance';
import { loadPlayerProgression } from './payday';
import '../shared/types'; // PlayerMp augmentation (global declare)

// ─── Rate Limiting ────────────────────────────────────────────────────────────
// TODO: 1000 CCU Restart senaryosunda Bcrypt Worker Pool darboğazını önlemek için
// Login Queue (Giriş Sırası) mekanizması entegre edilmelidir.
// Sunucu yeniden başladığında tüm oyuncular eş zamanlı bcrypt isteği gönderir;
// worker pool dolduğunda yeni istekler reddedilir. Çözüm: bcrypt öncesi bekleme kuyruğu.
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;      // Başarısız deneme limiti
const WINDOW_MS    = 60_000; // 1 dakikalık pencere

// Süresi dolmuş kayıtları periyodik olarak temizle (bellek sızıntısı önlemi).
// 1000 farklı IP/ID'den başarısız deneme → Map sonsuza büyümez.
setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  for (const [key, entry] of loginAttempts) {
    if (now > entry.resetAt) {
      loginAttempts.delete(key);
      cleaned++;
    }
  }
  if (cleaned > 0) {
    console.log(`[AUTH] Rate limit tablosu temizlendi: ${cleaned} kayıt silindi.`);
  }
}, 5 * 60_000); // Her 5 dakikada bir

function getRateLimitKey(player: PlayerMp): string {
  // socialClub benzersiz Rockstar ID'sidir; NAT arkasında IP çakışmaz.
  // socialClub boşsa IP'ye geri dön.
  return player.socialClub || player.ip;
}

function checkRateLimit(key: string): { blocked: boolean; remaining: number } {
  const now = Date.now();
  const entry = loginAttempts.get(key);

  if (!entry || now > entry.resetAt) {
    loginAttempts.set(key, { count: 0, resetAt: now + WINDOW_MS });
    return { blocked: false, remaining: MAX_ATTEMPTS };
  }

  if (entry.count >= MAX_ATTEMPTS) {
    const secsLeft = Math.ceil((entry.resetAt - now) / 1000);
    return { blocked: true, remaining: secsLeft };
  }

  return { blocked: false, remaining: MAX_ATTEMPTS - entry.count };
}

function recordFailedAttempt(key: string): void {
  const entry = loginAttempts.get(key);
  if (entry) entry.count++;
}

function clearAttempts(key: string): void {
  loginAttempts.delete(key);
}

// ─── Input Validation ─────────────────────────────────────────────────────────
const MIN_USERNAME_LEN = 3;
const MAX_USERNAME_LEN = 32;
const MIN_PASSWORD_LEN = 6;
const MAX_PASSWORD_LEN = 128; // 128+ karakter bcrypt'i CPU'yu 100%'e vurur (DoS)

function validateInput(
  player: PlayerMp,
  username: unknown,
  password: unknown
): boolean {
  if (
    typeof username !== 'string' ||
    typeof password !== 'string' ||
    username.length < MIN_USERNAME_LEN ||
    username.length > MAX_USERNAME_LEN ||
    password.length < MIN_PASSWORD_LEN ||
    password.length > MAX_PASSWORD_LEN
  ) {
    if (isPlayerValid(player)) {
      player.call('client:loginError', ['Geçersiz giriş verisi.']);
    }
    console.warn(
      `[AUTH] Geçersiz input — oyuncu: ${player.name} (${player.ip}), ` +
      `username uzunluk: ${typeof username === 'string' ? username.length : 'N/A'}, ` +
      `password uzunluk: ${typeof password === 'string' ? password.length : 'N/A'}`
    );
    return false;
  }
  return true;
}

// ─── Login Lock (Race Condition Koruması) ────────────────────────────────────
// Bir oyuncudan paralel gelen birden fazla server:tryLogin event'inin
// rate-limit kontrolünü aynı anda geçmesini engeller.
const loginLocks = new Set<string>();
const accountLocks = new Set<string>(); // Aynı hesaba farklı IP'lerden eşzamanlı girişi engeller
const activeAccounts = new Map<number, PlayerMp>(); // O(1) duplicate session kontrolü
// RAGEMP disconnect sırasında player wrapper yeniden oluşturulduğundan
// player.accountId kaybolur. player.id → accountId ters haritası güvenilir kaynaktır.
const playerIdToAccountId = new Map<number, number>(); // player.id → account.id

// ─── Event Handler'ları ───────────────────────────────────────────────────────
export function registerAuthEvents(): void {

  // Oyuncu bağlandığında login ekranını göster
  safeEvent('playerJoin', async (player: PlayerMp) => {
    console.log(`[AUTH] ${player.name} bağlandı, login ekranı gösteriliyor...`);

    // Oyuncuyu login öncesi izole et: ayrı dimension'a al ve güvenli konuma koy.
    // Böylece login ekranındayken dünyada hareket edemez, başkalarına görünmez.
    if (isPlayerValid(player)) {
      try {
        player.dimension = 1000 + player.id;               // Özgün boyut — diğer oyuncularla çakışmaz
        player.position  = new mp.Vector3(0, 0, 72);       // Güvenli konuma sabitle
      } catch {
        // Nadir durum: spawn anında pointer geçersizleşti
      }
    }

    // Gecikme sonrası oyuncu hala geçerli mi kontrol et
    await new Promise(r => setTimeout(r, 1000));
    if (isPlayerValid(player)) {
      player.call('client:showLogin', []);
    }
  });

  // Login denemesi
  safeEvent('server:tryLogin', async (player: PlayerMp, username: unknown, password: unknown) => {
    const rateLimitKey = getRateLimitKey(player);

    // ── Eşzamanlı login engeli (Race Condition koruması) ──────────────────────
    // Oyuncu aynı anda 10 event gönderirse, ilki işlenirken diğerleri bekleme
    // olmadan rate-limit kontrolünü geçebilir. Lock ile bunu engelliyoruz.
    if (loginLocks.has(rateLimitKey)) {
      if (isPlayerValid(player)) {
        player.call('client:loginError', ['İşleminiz devam ediyor, lütfen bekleyin.']);
      }
      return;
    }
    loginLocks.add(rateLimitKey);

    const lockKey = String(username).trim().toLowerCase();
    try {
      console.log(`[AUTH] Login denemesi: ${String(username).slice(0, 32)} (${player.ip})`);

      // 1. Rate limit kontrolü
      const rateCheck = checkRateLimit(rateLimitKey);
      if (rateCheck.blocked) {
        if (isPlayerValid(player)) {
          player.call('client:loginError', [
            `Çok fazla hatalı deneme. ${rateCheck.remaining} saniye bekleyin.`
          ]);
        }
        return;
      }

      // 2. Girdi doğrulama (tip + uzunluk) — bcrypt DoS koruması
      if (!validateInput(player, username, password)) {
        recordFailedAttempt(rateLimitKey);
        return;
      }

      const cleanUsername = lockKey;
      const rawPassword   = password as string;

      if (accountLocks.has(lockKey)) {
        if (isPlayerValid(player)) player.call('client:loginError', ['Bu hesaba şu an giriş yapılıyor, lütfen bekleyin.']);
        return;
      }
      accountLocks.add(lockKey);

      // 3. Hesabı cache'den veya DB'den çek
      const account = await getCachedAccount(cleanUsername);

      if (!isPlayerValid(player)) return; // Async beklerken disconnect oldu

      if (!account) {
        recordFailedAttempt(rateLimitKey);
        invalidateAccountCache(cleanUsername);
        player.call('client:loginError', ['Kullanıcı adı veya şifre hatalı.']);
        console.log(`[AUTH] Hesap bulunamadı: ${cleanUsername}`);
        return;
      }

      if (account.banned) {
        const reason = account.banReason || 'Sebep belirtilmedi.';
        invalidateAccountCache(cleanUsername);
        if (isPlayerValid(player)) {
          player.call('client:loginError', [`Hesabınız banlı. Sebep: ${reason}`]);
        }
        console.log(`[AUTH] Banlı hesap giriş denemesi: ${cleanUsername}`);
        return;
      }

      // 4. Şifre doğrulama (Worker Thread'de, ana thread bloke olmaz)
      const passwordMatch = await bcryptCompare(rawPassword, account.passwordHash);

      if (!isPlayerValid(player)) return; // bcrypt beklerken disconnect oldu

      if (!passwordMatch) {
        recordFailedAttempt(rateLimitKey);
        invalidateAccountCache(cleanUsername);
        player.call('client:loginError', ['Kullanıcı adı veya şifre hatalı.']);
        console.log(`[AUTH] Hatalı şifre: ${cleanUsername}`);
        return;
      }

      // 5. Duplicate session kontrolü — O(1) Map sorgusu ile
      // Aynı hesaba ait eski oturum varsa (F1 relog, crash, vb.) eski oyuncuyu kick'le;
      // bloklama değil — yeni oturuma izin ver, eskiyi temizle.
      if (activeAccounts.has(account.id)) {
        const oldPlayer = activeAccounts.get(account.id)!;
        if (isPlayerValid(oldPlayer) && oldPlayer !== player) {
          try {
            oldPlayer.kick('Hesabınıza başka bir yerden giriş yapıldı.');
          } catch { /* Pointer geçersiz, zaten kopmuş */ }
        }
        activeAccounts.delete(account.id);
        // playerIdToAccountId'den de eski kaydı sil
        for (const [pid, aid] of playerIdToAccountId) {
          if (aid === account.id) { playerIdToAccountId.delete(pid); break; }
        }
        console.warn(
          `[AUTH] Eski oturum temizlendi ve yeni girişe izin verildi: ${cleanUsername} (accountId: ${account.id})`
        );
      }

      // 6. Başarılı giriş: DB güncelle ve cache geçersiz kıl
      const socialId = player.socialClub || player.name;
      await query('UPDATE accounts SET social_id = $1, last_login = NOW() WHERE id = $2', [socialId, account.id]);

      invalidateAccountCache(cleanUsername);

      if (!isPlayerValid(player)) return; // DB update beklerken disconnect oldu

      player.accountId       = account.id;
      player.adminLevel      = account.adminLevel;
      player.accountUsername = account.username;

      // SessionData'ya da yaz — V8 Hidden Class optimizasyonu için (player objesine yeni key eklenmez)
      const sess = getSession(player);
      sess.accountId       = account.id;
      sess.adminLevel      = account.adminLevel;
      sess.accountUsername = account.username;

      // O(1) session tracking: başarılı giriş sonrası Map'e kaydet
      activeAccounts.set(account.id, player);
      playerIdToAccountId.set(player.id, account.id);

      clearAttempts(rateLimitKey);
      console.log(`[AUTH] Başarılı giriş: ${cleanUsername} (accountId: ${account.id})`);

      // Oyuncuyu karakter seçim ekranı için izole bir boyuta al (diğer oyuncuları görmemesi için)
      try {
        player.dimension = player.id + 10000;
      } catch {
        // Pointer geçersizleştiyse call da zaten çalışmayacak
      }

      // Fetch user characters
      const charsRes = await query('SELECT id, first_name, last_name, age, gender, created, char_data FROM characters WHERE account_id = $1 ORDER BY id ASC', [account.id]);
      
      const charList = charsRes.rows.map(r => {
        let model = 'mp_m_freemode_01';
        if (r.char_data && r.char_data.model) {
          model = r.char_data.model;
        } else if (r.gender === 1) {
          model = 'mp_f_freemode_01';
        }
        
        return {
          id: r.id,
          name: r.first_name + '_' + r.last_name,
          age: r.age,
          gender: r.gender,
          model: model,
          created: r.created,
          // char_data jsonb olarak gelir, client'a string olarak gönder
          charData: r.char_data ? JSON.stringify(r.char_data) : null,
        };
      });

      player.call('client:loginSuccess', [account.username, account.adminLevel, JSON.stringify(charList)]);

      // Komut listesini gönder
      const { getAvailableCommands } = await import('./cmdHandler');
      const availableCommands = getAvailableCommands(account.adminLevel);
      player.call('client:updateCommandList', [JSON.stringify(availableCommands)]);

    } catch (error) {
      console.error(`[AUTH] Veritabanı hatası:`, error);
      if (isPlayerValid(player)) {
        player.call('client:loginError', ['Sunucu hatası. Lütfen tekrar deneyin.']);
      }
    } finally {
      // Lock'ları her durumda serbest bırak
      loginLocks.delete(rateLimitKey);
      accountLocks.delete(lockKey);
    }
  });

  // Disconnect'te login lock'u temizle (oyuncu login ekranındayken kopabilir)
  // NOT: safeEvent kullanılmıyor — disconnect anında mp.players.exists(player)
  // false döner ve safeEvent handler'ı çalıştırmadan sessizce çıkar,
  // bu da activeAccounts'un asla temizlenmemesine (relog hatası) yol açar.
  safeEvent('playerDisconnect', async (player: PlayerMp) => {
    try {
      const key = getRateLimitKey(player);
      loginLocks.delete(key);
    } catch {
      // Pointer geçersiz — önemli değil
    }

    // activeAccounts temizliği
    // player.accountId disconnect anında undefined olabilir (RAGEMP wrapper yenilenir);
    // bu nedenle playerIdToAccountId ters haritasından güvenilir şekilde çekiyoruz.
    try {
      const pid = player.id;
      const accId = playerIdToAccountId.get(pid);
      if (accId != null) {
        activeAccounts.delete(accId);
        playerIdToAccountId.delete(pid);
        console.log(`[AUTH] activeAccounts temizlendi: accountId=${accId}, playerId=${pid} (disconnect)`);
      }
    } catch { /* Pointer geçersiz */ }
  });

  // ── Karakter seçilip oyuna başlandığında ────────────────────────────────────
  safeEvent('server:playCharacter', async (player: PlayerMp, charId: number) => {
    if (!isPlayerValid(player)) return;
    const accountId = player.accountId;
    if (!accountId) return; // Giriş yapmamış

    // Yetkilendirme + karakter verisi
    const charRes = await query(
      'SELECT id, first_name, last_name, money, gender, position, char_data, faction_id, faction_rank FROM characters WHERE id = $1 AND account_id = $2',
      [charId, accountId]
    );
    if (!isPlayerValid(player)) return;
    if (charRes.rows.length === 0) {
      console.warn(`[AUTH] Yetkisiz playCharacter: accountId=${accountId}, charId=${charId}`);
      return;
    }

    const charRow = charRes.rows[0];
    player.characterId = charId;

    // Son konuma spawn et; kayıtlı konum yoksa varsayılan konumu kullan
    const DEFAULT_SPAWN = new mp.Vector3(-144.5, -594.3, 168.0);
    let spawnPos = DEFAULT_SPAWN;
    if (charRow.position) {
      try {
        const pos = typeof charRow.position === 'string'
          ? JSON.parse(charRow.position)
          : charRow.position;
        if (pos && typeof pos.x === 'number' && typeof pos.y === 'number' && typeof pos.z === 'number') {
          spawnPos = new mp.Vector3(pos.x, pos.y, pos.z);
        }
      } catch {
        // Bozuk position verisi — varsayılan konumu kullan
      }
    }

    player.call('client:hideLogin');
    
    // Default dimension'a veya veritabanından alınan dimension'a geri al
    player.dimension = 0;

    const isMale = charRow.gender !== 1;
    player.model = mp.joaat(isMale ? 'mp_m_freemode_01' : 'mp_f_freemode_01');

    // Kaydedilmiş görünümü tüm istemcilere sunucu taraflı senkronize et
    if (charRow.char_data) {
      try {
        const appearance = typeof charRow.char_data === 'string'
          ? JSON.parse(charRow.char_data)
          : charRow.char_data;
        applyPlayerAppearance(player, appearance);
      } catch (err) {
        console.error(`[AUTH] char_data parse hatası (charId=${charId}):`, err);
      }
    }

    player.spawn(spawnPos);
    player.health = 100;
    player.armour = 0;

    // HUD'u başlat: karakter adı, RAGE player ID, para
    const charName = `${charRow.first_name} ${charRow.last_name}`;
    player.characterName = charName;
    player.setVariable('characterName', charName);

    // Faction bilgilerini ata (F3 paneli ve sunucu taraflı kontroller için)
    const factionId   = charRow.faction_id   ?? null;
    const factionRank = charRow.faction_rank  ?? 0;
    player.setVariable('faction_id',   factionId);
    player.setVariable('faction_rank', factionRank);
    (player as any).factionId   = factionId;
    (player as any).factionRank = factionRank;
    if (factionId) registerPlayerFactionOnline(player, factionId);
    onlineCharacters.set(charId, player); // O(1) global karakter haritasına ekle

    // SessionData karakteri güncelle — V8 hidden class stabilize edilir
    const sess2 = getSession(player);
    sess2.characterId   = charId;
    sess2.characterName = charName;
    sess2.factionId     = factionId ?? 0;
    sess2.factionRank   = factionRank;

    player.call('client:startHUD', [charName, player.id, charRow.money]);

    // Anlık sunucu saatini hemen gönder (30s interval beklenmez)
    const _now = new Date();
    const _timeStr = `${String(_now.getHours()).padStart(2, '0')}:${String(_now.getMinutes()).padStart(2, '0')}`;
    const _dateStr = _now.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    player.call('client:hudTime', [_timeStr, _dateStr]);

    player.outputChatBox('!{#c9a84c}[SantosRP] !{#ffffff}Başarıyla giriş yaptınız, iyi roller!');
    loadPlayerProgression(player);
  });

  // ── Karakter yaratma tamamlandığında ────────────────────────────────────────
  const MAX_APPEARANCE_SIZE = 8192; // 8 KB maks appearance JSON boyutu

  safeEvent('server:saveCharacterAppearance', async (player: PlayerMp, charId: number, appearanceStr: string) => {
    if (!isPlayerValid(player)) return;
    const accountId = player.accountId;
    if (!accountId) return;

    // Boyut doğrulama
    if (typeof appearanceStr !== 'string' || appearanceStr.length > MAX_APPEARANCE_SIZE) {
      console.warn(`[AUTH] Geçersiz appearance boyutu: ${typeof appearanceStr === 'string' ? appearanceStr.length : 'N/A'} bytes, accountId=${accountId}`);
      return;
    }

    // JSON geçerlilik kontrolü
    try { JSON.parse(appearanceStr); } catch {
      console.warn(`[AUTH] Geçersiz appearance JSON, accountId=${accountId}`);
      return;
    }

    try {
      // Yetkilendirme: karakter bu hesaba ait mi?
      const accountCheck = await query('SELECT account_id FROM characters WHERE id = $1 AND account_id = $2', [charId, accountId]);
      if (!isPlayerValid(player)) return;
      if (accountCheck.rows.length === 0) {
        console.warn(`[AUTH] Yetkisiz saveCharacterAppearance: accountId=${accountId}, charId=${charId}`);
        return;
      }

      // Hile koruması (Native Crash Önlemi): JSON objesini güvenli bir şekilde doğrula
      const appearance = JSON.parse(appearanceStr);
      if (typeof appearance !== 'object' || appearance === null) throw new Error('Gecersiz gorunum verisi');

      // Appearance Sanity Check — sınır dışı ID'ler native crash'e yol açabilir
      const _MAX_COMP_ID = 500;
      const _appearanceNumFields = ['hair', 'eyebrow', 'beard', 'chest', 'torso', 'legs', 'shoes'] as const;
      for (const _field of _appearanceNumFields) {
        const _val = (appearance as Record<string, unknown>)[_field];
        if (typeof _val === 'number' && _val > _MAX_COMP_ID) {
          console.warn(`[AUTH] Appearance sanity check başarısız: ${_field}=${_val} (>${_MAX_COMP_ID}), accountId=${accountId}`);
          if (isPlayerValid(player)) player.outputChatBox('!{#ff0000}Geçersiz karakter görünümü verisi reddedildi.');
          return;
        }
      }
      if (Array.isArray(appearance.components)) {
        for (const _comp of appearance.components) {
          if (_comp && typeof _comp.drawable === 'number' && _comp.drawable > _MAX_COMP_ID) {
            console.warn(`[AUTH] Appearance sanity check başarısız: component.drawable=${_comp.drawable}, accountId=${accountId}`);
            if (isPlayerValid(player)) player.outputChatBox('!{#ff0000}Geçersiz karakter görünümü verisi reddedildi.');
            return;
          }
        }
      }

      await query('UPDATE characters SET created = 1, char_data = $1 WHERE id = $2', [appearanceStr, charId]);

      if (!isPlayerValid(player)) return;
      player.characterId = charId;
      onlineCharacters.set(charId, player); // O(1) global karakter haritasına ekle
      player.call('client:hideLogin');
      
      // İzole boyuttan çıkarıp ana dünyaya geri getir
      player.dimension = 0;
      
      const isFemale = appearance.gender === 1;
      player.model = mp.joaat(isFemale ? 'mp_f_freemode_01' : 'mp_m_freemode_01');

      // Sunucu taraflı senkronizasyon (Native Crash'e karşı try-catch korumalı)
      applyPlayerAppearance(player, appearance);
      player.spawn(new mp.Vector3(-2290.4, 281.3, 169.6));
      player.health = 100;
      player.armour = 0;

      // HUD'u başlat: karakter adını çek
      const charInfoRes = await query('SELECT first_name, last_name, money FROM characters WHERE id = $1', [charId]);
      if (isPlayerValid(player) && charInfoRes.rows.length > 0) {
        const ci = charInfoRes.rows[0];
        const charName = `${ci.first_name} ${ci.last_name}`;
        player.characterName = charName;
        player.setVariable('characterName', charName);
        // SessionData güncelle
        const sessNew = getSession(player);
        sessNew.characterId   = charId;
        sessNew.characterName = charName;
        player.call('client:startHUD', [charName, player.id, ci.money]);
        const _now2 = new Date();
        const _timeStr2 = `${String(_now2.getHours()).padStart(2, '0')}:${String(_now2.getMinutes()).padStart(2, '0')}`;
        const _dateStr2 = _now2.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        player.call('client:hudTime', [_timeStr2, _dateStr2]);
      }
      player.outputChatBox('!{#c9a84c}[SantosRP] !{#ffffff}Karakteriniz yaratıldı ve oyuna giriş yaptınız!');
    } catch (err) {
      console.error(`[AUTH] saveCharacterAppearance Hatası (charId=${charId}):`, err);
      if (isPlayerValid(player)) player.outputChatBox('!{#ff0000}Karakteriniz kaydedilirken bir hata oluştu.');
    }
  });

  console.log('[AUTH] Auth eventleri kaydedildi.');
}
