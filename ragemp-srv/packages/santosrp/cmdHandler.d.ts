/**
 * SantosRP - Merkezi Komut Yöneticisi
 * Sayısal Yetki Tabanlı (AdminLevel) Dinamik Komut Sistemi
 */
import { ICommand } from '../shared/types';
type CommandHandler = (player: PlayerMp, args: string[]) => void | Promise<void>;
/**
 * Belirli bir mesafe içindeki oyunculara mesaj gönderir
 */
export declare function broadcastInRange(player: PlayerMp, range: number, message: string): void;
/** Mesafeye göre solan renk ile mesaj gönderir */
export declare function broadcastFadingMessage(player: PlayerMp, maxRange: number, baseColor: string, darkColor: string, formatMsg: (color: string) => string): void;
/**
 * Yeni bir komut kaydeder
 * @param cmd Komut bilgileri (name, syntax, minLevel, category)
 * @param handler Komut çalıştırıldığında çağrılacak fonksiyon
 */
export declare function registerCommand(cmd: ICommand, handler: CommandHandler): void;
/**
 * Oyuncunun erişebildiği tüm komutları döndürür
 * @param adminLevel Oyuncunun admin seviyesi
 * @returns Erişilebilir komutların listesi (handler olmadan)
 */
export declare function getAvailableCommands(adminLevel: number): ICommand[];
/**
 * Komutu çalıştırır (yetki kontrolü ile)
 * @param player Komutu çalıştıran oyuncu
 * @param message Tam komut mesajı (örn: "/setadmin 5 10")
 */
export declare function executeCommand(player: PlayerMp, message: string): Promise<void>;
/**
 * Komut sistemini başlatır (event listener'ları ekler)
 */
export declare function initCommandSystem(): void;
export {};
//# sourceMappingURL=cmdHandler.d.ts.map