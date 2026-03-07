/**
 * SantosRP - Server-Side Appearance Sync
 * Tamamen RAGE:MP Node.js API Standartlarına Göre Optimize Edilmiştir.
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

    // Yüz hatları dizisi — tam 20 eleman olmalı (RAGE:MP Array olarak ister)
    const features: number[] = [];
    const srcFeatures = data.features ?? [];
    for (let i = 0; i < 20; i++) {
      features.push(typeof srcFeatures[i] === 'number' ? srcFeatures[i] : 0.0);
    }

    // ── 1. Model + FaceFeatures + HairColors (TAM 14 PARAMETRE) ─────────────
    // Orijinaldeki gibi 14 parametre yolluyoruz, array'i parçalamıyoruz!
    (player as any).setCustomization(
      isMale,
      shapeFirst,  // shapeFirstID  (anne yüz şekli)
      shapeSecond, // shapeSecondID (baba yüz şekli)
      0,           // shapeThirdID
      shapeFirst,  // skinFirstID   (anne cilt tonu)
      shapeSecond, // skinSecondID  (baba cilt tonu)
      0,           // skinThirdID
      shapeMix,    // shapeMix
      skinMix,     // skinMix
      0.0,         // thirdMix
      eyeColor,
      hairColor,
      hairHighlight,
      features     // Dizi olarak bırakıyoruz, Node.js API'si bunu kabul ediyor.
    );

    // ── 2. Saç Stili ──────────────────────────────────────────────────────────
    (player as any).setClothes(2, data.hairStyle ?? 0, 0, 2);

// ── 3. Head Overlays (ARRAY TUZAĞI ÇÖZÜMÜ) ───────────────────────────
    const setOverlay = (id: number, style?: number, opacity?: number, color?: number) => {
      if (style !== undefined && style !== 255) {
        // DİKKAT: 2. parametre array [ ] içine alındı!
        (player as any).setHeadOverlay(id, [style, opacity ?? 1.0, color ?? 0, color ?? 0]);
      } else {
        // DİKKAT: 2. parametre array [ ] içine alındı!
        (player as any).setHeadOverlay(id, [255, 1.0, 0, 0]);
      }
    };

    setOverlay(0, data.blemishStyle, data.blemishOpacity);
    setOverlay(1, data.facialHairStyle, data.facialHairOpacity, data.facialHairColor);
    setOverlay(2, data.eyebrowStyle, data.eyebrowOpacity, data.eyebrowColor);
    setOverlay(3, data.ageingStyle, data.ageingOpacity);
    setOverlay(4, data.makeupStyle, data.makeupOpacity, data.makeupColor);
    setOverlay(5, data.blushStyle, data.blushOpacity, data.blushColor);
    setOverlay(6, data.complexionStyle, data.complexionOpacity);
    setOverlay(7, data.sunDamageStyle, data.sunDamageOpacity);
    setOverlay(8, data.lipstickStyle, data.lipstickOpacity, data.lipstickColor);
    setOverlay(9, data.molesStyle, data.molesOpacity);
    setOverlay(10, data.chestHairStyle, data.chestHairOpacity, data.chestHairColor);

  } catch (err) {
    console.error(`[APPEARANCE] applyPlayerAppearance hatası (player ${player.id ?? '?'}):`, err);
  }
}