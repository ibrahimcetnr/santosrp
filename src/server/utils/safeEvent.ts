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
export function isPlayerValid(player: PlayerMp): boolean {
  try {
    return !!(player && mp.players.exists(player));
  } catch {
    return false;
  }
}

/**
 * Async RAGE:MP event handler'larını güvenli şekilde sarmalar.
 * Hata fırlatan handler sunucu crash'ine yol açmaz.
 *
 * Kullanım:
 *   safeEvent('server:myEvent', async (player, arg1) => { ... });
 */
export function safeEvent(
  name: string,
  handler: (...args: any[]) => Promise<void> | void
): void {
  mp.events.add(name, (...args: any[]) => {
    // İlk argüman player ise veri tipi kontrolü yap
    const player = args[0];
    if (player && typeof player === 'object' && 'name' in player) {
      if (!mp.players.exists(player)) {
        console.error(`[CHAT-FAIL] SafeEvent reddedildi! Event: ${name} Player: ${player.name}`);
        return;
      }
    }
    try {
      const result = handler(...args);
      if (result && typeof (result as any).catch === 'function') {
        (result as Promise<void>).catch((err: unknown) => {
          console.error(`[SAFE-EVENT][${name}] Yakalanmamış hata:`, err);
        });
      }
    } catch (err) {
      console.error(`[SAFE-EVENT][${name}] Senkron hata:`, err);
    }
  });
}
