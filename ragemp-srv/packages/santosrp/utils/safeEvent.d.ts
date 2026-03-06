/**
 * SantosRP - Safe Async Event Wrapper
 *
 * Tüm async RAGE:MP event handler'larını sarmalar.
 * Yakalanmayan Promise rejection'ları sunucuyu çökertmez;
 * konsola loglanır ve hayatta kalır.
 */
/**
 * Oyuncunun hâlâ geçerli (bağlı) olup olmadığını kontrol eder.
 * Async DB/bcrypt işlemi sırasında disconnect olabileceği için
 * player.call() öncesinde mutlaka çağrılmalıdır.
 */
export declare function isPlayerValid(player: PlayerMp): boolean;
/**
 * Async RAGE:MP event handler'larını güvenli şekilde sarmalar.
 * Hata fırlatan handler sunucu crash'ine yol açmaz.
 *
 * Kullanım:
 *   safeEvent('server:myEvent', async (player, arg1) => { ... });
 */
export declare function safeEvent(name: string, handler: (...args: any[]) => Promise<void> | void): void;
//# sourceMappingURL=safeEvent.d.ts.map