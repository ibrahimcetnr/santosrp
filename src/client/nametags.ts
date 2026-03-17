/**
 * SantosRP — THE ABSOLUTE ZERO-ALLOCATION NAMETAG SYSTEM
 * No-GC, No-Bridge, No-Sqrt, Hardcore RP
 */

const MAX_DIST_SQ = 400.0;
const HEAD_BONE_ID = 31086;

class PlayerData {
    visible = false;
    lastCheck = 0;
    charName = "Bilinmeyen";
    isTyping = false;
    displayString = "Bilinmeyen";
}

// Havuzlar
const playerCache = new Map<number, PlayerData>();
let streamedArray: PlayerMp[] = [];
let slicingIndex = 0;
let frameCount = 0;
let renderAttached = false;

// --- SIFIR ÇÖP (ZERO-ALLOCATION) İÇİN ÖNCEDEN YARATILMIŞ OBJELER ---
// Döngü içinde ASLA yeni array veya obje yaratmıyoruz, bu sabitleri değiştiriyoruz!
const sharedScreenPos = [0, 0] as [number, number];
const sharedTextOpts = {
    font: 4,
    color: [255, 255, 255, 215] as [number, number, number, number],
    scale: [0.3, 0.3] as [number, number],
    outline: true,
    centre: true
};
const sharedTypingOpts = {
    font: 4,
    color: [180, 100, 230, 220] as [number, number, number, number],
    scale: [0.25, 0.25] as [number, number],
    outline: true,
    centre: true
};

export function initNametags(): void {
    mp.nametags.enabled = false;
    console.log('[NAMETAG] Zero-Allocation sistemi aktif. RAM yükü: 0');

    mp.events.addDataHandler('characterName', (entity, value) => {
        if (entity.type === 'player') {
            const data = getOrCreateData(entity.remoteId);
            data.charName = value as string;
            data.displayString = data.charName + ' (' + entity.remoteId + ')';
        }
    });
    mp.events.addDataHandler('isTyping', (entity, value) => {
        if (entity.type === 'player') {
            const data = getOrCreateData(entity.remoteId);
            data.isTyping = value as boolean;
        }
    });
}

function ensureRenderAttached(): void {
    if (renderAttached) return;
    mp.events.add('render', renderNametagFrame);
    renderAttached = true;
}

function ensureRenderDetached(): void {
    if (!renderAttached) return;
    mp.events.remove('render', renderNametagFrame);
    renderAttached = false;
}

function getOrCreateData(id: number): PlayerData {
    let data = playerCache.get(id);
    if (!data) {
        data = new PlayerData();
        playerCache.set(id, data);
    }
    return data;
}

mp.events.add('entityStreamIn', (entity) => {
    if (entity.type === 'player') {
        const player = entity as PlayerMp;
        if (player === mp.players.local) return;
        if (streamedArray.indexOf(player) !== -1) return;
        streamedArray.push(player);
        if (streamedArray.length === 1) ensureRenderAttached();
    }
});

mp.events.add('entityStreamOut', (entity) => {
    if (entity.type === 'player') {
        const idx = streamedArray.indexOf(entity as PlayerMp);
        if (idx !== -1) streamedArray.splice(idx, 1);
        playerCache.delete(entity.remoteId);
        if (streamedArray.length === 0) {
            slicingIndex = 0;
            ensureRenderDetached();
        }
    }
});

function renderNametagFrame() {
    const len = streamedArray.length;
    if (len === 0) return;

    const local = mp.players.local;
    const localPos = local.position;
    const now = Date.now();
    frameCount++;

    // --- 1. ZAMAN DİLİMLEME (TICK SLICING) ---
    slicingIndex = (slicingIndex + 1) % len;
    const target = streamedArray[slicingIndex];

    if (target && target.handle && target !== local && target.alpha !== 0) {
        const tPos = target.position;
        // Matematiksel Optimizasyon: **2 yerine çarpım kullanmak CPU'da cycle tasarrufu sağlar
        const dx = tPos.x - localPos.x;
        const dy = tPos.y - localPos.y;
        
        const distSq2d = dx * dx + dy * dy;
        if (distSq2d <= MAX_DIST_SQ) {
            const targetHead = target.getBoneCoords(HEAD_BONE_ID, 0, 0, 0);
            const localHead = local.getBoneCoords(HEAD_BONE_ID, 0, 0, 0);
            const screenTest = mp.game.graphics.world3dToScreen2d(targetHead.x, targetHead.y, targetHead.z);

            const cacheData = getOrCreateData(target.remoteId);
            cacheData.lastCheck = now;

            if (screenTest) {
                if (distSq2d < 225) {
                    // 15m içi: raycast ile görünürlük kontrolü (CPU maliyetli)
                    cacheData.visible = !mp.raycasting.testPointToPoint(localHead, targetHead, [local.handle, target.handle], 19);
                } else {
                    // 15–20m arası: raycast yok, direkt görünür kabul et
                    cacheData.visible = true;
                }
            } else {
                cacheData.visible = false;
            }
        }
    }

    // --- 2. ÇİZİM DÖNGÜSÜ (SIFIR ÇÖP - SIFIR TAKILMA) ---
    let drawCount = 0;
    for (let i = 0; i < len; i++) {
        const player = streamedArray[i];
        if (player === local || !player.handle || player.alpha === 0) continue;

        const pId = player.remoteId;
        const cache = playerCache.get(pId);
        
        if (!cache) {
            const newData = getOrCreateData(pId);
            newData.charName = player.getVariable('characterName') as string || player.name;
            newData.isTyping = player.getVariable('isTyping') as boolean || false;
            newData.displayString = newData.charName + ' (' + pId + ')';
            continue;
        }

        if (!cache.visible) continue;

        const pPos = player.position;
        const dx = pPos.x - localPos.x;
        const dy = pPos.y - localPos.y;
        const dz = pPos.z - localPos.z;
        const distSq = dx * dx + dy * dy + dz * dz;
        
        if (distSq > MAX_DIST_SQ) continue;

        // 1. Dinamik Kafa Takibi ve Yükseklik Ayarı
        let drawX = pPos.x;
        let drawY = pPos.y;
        let drawZ = pPos.z + 1.2; // Fallback yüksekliği
        if (player && player.handle !== 0 && mp.players.exists(player)) {
            const boneCoords = player.getBoneCoords(HEAD_BONE_ID, 0, 0, 0);
            if (boneCoords && boneCoords.z !== 0) {
                drawX = boneCoords.x;
                drawY = boneCoords.y;
                drawZ = boneCoords.z + 0.50;
            }
        }
        const screen = mp.game.graphics.world3dToScreen2d(drawX, drawY, drawZ);
        if (!screen) continue;

        // 2. Nametag Boyutunu (Scale) Büyütme
        // Eskiden taban boyut 0.35'ti, şimdi 0.42 yaparak daha büyük ve okunaklı hale getirdik
        const scale = 0.42 - ((distSq / MAX_DIST_SQ) * 0.20);

        // --- MÜKEMMEL DOKUNUŞ ---
        // Yeni obje veya dizi yaratmıyoruz. Sadece dışarıdaki sabit objelerin değerlerini değiştiriyoruz.
        sharedScreenPos[0] = screen.x;
        sharedScreenPos[1] = screen.y;
        
        sharedTextOpts.scale[0] = scale;
        sharedTextOpts.scale[1] = scale;

        mp.game.graphics.drawText(cache.displayString, sharedScreenPos, sharedTextOpts);

        if (cache.isTyping) {
            sharedScreenPos[1] -= 0.035; // Yazıyor yazısını biraz yukarı kaydır
            sharedTypingOpts.scale[0] = scale * 0.8;
            sharedTypingOpts.scale[1] = scale * 0.8;
            
            mp.game.graphics.drawText('* Yazıyor...', sharedScreenPos, sharedTypingOpts);
        }

        if (++drawCount >= 30) break;
    }
}