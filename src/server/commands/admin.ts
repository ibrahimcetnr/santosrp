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

    const targetLevel = target.adminLevel ?? 0;
    const playerLevel = player.adminLevel ?? 0;
    // Kendinden yüksek veya eşit yetkili birinin yetkisiyle oynayamaz
    if (targetLevel >= playerLevel && target !== player) {
      player.outputChatBox('!{#ef4444}[HATA] Kendi seviyenizden yüksek veya eşit bir yetkiliye işlem yapamazsınız.');
      return;
    }
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
    if (!target.characterId) return player.outputChatBox('!{#ef4444}[HATA] Hedef oyuncu henüz karaktere giriş yapmamış.');

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

registerCommand(
  {
    name: '/tp',
    syntax: '[X] [Y] [Z]',
    description: 'Koordinatlara ışınlanırsınız',
    permissions: { admin: 3 },
  },
  (player: PlayerMp, args: string[]) => {
    if (args.length < 3) {
      player.outputChatBox('!{#fbbf24}[KULLANIM] /tp [X] [Y] [Z]');
      return;
    }

    const x = parseFloat(args[0]), y = parseFloat(args[1]), z = parseFloat(args[2]);
    if (isNaN(x) || isNaN(y) || isNaN(z)) {
      player.outputChatBox('!{#ef4444}[HATA] Geçersiz koordinat değerleri.');
      return;
    }

    player.position = new mp.Vector3(x, y, z);
    player.outputChatBox('!{#22c55e}[BAŞARILI] Belirtilen koordinatlara ışınlandınız.');
    console.log(`[TP] ${player.characterName || player.name} → (${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)})`);
  }
);

/** /goto [ID] - Oyuncunun yanına ışınlan */
registerCommand(
  {
    name: '/goto',
    syntax: '[ID]',
    description: 'Oyuncunun yanına ışınlanırsınız',
    permissions: { admin: 1 },
  },
  (player: PlayerMp, args: string[]) => {
    if (args.length < 1) return player.outputChatBox('!{#fbbf24}[KULLANIM] /goto [ID]');

    const target = mp.players.at(parseInt(args[0], 10));
    if (!target || !isPlayerValid(target)) return player.outputChatBox('!{#ef4444}[HATA] Oyuncu bulunamadı veya geçersiz ID.');
    if (!target.characterId) return player.outputChatBox('!{#ef4444}[HATA] Hedef oyuncu henüz karaktere giriş yapmamış.');

    const pos = target.position;
    player.position = new mp.Vector3(pos.x + 1.5, pos.y, pos.z);
    player.dimension = target.dimension;
    player.outputChatBox(`!{#22c55e}[BAŞARILI] ${target.characterName || target.name} adlı oyuncunun yanına ışınlandınız.`);
    console.log(`[GOTO] ${player.characterName || player.name} → ${target.characterName || target.name}`);
  }
);

/** /get [ID] - Oyuncuyu yanına çek */
registerCommand(
  {
    name: '/get',
    syntax: '[ID]',
    description: 'Oyuncuyu yanınıza çekersiniz',
    permissions: { admin: 1 },
  },
  (player: PlayerMp, args: string[]) => {
    if (args.length < 1) return player.outputChatBox('!{#fbbf24}[KULLANIM] /get [ID]');

    const target = mp.players.at(parseInt(args[0], 10));
    if (!target || !isPlayerValid(target)) return player.outputChatBox('!{#ef4444}[HATA] Oyuncu bulunamadı veya geçersiz ID.');
    if (!target.characterId) return player.outputChatBox('!{#ef4444}[HATA] Hedef oyuncu henüz karaktere giriş yapmamış.');
    if (target === player) return player.outputChatBox('!{#ef4444}[HATA] Kendinizi çekemezsiniz.');

    const pos = player.position;
    target.position = new mp.Vector3(pos.x + 1.5, pos.y, pos.z);
    target.dimension = player.dimension;

    player.outputChatBox(`!{#22c55e}[BAŞARILI] ${target.characterName || target.name} adlı oyuncuyu yanınıza çektiniz.`);
    target.outputChatBox('!{#fbbf24}[BİLGİ] Bir yetkili tarafından ışınlandınız.');
    console.log(`[GET] ${player.characterName || player.name} pulled ${target.characterName || target.name}`);
  }
);

/** /fixveh - İçinde bulunduğun aracı tamir et */
registerCommand(
  {
    name: '/fixveh',
    syntax: '',
    description: 'İçinde bulunduğunuz aracı tamir eder',
    permissions: { admin: 1 },
  },
  (player: PlayerMp) => {
    if (!player.vehicle) return player.outputChatBox('!{#ef4444}[HATA] Herhangi bir aracın içinde değilsiniz.');

    player.vehicle.repair();
    player.outputChatBox('!{#22c55e}[BAŞARILI] Araç başarıyla tamir edildi.');
    console.log(`[FIXVEH] ${player.characterName || player.name} repaired a vehicle`);
  }
);

/** /dv - İçinde bulunduğun aracı sil */
registerCommand(
  {
    name: '/dv',
    syntax: '',
    description: 'İçinde bulunduğunuz aracı siler',
    permissions: { admin: 2 },
  },
  (player: PlayerMp) => {
    if (!player.vehicle) return player.outputChatBox('!{#ef4444}[HATA] Herhangi bir aracın içinde değilsiniz.');

    player.vehicle.destroy();
    player.outputChatBox('!{#22c55e}[BAŞARILI] Araç başarıyla silindi.');
    console.log(`[DV] ${player.characterName || player.name} destroyed a vehicle`);
  }
);

/** /sethp [ID] [Can] - Oyuncunun canını ayarla */
registerCommand(
  {
    name: '/sethp',
    syntax: '[ID] [Değer]',
    description: 'Oyuncunun canını ayarlar',
    permissions: { admin: 1 },
  },
  (player: PlayerMp, args: string[]) => {
    if (args.length < 2) return player.outputChatBox('!{#fbbf24}[KULLANIM] /sethp [ID] [Can]');

    const target = mp.players.at(parseInt(args[0], 10));
    const hp = parseInt(args[1], 10);

    if (!target || !isPlayerValid(target)) return player.outputChatBox('!{#ef4444}[HATA] Oyuncu bulunamadı.');
    if (!target.characterId) return player.outputChatBox('!{#ef4444}[HATA] Hedef oyuncu henüz karaktere giriş yapmamış.');
    if (isNaN(hp) || hp < 0 || hp > 100) return player.outputChatBox('!{#ef4444}[HATA] Can 0-100 arasında olmalıdır.');

    target.health = hp;
    player.outputChatBox(`!{#22c55e}[BAŞARILI] ${target.characterName || target.name} adlı oyuncunun canı ${hp} yapıldı.`);
    console.log(`[SETHP] ${player.characterName || player.name} set ${target.characterName || target.name} health to ${hp}`);
  }
);

/** /setarmor [ID] [Zırh] - Oyuncunun zırhını ayarla */
registerCommand(
  {
    name: '/setarmor',
    syntax: '[ID] [Değer]',
    description: 'Oyuncunun zırhını ayarlar',
    permissions: { admin: 1 },
  },
  (player: PlayerMp, args: string[]) => {
    if (args.length < 2) return player.outputChatBox('!{#fbbf24}[KULLANIM] /setarmor [ID] [Zırh]');

    const target = mp.players.at(parseInt(args[0], 10));
    const armor = parseInt(args[1], 10);

    if (!target || !isPlayerValid(target)) return player.outputChatBox('!{#ef4444}[HATA] Oyuncu bulunamadı.');
    if (!target.characterId) return player.outputChatBox('!{#ef4444}[HATA] Hedef oyuncu henüz karaktere giriş yapmamış.');
    if (isNaN(armor) || armor < 0 || armor > 100) return player.outputChatBox('!{#ef4444}[HATA] Zırh 0-100 arasında olmalıdır.');

    target.armour = armor;
    player.outputChatBox(`!{#22c55e}[BAŞARILI] ${target.characterName || target.name} adlı oyuncunun zırhı ${armor} yapıldı.`);
    console.log(`[SETARMOR] ${player.characterName || player.name} set ${target.characterName || target.name} armour to ${armor}`);
  }
);

// ─── /gotocar [Plaka] ────────────────────────────────────────────────────────

registerCommand(
  {
    name: '/gotocar',
    syntax: '[Plaka]',
    description: 'Belirtilen plakalı aracın yanına ışınlanır',
    permissions: { admin: 1 },
  },
  (player: PlayerMp, args: string[]) => {
    if (args.length === 0) return player.outputChatBox('!{#fbbf24}[KULLANIM] /gotocar [Plaka]');

    const plate = args[0].toUpperCase();
    const vehicle = mp.vehicles.toArray().find(
      (v: VehicleMp) => v.numberPlate?.toUpperCase() === plate
    );

    if (!vehicle) {
      player.outputChatBox(`!{#ef4444}[HATA] "${plate}" plakalı araç şu an dünyada bulunamadı.`);
      return;
    }

    const pos = vehicle.position;
    player.position = new mp.Vector3(pos.x + 2, pos.y, pos.z);
    player.outputChatBox(`!{#22c55e}[ADMIN] "${plate}" plakalı aracın yanına ışınlandınız.`);
    console.log(`[GOTOCAR] ${player.characterName || player.name} -> ${plate}`);
  }
);

// ─── /getcar [Plaka] ─────────────────────────────────────────────────────────

registerCommand(
  {
    name: '/getcar',
    syntax: '[Plaka]',
    description: 'Belirtilen plakalı aracı yanına çeker',
    permissions: { admin: 1 },
  },
  (player: PlayerMp, args: string[]) => {
    if (args.length === 0) return player.outputChatBox('!{#fbbf24}[KULLANIM] /getcar [Plaka]');

    const plate = args[0].toUpperCase();
    const vehicle = mp.vehicles.toArray().find(
      (v: VehicleMp) => v.numberPlate?.toUpperCase() === plate
    );

    if (!vehicle) {
      player.outputChatBox(`!{#ef4444}[HATA] "${plate}" plakalı araç şu an dünyada bulunamadı.`);
      return;
    }

    const pos = player.position;
    vehicle.position = new mp.Vector3(pos.x + 3, pos.y, pos.z);
    vehicle.rotation = new mp.Vector3(0, 0, player.heading);
    player.outputChatBox(`!{#22c55e}[ADMIN] "${plate}" plakalı araç yanına çekildi.`);
    console.log(`[GETCAR] ${player.characterName || player.name} pulled ${plate} to their location`);
  }
);
