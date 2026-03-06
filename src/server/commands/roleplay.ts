import { registerCommand, broadcastFadingMessage, broadcastInRange } from '../cmdHandler';
import { isPlayerValid } from '../utils/safeEvent';

registerCommand(
  { name: '/me', syntax: '[Aksiyon]', description: 'Karakter eylemi (15m)', permissions: {} },
  (player: PlayerMp, args: string[]) => {
    if (args.length === 0) {
      player.outputChatBox('!{#fbbf24}[KULLANIM] /me [Aksiyon]');
      return;
    }
    const charName = player.characterName || player.accountUsername || player.name;
    const msg = args.join(' ').replace(/"(.*?)"/g, '!{#ffffff}"$1"!{#c2a2da}');
    broadcastFadingMessage(player, 15.0, '#c2a2da', '#4a3060', (color) => {
      return `${color}* ${charName} ${msg}`;
    });
  }
);

registerCommand(
  { name: '/do', syntax: '[Durum]', description: 'Çevre durumu (15m)', permissions: {} },
  (player: PlayerMp, args: string[]) => {
    if (args.length === 0) {
      player.outputChatBox('!{#fbbf24}[KULLANIM] /do [Durum]');
      return;
    }
    const charName = player.characterName || player.accountUsername || player.name;
    const msg = args.join(' ').replace(/"(.*?)"/g, '!{#ffffff}"$1"!{#c2a2da}');
    broadcastFadingMessage(player, 15.0, '#c2a2da', '#4a3060', (color) => {
      return `${color}* ${msg} (( ${charName} ))`;
    });
  }
);

registerCommand(
  { name: '/s', syntax: '[Mesaj]', description: 'Bağırma (30m)', permissions: {} },
  (player: PlayerMp, args: string[]) => {
    if (args.length === 0) {
      player.outputChatBox('!{#fbbf24}[KULLANIM] /s [Mesaj]');
      return;
    }
    const charName = player.characterName || player.accountUsername || player.name;
    broadcastFadingMessage(player, 30.0, '#fbbf24', '#66541b', (color) => {
      return `${color}${charName} bağırır: ${args.join(' ')}!`;
    });
  }
);

registerCommand(
  { name: '/l', syntax: '[Mesaj]', description: 'Kısık Ses (3m)', permissions: {} },
  (player: PlayerMp, args: string[]) => {
    if (args.length === 0) {
      player.outputChatBox('!{#fbbf24}[KULLANIM] /l [Mesaj]');
      return;
    }
    const charName = player.characterName || player.accountUsername || player.name;
    broadcastFadingMessage(player, 3.0, '#d1d5db', '#333333', (color) => {
      return `${color}${charName} kısık sesle: ${args.join(' ')}`;
    });
  }
);

registerCommand(
  { name: '/b', syntax: '[Mesaj]', description: 'Lokal OOC (15m)', permissions: {} },
  (player: PlayerMp, args: string[]) => {
    if (args.length === 0) {
      player.outputChatBox('!{#fbbf24}[KULLANIM] /b [Mesaj]');
      return;
    }
    const charName = player.characterName || player.accountUsername || player.name;
    broadcastInRange(player, 15.0, `!{#b3b3b3}(( [OOC] ${charName}: ${args.join(' ')} ))`);
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
