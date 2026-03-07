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
    blemishStyle?: number;
    blemishOpacity?: number;
    facialHairStyle?: number;
    facialHairOpacity?: number;
    facialHairColor?: number;
    eyebrowStyle?: number;
    eyebrowOpacity?: number;
    eyebrowColor?: number;
    ageingStyle?: number;
    ageingOpacity?: number;
    makeupStyle?: number;
    makeupOpacity?: number;
    makeupColor?: number;
    makeupColorType?: number;
    blushStyle?: number;
    blushOpacity?: number;
    blushColor?: number;
    complexionStyle?: number;
    complexionOpacity?: number;
    sunDamageStyle?: number;
    sunDamageOpacity?: number;
    lipstickStyle?: number;
    lipstickOpacity?: number;
    lipstickColor?: number;
    molesStyle?: number;
    molesOpacity?: number;
    chestHairStyle?: number;
    chestHairOpacity?: number;
    chestHairColor?: number;
}
export declare function applyPlayerAppearance(player: PlayerMp, data: AppearanceData): void;
export {};
//# sourceMappingURL=appearance.d.ts.map