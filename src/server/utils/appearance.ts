/**
 * SantosRP - Server-Side Appearance Sync
 *
 * char_data JSON'unu RAGE:MP'nin sunucu tarafı native fonksiyonlarına çevirir.
 * Sunucudan çağrılan bu metodlar tüm bağlı istemcilere otomatik senkronize edilir,
 * böylece diğer oyuncular da doğru görünümü görür (invisible/default freemode sorunu çözülür).
 *
 * RAGE:MP Server-Side API farkları (Client ile karşılaştırıldığında):
 *  - setCustomization()    → model + headBlend + faceFeature + eyeColor + hair hepsini tek seferde ayarlar
 *  - setHeadOverlay()      → sadece 3 parametre (overlayID, index, opacity) — renk yok
 *  - setHeadOverlayColor() → ayrı çağrı olarak mevcut
 *  - Client-side setComponentVariation(2, ...) yerine → server'da setCustomization içindeki hairColor/highlight
 */

interface AppearanceData {
  gender?: number;
  mother?: number;
  father?: number;
  shapeMix?: number;
  skinMix?: number;
  features?: number[];
  eyeColor?: number;
  hairStyle?: number;
  hairColor?: number;
  hairHighlight?: number;
  // Head Overlays
  blemishStyle?: number;   blemishOpacity?: number;
  facialHairStyle?: number; facialHairOpacity?: number; facialHairColor?: number;
  eyebrowStyle?: number;   eyebrowOpacity?: number;   eyebrowColor?: number;
  ageingStyle?: number;    ageingOpacity?: number;
  makeupStyle?: number;    makeupOpacity?: number;    makeupColor?: number; makeupColorType?: number;
  blushStyle?: number;     blushOpacity?: number;     blushColor?: number;
  complexionStyle?: number; complexionOpacity?: number;
  sunDamageStyle?: number; sunDamageOpacity?: number;
  lipstickStyle?: number;  lipstickOpacity?: number;  lipstickColor?: number;
  molesStyle?: number;     molesOpacity?: number;
  chestHairStyle?: number; chestHairOpacity?: number; chestHairColor?: number;
}

/**
 * char_data JSON'undaki görünüm verisini sunucu taraflı native API'larla oyuncuya uygular.
 * Tüm bağlı istemcilere otomatik senkronize edilir.
 */
export function applyPlayerAppearance(player: PlayerMp, data: AppearanceData): void {
  try {
    const isMale     = (data.gender ?? 0) !== 1;
    const shapeFirst = data.mother       ?? 0;
    const shapeSecond = data.father      ?? 0;
    const shapeMix   = data.shapeMix     ?? 0.5;
    const skinMix    = data.skinMix      ?? 0.5;
    const eyeColor   = data.eyeColor     ?? 0;
    const hairColor  = data.hairColor    ?? 0;
    const hairHighlight = data.hairHighlight ?? 0;

    // Yüz hatları dizisi — tam 20 eleman olmalı
    const features: number[] = [];
    const srcFeatures = data.features ?? [];
    for (let i = 0; i < 20; i++) {
      features.push(typeof srcFeatures[i] === 'number' ? srcFeatures[i] : 0.0);
    }

    // ── 1. Model + HeadBlend + FaceFeatures + EyeColor + Hair ────────────────
    // setCustomization: model'i de otomatik ayarlar (mp_m/mp_f freemode)
    (player as any).setCustomization(
      isMale,
      shapeFirst,  // shapeFirstID  (anne yüz şekli)
      shapeSecond, // shapeSecondID (baba yüz şekli)
      0,           // shapeThirdID  — 0 bırakılmalı
      shapeFirst,  // skinFirstID   (anne cilt tonu)
      shapeSecond, // skinSecondID  (baba cilt tonu)
      0,           // skinThirdID   — 0 bırakılmalı
      shapeMix,    // shapeMix 0.0–1.0
      skinMix,     // skinMix  0.0–1.0
      0.0,         // thirdMix — 0 bırakılmalı
      eyeColor,
      hairColor,
      hairHighlight,
      features
    );

    // ── 2. Saç Stili (component 2) ────────────────────────────────────────────
    // setCustomization hairColor/highlight'ı ayarlar ama saç stilini (drawable)
    // setClothes ile ayrıca set etmek gerekir.
    (player as any).setClothes(2, data.hairStyle ?? 0, 0, 2);

    // ── 3. Head Overlays ──────────────────────────────────────────────────────
    // Server-side setHeadOverlay: (overlayID, index, opacity)
    // Renk için setHeadOverlayColor: (overlayID, colorType, colorID, secondColorID)

    // Cilt Lekeleri (0, renk yok)
    if (data.blemishStyle !== undefined && data.blemishStyle !== 255) {
      (player as any).setHeadOverlay(0, data.blemishStyle, data.blemishOpacity ?? 1.0);
    } else {
      (player as any).setHeadOverlay(0, 255, 1.0);
    }

    // Sakal (1, colorType=1)
    if (data.facialHairStyle !== undefined && data.facialHairStyle !== 255) {
      (player as any).setHeadOverlay(1, data.facialHairStyle, data.facialHairOpacity ?? 1.0);
      (player as any).setHeadOverlayColor(1, 1, data.facialHairColor ?? 0, data.facialHairColor ?? 0);
    } else {
      (player as any).setHeadOverlay(1, 255, 1.0);
    }

    // Kaş (2, colorType=1)
    if (data.eyebrowStyle !== undefined && data.eyebrowStyle !== 255) {
      (player as any).setHeadOverlay(2, data.eyebrowStyle, data.eyebrowOpacity ?? 1.0);
      (player as any).setHeadOverlayColor(2, 1, data.eyebrowColor ?? 0, data.eyebrowColor ?? 0);
    } else {
      (player as any).setHeadOverlay(2, 255, 1.0);
    }

    // Yaşlanma Çizgileri (3, renk yok)
    if (data.ageingStyle !== undefined && data.ageingStyle !== 255) {
      (player as any).setHeadOverlay(3, data.ageingStyle, data.ageingOpacity ?? 0.5);
    } else {
      (player as any).setHeadOverlay(3, 255, 1.0);
    }

    // Makyaj (4, colorType değişken)
    if (data.makeupStyle !== undefined && data.makeupStyle !== 255) {
      (player as any).setHeadOverlay(4, data.makeupStyle, data.makeupOpacity ?? 1.0);
      const mcType: number = data.makeupColorType ?? 2;
      if (mcType > 0) {
        (player as any).setHeadOverlayColor(4, mcType, data.makeupColor ?? 0, data.makeupColor ?? 0);
      }
    } else {
      (player as any).setHeadOverlay(4, 255, 1.0);
    }

    // Allık (5, colorType=2)
    if (data.blushStyle !== undefined && data.blushStyle !== 255) {
      (player as any).setHeadOverlay(5, data.blushStyle, data.blushOpacity ?? 0.6);
      (player as any).setHeadOverlayColor(5, 2, data.blushColor ?? 0, data.blushColor ?? 0);
    } else {
      (player as any).setHeadOverlay(5, 255, 1.0);
    }

    // Kompleksiyon (6, renk yok)
    if (data.complexionStyle !== undefined && data.complexionStyle !== 255) {
      (player as any).setHeadOverlay(6, data.complexionStyle, data.complexionOpacity ?? 1.0);
    } else {
      (player as any).setHeadOverlay(6, 255, 1.0);
    }

    // Güneş Hasarı (7, renk yok)
    if (data.sunDamageStyle !== undefined && data.sunDamageStyle !== 255) {
      (player as any).setHeadOverlay(7, data.sunDamageStyle, data.sunDamageOpacity ?? 1.0);
    } else {
      (player as any).setHeadOverlay(7, 255, 1.0);
    }

    // Ruj (8, colorType=2)
    if (data.lipstickStyle !== undefined && data.lipstickStyle !== 255) {
      (player as any).setHeadOverlay(8, data.lipstickStyle, data.lipstickOpacity ?? 1.0);
      (player as any).setHeadOverlayColor(8, 2, data.lipstickColor ?? 0, data.lipstickColor ?? 0);
    } else {
      (player as any).setHeadOverlay(8, 255, 1.0);
    }

    // Çiller & Benler (9, renk yok)
    if (data.molesStyle !== undefined && data.molesStyle !== 255) {
      (player as any).setHeadOverlay(9, data.molesStyle, data.molesOpacity ?? 1.0);
    } else {
      (player as any).setHeadOverlay(9, 255, 1.0);
    }

    // Göğüs Kılı (10, colorType=1)
    if (data.chestHairStyle !== undefined && data.chestHairStyle !== 255) {
      (player as any).setHeadOverlay(10, data.chestHairStyle, data.chestHairOpacity ?? 1.0);
      (player as any).setHeadOverlayColor(10, 1, data.chestHairColor ?? 0, data.chestHairColor ?? 0);
    } else {
      (player as any).setHeadOverlay(10, 255, 1.0);
    }

  } catch (err) {
    console.error(`[APPEARANCE] applyPlayerAppearance hatası (player ${player.id ?? '?'}):`, err);
  }
}
