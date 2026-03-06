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
export function broadcastInRange(player: PlayerMp, range: number, message: string): void {
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
export function broadcastFadingMessage(
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
  import('./commands'); // Alt modülleri yükle
}

