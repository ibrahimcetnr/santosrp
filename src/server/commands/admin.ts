import { registerCommand, getAvailableCommands } from '../cmdHandler';
import { isPlayerValid } from '../utils/safeEvent';

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

    const target = mp.players.at(targetId);
    if (!target || !isPlayerValid(target)) {
      player.outputChatBox('!{#ef4444}[HATA] Belirtilen ID\'de oyuncu bulunamadı.');
      return;
    }

    if (!target.accountId) {
      player.outputChatBox('!{#ef4444}[HATA] Hedef oyuncu giriş yapmamış.');
      return;
    }

    const playerLevel = player.adminLevel ?? 0;
    if (newLevel > playerLevel) {
      player.outputChatBox(
        `!{#ef4444}[HATA] Kendi seviyenizden (${playerLevel}) yüksek yetki veremezsiniz.`
      );
      return;
    }

    const { query } = await import('../db');
    try {
      await query('UPDATE accounts SET admin_level = $1 WHERE id = $2', [newLevel, target.accountId]);

      target.adminLevel = newLevel;

      const availableCommands = getAvailableCommands(newLevel);
      target.call('client:updateCommandList', [JSON.stringify(availableCommands)]);

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

    if (targetLevel >= playerLevel && target !== player) {
      player.outputChatBox('!{#ef4444}[HATA] Kendi seviyenizden yüksek veya eşit yetkiliyi kickleyemezsiniz.');
      return;
    }

    const targetName = target.characterName || target.accountUsername || target.name;
    const adminName = player.characterName || player.accountUsername || player.name;

    mp.players.broadcast(
      `!{#ef4444}[KICK] ${targetName} sunucudan atıldı. Sebep: ${reason} (Yetkili: ${adminName})`
    );

    console.log(`[KICK] ${adminName} kicked ${targetName}: ${reason}`);

    target.kick(`Sunucudan atıldınız.\nSebep: ${reason}\nYetkili: ${adminName}`);
  }
);

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
    const pos = player.position;
    const heading = player.heading;
    const rad = (heading * Math.PI) / 180;
    const spawnX = pos.x + Math.sin(rad) * 5;
    const spawnY = pos.y + Math.cos(rad) * 5;

    try {
      mp.vehicles.new(
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

registerCommand(
  {
    name: '/spawn',
    syntax: '[ID]',
    description: 'Ölen oyuncuyu canlandırır',
    permissions: { admin: 5 },
  },
  (player: PlayerMp, args: string[]) => {
    if (args.length < 1) {
      player.outputChatBox('!{#fbbf24}[KULLANIM] /spawn [ID]');
      player.outputChatBox('!{#94a3b8}Örnek: /spawn 5');
      return;
    }

    const targetId = parseInt(args[0], 10);
    if (isNaN(targetId)) {
      player.outputChatBox('!{#ef4444}[HATA] Geçersiz ID.');
      return;
    }

    const target = mp.players.at(targetId);
    if (!target || !isPlayerValid(target)) {
      player.outputChatBox('!{#ef4444}[HATA] Belirtilen ID\'de oyuncu bulunamadı.');
      return;
    }

    const targetName = target.characterName || target.accountUsername || target.name;
    const adminName  = player.characterName  || player.accountUsername  || player.name;

    // Oyuncuyu bulunduğu konumda canlandır ve sağlığını tam yap
    target.spawn(target.position);
    target.health = 100;
    target.armour = 0;

    player.outputChatBox(`!{#22c55e}[SPAWN] ${targetName} canlandırıldı.`);
    target.outputChatBox(`!{#c9a84c}[BİLGİ] ${adminName} tarafından canlandırıldınız.`);

    console.log(`[SPAWN] ${adminName} revived ${targetName}`);
  }
);
