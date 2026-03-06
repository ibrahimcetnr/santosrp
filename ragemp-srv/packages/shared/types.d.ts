/**
 * Paylaşılan Tipler - Server ve Client tarafından kullanılır
 */
/** DB accounts tablosu — cache.ts tarafından camelCase'e dönüştürülmüş hali */
export interface IAccount {
    id: number;
    username: string;
    passwordHash: string;
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
    position: {
        x: number;
        y: number;
        z: number;
    } | null;
    created: number;
    charData: string | null;
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
export declare enum NotificationType {
    SUCCESS = "success",
    ERROR = "error",
    INFO = "info",
    WARNING = "warning"
}
export interface INotification {
    type: NotificationType;
    message: string;
    duration?: number;
}
/** RAGE:MP PlayerMp genişletmesi — auth sonrası eklenen alanlar */
declare global {
    interface PlayerMp {
        accountId?: number;
        adminLevel?: number;
        characterId?: number;
        accountUsername?: string;
        characterName?: string;
    }
}
//# sourceMappingURL=types.d.ts.map