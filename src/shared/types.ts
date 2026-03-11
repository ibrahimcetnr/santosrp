/**
 * Paylaşılan Tipler - Server ve Client tarafından kullanılır
 */

/** DB accounts tablosu — cache.ts tarafından camelCase'e dönüştürülmüş hali */
export interface IAccount {
  id: number;
  username: string;
  passwordHash: string;    // bcrypt hash — sadece auth.ts bcryptCompare'da kullanılır
  socialId: string | null;
  adminLevel: number;
  banned: boolean;
  banReason: string | null;
  lastLogin: Date | null;
  createdAt: Date;
  updatedAt: Date;
  level: number;
  xp: number;
  payday: number;
  play_time: number;
}

/** DB characters tablosu */
export interface ICharacter {
  id: number;
  accountId: number;
  firstName: string;
  lastName: string;
  age: number;
  gender: number;
  money: number;
  bank: number;
  job: string | null;
  position: { x: number; y: number; z: number } | null;
  created: number;         // 0 = henüz oluşturulmadı, 1 = aktif
  charData: string | null; // appearance JSON
  createdAt: Date;
  updatedAt: Date;
  factionId: number | null;
  factionRank: number | null;
  factionDivision: number | null;
}

export interface IVehicle {
  id: number;
  model: string;
  plate: string;
  characterId: number;
  color1: number;
  color2: number;
  factionId: number | null;
}

export enum NotificationType {
  SUCCESS = 'success',
  ERROR = 'error',
  INFO = 'info',
  WARNING = 'warning',
}

export interface INotification {
  type: NotificationType;
  message: string;
  duration?: number;
}

/** Komut Sistemi - İzin Tabanlı */
export interface ICommandPermissions {
  admin?: number;
  faction?: number;
  vip?: number;
  helper?: number;
}

export interface ICommand {
  name: string;           // Komut adı (örn: "/setadmin")
  syntax: string;         // Argüman sözdizimi (örn: "[ID] [Level]")
  description?: string;   // Açıklama (opsiyonel)
  permissions?: ICommandPermissions;
}

/** RAGE:MP PlayerMp genişletmesi — auth sonrası eklenen alanlar */
declare global {
  interface PlayerMp {
    accountId?: number;
    adminLevel?: number;
    characterId?: number;
    accountUsername?: string;
    characterName?: string;   // "Ad Soyad" formatı — HUD watermark ve chat için
    factionType?: number;
    factionRank?: number;
    factionId?: number;
    vipLevel?: number;
    helperLevel?: number;
    zone?: string;
    // Payday / Progression sistemi
    accountLevel?: number;
    accountXp?: number;
    accountPayday?: number;
    accountPlayTime?: number;
  }
}


// faction

// Birlik Türleri (Hem ana kategoriyi hem alt türü temsil eder)
export enum FactionType {
    // --- BUSINESS (Şirket/İşletme) Türleri (10-19 arası) ---
    MEDIA = 10,             // Basın Yayın Şirketi
    LAW_FIRM = 11,          // Hukuk Bürosu
    ORGANIZATION = 12,      // Organizasyon Şirketi
    PRODUCTION = 13,        // Yapım Şirketi
    BUSINESS_OTHER = 19,    // Diğer (İşletme)

    // --- ILLEGAL (İllegal) Türleri (20-39 arası) ---
    GANG = 20,              // Çete
    MAFIA = 21,             // Mafya
    MC = 22,                // Motorcu (Motorcycle Club)
    MOBSTER = 23,           // Mobster
    CREW = 24,              // Crew
    RACING = 25,            // Yarış
    VIGILANTE = 26,         // Vigilante
    HACKER = 27,            // Hacker
    ILLEGAL_OTHER = 39,     // Diğer (İllegal)

    // --- LEGAL (Devlet/Resmi) Türleri (40-59 arası) ---
    MUNICIPALITY = 40,      // Belediye
    GOVERNORATE = 41,       // Valilik
    LAW_ENFORCEMENT = 42,   // Kolluk Kuvveti (LSPD, SD vb.)
    HEALTHCARE = 43,        // Sağlık Kuruluşu (EMS vb.)
    FIRE_DEPARTMENT = 44,   // İtfaiye
    INTELLIGENCE = 45       // İstihbarat Teşkilatı (FIB, IAA vb.)
}

// Birlik Alt Tipleri
export interface IFactionTask {
    id: number;
    name: string;
    description?: string;
    isCompleted: boolean;
}

export interface IFactionRank {
    id: number;
    name: string;
    salary: number;
}

export interface IFactionDivision {
    id: number;
    name: string;
}

// Birlik Ana Objesi
export interface IFaction {
    id: number;
    name: string;
    type: FactionType;          // Sadece bu yeterli
    approvals: Record<string, boolean>; 
    stockValue: number;         
    founderId: number;          
    tasks: IFactionTask[];      
    ranks: IFactionRank[];      
    divisions: IFactionDivision[]; 
}

// Bir birliğin ana kategorisini bulmamızı sağlayacak yardımcı fonksiyon
export function getFactionCategory(type: FactionType): 'ŞİRKET' | 'ILLEGAL' | 'DEVLET KURUMU' {
    if (type >= 10 && type <= 19) return 'ŞİRKET';
    if (type >= 20 && type <= 39) return 'ILLEGAL';
    if (type >= 40 && type <= 59) return 'DEVLET KURUMU';
    return 'DEVLET KURUMU'; // Fallback (bilinmeyen türler resmi kurum sayılır)
}

// (Daha önce eklediğimiz FactionType enum'u burada duruyor)

// Birlik Türlerinin Türkçe Çevirileri
export const FactionTypeNames: Record<FactionType, string> = {
    // --- BUSINESS ---
    [FactionType.MEDIA]: "Basın Yayın Şirketi",
    [FactionType.LAW_FIRM]: "Hukuk Bürosu",
    [FactionType.ORGANIZATION]: "Organizasyon Şirketi",
    [FactionType.PRODUCTION]: "Yapım Şirketi",
    [FactionType.BUSINESS_OTHER]: "Diğer (İşletme)",

    // --- ILLEGAL ---
    [FactionType.GANG]: "Çete",
    [FactionType.MAFIA]: "Mafya",
    [FactionType.MC]: "Motorcu",
    [FactionType.MOBSTER]: "Mobster",
    [FactionType.CREW]: "Crew",
    [FactionType.RACING]: "Yarış",
    [FactionType.VIGILANTE]: "Vigilante",
    [FactionType.HACKER]: "Hacker",
    [FactionType.ILLEGAL_OTHER]: "Diğer (İllegal)",

    // --- LEGAL ---
    [FactionType.MUNICIPALITY]: "Belediye",
    [FactionType.GOVERNORATE]: "Valilik",
    [FactionType.LAW_ENFORCEMENT]: "Kolluk Kuvveti",
    [FactionType.HEALTHCARE]: "Sağlık Kuruluşu",
    [FactionType.FIRE_DEPARTMENT]: "İtfaiye",
    [FactionType.INTELLIGENCE]: "İstihbarat Teşkilatı"
};

// İstediğin gibi pratik kullanım için yardımcı fonksiyon:
export function getFactionTypeName(type: FactionType): string {
    return FactionTypeNames[type] || "Bilinmeyen Birlik Türü";
}