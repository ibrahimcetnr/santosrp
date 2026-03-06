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
}

export interface IVehicle {
  id: number;
  model: string;
  plate: string;
  characterId: number;
  color1: number;
  color2: number;
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
    vipLevel?: number;
    helperLevel?: number;
    zone?: string;
  }
}
