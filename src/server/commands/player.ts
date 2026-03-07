import { registerCommand } from '../cmdHandler';
import { isPlayerValid } from '../utils/safeEvent';

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

registerCommand(
  {
    name: '/zaman',
    syntax: '',
    description: 'Toplam oynama sürenizi ve sonraki maaşa kalan süreyi gösterir',
  },
  (player: PlayerMp) => {
    const playTime = player.accountPlayTime ?? 0;
    const payday   = player.accountPayday   ?? 0;
    const kalan    = 60 - payday;

    const saatler  = Math.floor(playTime / 60);
    const dakikalar = playTime % 60;
    const zamanStr = saatler > 0
      ? `${saatler} saat ${dakikalar} dakika`
      : `${dakikalar} dakika`;

    player.outputChatBox('!{#c9a84c}╔══════════════════════════════╗');
    player.outputChatBox('!{#c9a84c}║      !{#ffffff}OYNAMA İSTATİSTİĞİ      !{#c9a84c}║');
    player.outputChatBox('!{#c9a84c}╠══════════════════════════════╣');
    player.outputChatBox(`!{#c9a84c}║  !{#3b82f6}Toplam Süre: !{#ffffff}${zamanStr}`);
    player.outputChatBox(`!{#c9a84c}║  !{#22c55e}Sonraki Maaş: !{#ffffff}${kalan} dakika`);
    player.outputChatBox('!{#c9a84c}╚══════════════════════════════╝');
  }
);

registerCommand(
  {
    name: '/seviye',
    syntax: '',
    description: 'Mevcut seviyenizi ve XP durumunuzu gösterir',
  },
  (player: PlayerMp) => {
    const level    = player.accountLevel ?? 1;
    const xp       = player.accountXp    ?? 0;
    const reqXp    = level * 4;
    const progress = Math.min(Math.floor((xp / reqXp) * 20), 20);
    const bar      = '█'.repeat(progress) + '░'.repeat(20 - progress);

    player.outputChatBox('!{#c9a84c}╔══════════════════════════════╗');
    player.outputChatBox('!{#c9a84c}║        !{#ffffff}SEVİYE BİLGİSİ         !{#c9a84c}║');
    player.outputChatBox('!{#c9a84c}╠══════════════════════════════╣');
    player.outputChatBox(`!{#c9a84c}║  !{#f59e0b}Seviye: !{#ffffff}${level}`);
    player.outputChatBox(`!{#c9a84c}║  !{#a78bfa}XP: !{#ffffff}${xp} / ${reqXp}`);
    player.outputChatBox(`!{#c9a84c}║  !{#6366f1}[!{#22c55e}${bar}!{#6366f1}]`);
    player.outputChatBox('!{#c9a84c}╚══════════════════════════════╝');
  }
);
