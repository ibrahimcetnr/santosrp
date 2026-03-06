/**
 * SantosRP - Merkezi Komut Yöneticisi
 * Sayısal Yetki Tabanlı (AdminLevel) Dinamik Komut Sistemi
 */
import { ICommand } from '../shared/types';
import { safeEvent, isPlayerValid } from './utils/safeEvent';

// Komut Handler Tipi
type CommandHandler = (player: PlayerMp, args: string[]) => void | Promise<void>;

interface RegisteredCommand extends ICommand {
  handler: CommandHandler;
}

// Komut deposu
const commands = new Map<string, RegisteredCommand>();

/**
 * Belirli bir mesafe içindeki oyunculara mesaj gönderir
 */
function broadcastInRange(player: PlayerMp, range: number, message: string): void {
  const pos = player.position;
  const dimension = player.dimension;

  mp.players.forEachInRange(pos, range, dimension, (target: PlayerMp) => {
    if (isPlayerValid(target) && target.characterId) {
      target.outputChatBox(message);
    }
  });
}

/** İki HEX rengi mesafe faktörüne (0.0-1.0) göre karıştırır */
function lerpColor(color1: string, color2: string, factor: number): string {
  const hex2rgb = (hex: string) => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
  const c1 = hex2rgb(color1);
  const c2 = hex2rgb(color2);
  const r = Math.round(c1[0] + factor * (c2[0] - c1[0]));
  const g = Math.round(c1[1] + factor * (c2[1] - c1[1]));
  const b = Math.round(c1[2] + factor * (c2[2] - c1[2]));
  return `!{#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}}`;
}

/** Mesafeye göre solan renk ile mesaj gönderir */
function broadcastFadingMessage(
  player: PlayerMp,
  maxRange: number,
  baseColor: string,
  darkColor: string,
  formatMsg: (color: string) => string
): void {
  const pos = player.position;
  const dimension = player.dimension;

  mp.players.forEachInRange(pos, maxRange, dimension, (target: PlayerMp) => {
    if (isPlayerValid(target) && target.characterId) {
      const dist = player.dist(target.position);
      const factor = Math.min(dist / maxRange, 1.0);
      const fadeColor = lerpColor(baseColor, darkColor, factor);
      target.outputChatBox(formatMsg(fadeColor));
    }
  });
}

/**
 * Yeni bir komut kaydeder
 * @param cmd Komut bilgileri (name, syntax, minLevel, category)
 * @param handler Komut çalıştırıldığında çağrılacak fonksiyon
 */
export function registerCommand(cmd: ICommand, handler: CommandHandler): void {
  const cmdName = cmd.name.toLowerCase();
  
  if (commands.has(cmdName)) {
    console.warn(`[CMD] Komut zaten kayıtlı: ${cmdName} (üzerine yazılıyor)`);
  }
  
  commands.set(cmdName, { ...cmd, handler });
  console.log(`[CMD] Komut kaydedildi: ${cmdName}`);
}

/**
 * Oyuncunun bir komuta erişebildiğini kontrol eder
 */
function hasCommandAccess(player: PlayerMp, cmd: ICommand): boolean {
  const p = cmd.permissions;

  if (!p || Object.keys(p).length === 0) return true;

  if (p.admin && p.admin > 0 && (player.adminLevel ?? 0) >= p.admin) return true;
  if (p.faction && p.faction > 0 && (player.factionType ?? 0) === p.faction) return true;
  if (p.vip && p.vip > 0 && (player.vipLevel ?? 0) >= p.vip) return true;
  if (p.helper && p.helper > 0 && (player.helperLevel ?? 0) >= p.helper) return true;

  return false;
}

/**
 * Oyuncunun erişebildiği tüm komutları döndürür
 * @param adminLevel Oyuncunun admin seviyesi
 * @returns Erişilebilir komutların listesi (handler olmadan)
 */
export function getAvailableCommands(adminLevel: number): ICommand[] {
  const available: ICommand[] = [];

  for (const [_, cmd] of commands) {
    const reqAdmin = cmd.permissions?.admin ?? 0;
    if (adminLevel >= reqAdmin) {
      available.push({
        name: cmd.name,
        syntax: cmd.syntax,
        permissions: cmd.permissions,
        description: cmd.description,
      });
    }
  }

  return available;
}

/**
 * Komutu çalıştırır (yetki kontrolü ile)
 * @param player Komutu çalıştıran oyuncu
 * @param message Tam komut mesajı (örn: "/setadmin 5 10")
 */
export async function executeCommand(player: PlayerMp, message: string): Promise<void> {
  if (!isPlayerValid(player)) return;
  
  const parts = message.trim().split(/\s+/);
  const cmdName = parts[0].toLowerCase();
  const args = parts.slice(1);
  
  const cmd = commands.get(cmdName);
  
  if (!cmd) {
    player.outputChatBox(`!{#ef4444}[HATA] "${cmdName}" komutu bulunamadı. Tüm komutlar için: /admins`);
    return;
  }
  
  // Yetki kontrolü
  if (!hasCommandAccess(player, cmd)) {
    player.outputChatBox('!{#ef4444}[HATA] Bu komut için yetkiniz yok.');
    return;
  }
  
  // Komutu çalıştır
  try {
    await cmd.handler(player, args);
  } catch (error) {
    console.error(`[CMD] Komut hatası (${cmdName}):`, error);
    player.outputChatBox('!{#ef4444}[HATA] Komut çalıştırılırken bir hata oluştu.');
  }
}

/**
 * Komut sistemini başlatır (event listener'ları ekler)
 */
export function initCommandSystem(): void {
  // Native bridge: CEF'te mp.invoke('chatMessage', ...) → server'da playerChat eventi
  safeEvent('playerChat', async (player: PlayerMp, text: unknown) => {
    if (!isPlayerValid(player) || !player.characterId) return;
    if (typeof text !== 'string' || text.length === 0 || text.length > 256) return;

    const clean = text.trim().replace(/</g, '&lt;').replace(/>/g, '&gt;');
    if (!clean) return;

    const charName = player.characterName || player.accountUsername || player.name;

    // Normal konuşma (15 metre). Yakında Bembeyaz, uzakta Koyu Gri
    broadcastFadingMessage(player, 15.0, '#ffffff', '#555555', (color) => {
      return `${color}${charName} diyor ki: ${clean}`;
    });

    console.log(`[CHAT] ${charName}: ${clean}`);
  });

  // Native bridge: CEF'te mp.invoke('command', 'kick 5 Sebep') → server'da playerCommand eventi
  safeEvent('playerCommand', async (player: PlayerMp, cmdText: unknown) => {
    if (!isPlayerValid(player) || !player.characterId) return;
    if (typeof cmdText !== 'string' || cmdText.length === 0) return;

    // '/' olmadan geliyor, ekle
    const fullCmd = '/' + cmdText.trim();
    await executeCommand(player, fullCmd);
  });

  console.log('[CMD] Komut sistemi başlatıldı.');
}

// ══════════════════════════════════════════════════════════════════════════════
// ÖRNEK KOMUTLAR
// ══════════════════════════════════════════════════════════════════════════════

/**
 * /report [Mesaj] - Oyuncu raporu (minLevel: 0, herkes kullanabilir)
 */
registerCommand(
  {
    name: '/report',
    syntax: '[Mesaj]',
    description: 'Yöneticilere rapor gönderir',
  },
  (player: PlayerMp, args: string[]) => {
    if (args.length === 0) {
      player.outputChatBox('!{#fbbf24}[KULLANIM] /report [Mesaj]');
      return;
    }
    
    const reportMessage = args.join(' ');
    const charName = player.characterName || player.accountUsername || player.name;
    
    // Tüm adminlere bildir (adminLevel >= 1)
    let notified = 0;
    mp.players.forEach((admin: PlayerMp) => {
      try {
        if (isPlayerValid(admin) && (admin.adminLevel ?? 0) >= 1) {
          admin.outputChatBox(
            `!{#ef4444}[REPORT] ${charName} (ID: ${player.id}): !{#ffffff}${reportMessage}`
          );
          notified++;
        }
      } catch {}
    });
    
    player.outputChatBox('!{#22c55e}[BAŞARILI] Raporunuz yöneticilere iletildi.');
    console.log(`[REPORT] ${charName} (ID: ${player.id}): ${reportMessage}`);
    
    if (notified === 0) {
      player.outputChatBox('!{#fbbf24}[BİLGİ] Şu anda çevrimiçi yetkili bulunmuyor.');
    }
  }
);

/**
 * /setadmin [ID] [Level] - Oyuncuya admin yetkisi ver (minLevel: 10)
 */
registerCommand(
  {
    name: '/setadmin',
    syntax: '[ID] [Level]',
    description: 'Oyuncuya admin yetkisi verir',
    permissions: { admin: 10 },
  },
  async (player: PlayerMp, args: string[]) => {
    if (args.length < 2) {
      player.outputChatBox('!{#fbbf24}[KULLANIM] /setadmin [ID] [Level]');
      player.outputChatBox('!{#94a3b8}Örnek: /setadmin 5 3');
      return;
    }
    
    const targetId = parseInt(args[0], 10);
    const newLevel = parseInt(args[1], 10);
    
    if (isNaN(targetId) || isNaN(newLevel)) {
      player.outputChatBox('!{#ef4444}[HATA] Geçersiz ID veya seviye.');
      return;
    }
    
    if (newLevel < 0 || newLevel > 100) {
      player.outputChatBox('!{#ef4444}[HATA] Admin seviyesi 0-100 arasında olmalı.');
      return;
    }
    
    // Hedef oyuncuyu bul
    const target = mp.players.at(targetId);
    if (!target || !isPlayerValid(target)) {
      player.outputChatBox('!{#ef4444}[HATA] Belirtilen ID\'de oyuncu bulunamadı.');
      return;
    }
    
    if (!target.accountId) {
      player.outputChatBox('!{#ef4444}[HATA] Hedef oyuncu giriş yapmamış.');
      return;
    }
    
    // Kendi seviyesinden yüksek yetki veremez
    const playerLevel = player.adminLevel ?? 0;
    if (newLevel > playerLevel) {
      player.outputChatBox(
        `!{#ef4444}[HATA] Kendi seviyenizden (${playerLevel}) yüksek yetki veremezsiniz.`
      );
      return;
    }
    
    // Veritabanını güncelle
    const { query } = await import('./db');
    try {
      await query('UPDATE accounts SET admin_level = $1 WHERE id = $2', [newLevel, target.accountId]);
      
      // Oyuncunun runtime değerini güncelle
      target.adminLevel = newLevel;
      
      // Komut listesini güncelle (yeni yetkiler için)
      const availableCommands = getAvailableCommands(newLevel);
      target.call('client:updateCommandList', [JSON.stringify(availableCommands)]);
      
      // Bildirimleri gönder
      const targetName = target.characterName || target.accountUsername || target.name;
      const adminName = player.characterName || player.accountUsername || player.name;
      
      player.outputChatBox(
        `!{#22c55e}[BAŞARILI] ${targetName} oyuncusunun admin seviyesi ${newLevel} olarak ayarlandı.`
      );
      target.outputChatBox(
        `!{#c9a84c}[BİLGİ] Admin seviyeniz ${adminName} tarafından ${newLevel} olarak güncellendi.`
      );
      
      console.log(`[SETADMIN] ${adminName} → ${targetName}: Level ${newLevel}`);
    } catch (error) {
      console.error('[SETADMIN] Database error:', error);
      player.outputChatBox('!{#ef4444}[HATA] Veritabanı hatası.');
    }
  }
);

/**
 * /kick [ID] [Sebep] - Oyuncuyu sunucudan atar (minLevel: 5)
 */
registerCommand(
  {
    name: '/kick',
    syntax: '[ID] [Sebep]',
    description: 'Oyuncuyu sunucudan atar',
    permissions: { admin: 5 },
  },
  (player: PlayerMp, args: string[]) => {
    if (args.length < 2) {
      player.outputChatBox('!{#fbbf24}[KULLANIM] /kick [ID] [Sebep]');
      player.outputChatBox('!{#94a3b8}Örnek: /kick 5 Trolleme');
      return;
    }
    
    const targetId = parseInt(args[0], 10);
    const reason = args.slice(1).join(' ');
    
    if (isNaN(targetId)) {
      player.outputChatBox('!{#ef4444}[HATA] Geçersiz ID.');
      return;
    }
    
    const target = mp.players.at(targetId);
    if (!target || !isPlayerValid(target)) {
      player.outputChatBox('!{#ef4444}[HATA] Belirtilen ID\'de oyuncu bulunamadı.');
      return;
    }
    
    const targetLevel = target.adminLevel ?? 0;
    const playerLevel = player.adminLevel ?? 0;
    
    // Kendi seviyesinden yüksek yetkiliyi kickleyemez
    if (targetLevel >= playerLevel && target !== player) {
      player.outputChatBox('!{#ef4444}[HATA] Kendi seviyenizden yüksek veya eşit yetkiliyi kickleyemezsiniz.');
      return;
    }
    
    const targetName = target.characterName || target.accountUsername || target.name;
    const adminName = player.characterName || player.accountUsername || player.name;
    
    // Global bildirim
    mp.players.broadcast(
      `!{#ef4444}[KICK] ${targetName} sunucudan atıldı. Sebep: ${reason} (Yetkili: ${adminName})`
    );
    
    console.log(`[KICK] ${adminName} kicked ${targetName}: ${reason}`);
    
    // Hedefi at
    target.kick(`Sunucudan atıldınız.\nSebep: ${reason}\nYetkili: ${adminName}`);
  }
);

/**
 * /admins - Çevrimiçi yöneticileri listeler (minLevel: 0)
 */
registerCommand(
  {
    name: '/admins',
    syntax: '',

    description: 'Çevrimiçi yöneticileri listeler',
  },
  (player: PlayerMp, _args: string[]) => {
    const admins: string[] = [];
    
    mp.players.forEach((p: PlayerMp) => {
      try {
        if (isPlayerValid(p) && p.characterId) {
          const level = p.adminLevel ?? 0;
          if (level > 0) {
            const name = p.characterName || p.accountUsername || p.name;
            admins.push(`${name} (ID: ${p.id}, Seviye: ${level})`);
          }
        }
      } catch {}
    });
    
    if (admins.length === 0) {
      player.outputChatBox('!{#fbbf24}[BİLGİ] Şu anda çevrimiçi yetkili bulunmuyor.');
    } else {
      player.outputChatBox('!{#c9a84c}[YETKİLİLER] Çevrimiçi yöneticiler:');
      admins.forEach((admin) => {
        player.outputChatBox(`!{#ffffff}• ${admin}`);
      });
    }
  }
);

/**
 * /veh [Model] - Oyuncuya araç spawn eder (minLevel: 8)
 */
registerCommand(
  {
    name: '/veh',
    syntax: '[Model]',
    description: 'Araç spawn eder',
    permissions: { admin: 8 },
  },
  (player: PlayerMp, args: string[]) => {
    if (args.length === 0) {
      player.outputChatBox('!{#fbbf24}[KULLANIM] /veh [Model]');
      player.outputChatBox('!{#94a3b8}Örnek: /veh adder');
      return;
    }
    
    const modelName = args[0].toLowerCase();
    
    // Oyuncunun önünde araç spawn et
    const pos = player.position;
    const heading = player.heading;
    
    // 5 birim ileri
    const rad = (heading * Math.PI) / 180;
    const spawnX = pos.x + Math.sin(rad) * 5;
    const spawnY = pos.y + Math.cos(rad) * 5;
    
    try {
      const vehicle = mp.vehicles.new(
        mp.joaat(modelName),
        new mp.Vector3(spawnX, spawnY, pos.z),
        {
          heading: heading,
          numberPlate: 'ADMIN',
          color: [[0, 0, 0], [0, 0, 0]],
        }
      );
      
      player.outputChatBox(`!{#22c55e}[BAŞARILI] ${modelName} aracı spawn edildi.`);
      console.log(`[VEH] ${player.characterName || player.name} spawned ${modelName}`);
    } catch (error) {
      player.outputChatBox('!{#ef4444}[HATA] Geçersiz araç modeli.');
      console.error('[VEH] Invalid model:', modelName, error);
    }
  }
);

// ════════════════════════════════════════════════════════════════════════════════
// ROLEPLAY CHAT KOMUTLARI
// ════════════════════════════════════════════════════════════════════════════════

registerCommand(
  { name: '/me', syntax: '[Aksiyon]', description: 'Karakter eylemi belirtir (15m)', permissions: {} },
  (player: PlayerMp, args: string[]) => {
    if (args.length === 0) {
      player.outputChatBox('!{#fbbf24}[KULLANIM] /me [Aksiyon]');
      return;
    }
    const charName = player.characterName || player.accountUsername || player.name;
    // 15 Metre - Mor/Lavenderdan (#c2a2da) Koyu Mora (#4a3060) solar
    broadcastFadingMessage(player, 15.0, '#c2a2da', '#4a3060', (color) => {
      return `${color}* ${charName} ${args.join(' ')}`;
    });
  }
);

registerCommand(
  { name: '/do', syntax: '[Durum]', description: 'Çevre/Karakter durumu belirtir (15m)', permissions: {} },
  (player: PlayerMp, args: string[]) => {
    if (args.length === 0) {
      player.outputChatBox('!{#fbbf24}[KULLANIM] /do [Durum]');
      return;
    }
    const charName = player.characterName || player.accountUsername || player.name;
    // 15 Metre - Mor/Lavenderdan (#c2a2da) Koyu Mora (#4a3060) solar
    broadcastFadingMessage(player, 15.0, '#c2a2da', '#4a3060', (color) => {
      return `${color}* ${args.join(' ')} (( ${charName} ))`;
    });
  }
);

registerCommand(
  { name: '/s', syntax: '[Mesaj]', description: 'Bağırarak konuşursunuz (30m)', permissions: {} },
  (player: PlayerMp, args: string[]) => {
    if (args.length === 0) {
      player.outputChatBox('!{#fbbf24}[KULLANIM] /s [Mesaj]');
      return;
    }
    const charName = player.characterName || player.accountUsername || player.name;
    // 30 Metre - Parlak Sarıdan (#fbbf24) Koyu Kahverengiye (#66541b) solar
    broadcastFadingMessage(player, 30.0, '#fbbf24', '#66541b', (color) => {
      return `${color}${charName} bağırır: ${args.join(' ')}!`;
    });
  }
);

registerCommand(
  { name: '/l', syntax: '[Mesaj]', description: 'Kısık sesle konuşursunuz (3m)', permissions: {} },
  (player: PlayerMp, args: string[]) => {
    if (args.length === 0) {
      player.outputChatBox('!{#fbbf24}[KULLANIM] /l [Mesaj]');
      return;
    }
    const charName = player.characterName || player.accountUsername || player.name;
    // 3 Metre - Açık Griden (#d1d5db) Neredeyse Siyaha (#333333) solar
    broadcastFadingMessage(player, 3.0, '#d1d5db', '#333333', (color) => {
      return `${color}${charName} kısık sesle: ${args.join(' ')}`;
    });
  }
);

registerCommand(
  { name: '/b', syntax: '[Mesaj]', description: 'Lokal OOC sohbet (15m)', permissions: {} },
  (player: PlayerMp, args: string[]) => {
    if (args.length === 0) {
      player.outputChatBox('!{#fbbf24}[KULLANIM] /b [Mesaj]');
      return;
    }
    const charName = player.characterName || player.accountUsername || player.name;
    const message = `!{#b3b3b3}(( [OOC] ${charName}: ${args.join(' ')} ))`;
    broadcastInRange(player, 15.0, message);
  }
);

function sendPrivateMessage(player: PlayerMp, args: string[]): void {
  if (args.length < 2) {
    player.outputChatBox('!{#fbbf24}[KULLANIM] /pm [ID] [Mesaj]');
    return;
  }

  const targetId = parseInt(args[0], 10);
  if (isNaN(targetId)) {
    player.outputChatBox('!{#ef4444}[HATA] Geçersiz ID.');
    return;
  }

  const target = mp.players.at(targetId);
  if (!target || !isPlayerValid(target)) {
    player.outputChatBox('!{#ef4444}[HATA] Oyuncu bulunamadı.');
    return;
  }

  const charName = player.characterName || player.accountUsername || player.name;
  const targetName = target.characterName || target.accountUsername || target.name;
  const mesaj = args.slice(1).join(' ');

  player.outputChatBox(`!{#facc15}[PM] ${targetName} (${target.id}) kişisine: ${mesaj}`);
  target.outputChatBox(`!{#facc15}[PM] ${charName} (${player.id}) kişisinden: ${mesaj}`);
}

registerCommand(
  { name: '/pm', syntax: '[ID] [Mesaj]', description: 'Belirtilen ID\'ye özel mesaj gönderir', permissions: {} },
  sendPrivateMessage
);

registerCommand(
  { name: '/w', syntax: '[ID] [Mesaj]', description: 'Fısıldama (/pm takı adı)', permissions: {} },
  sendPrivateMessage
);
