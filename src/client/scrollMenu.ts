/**
 * SantosRP - F4 Cursor Toggle
 * F4 tuşuna basılınca cursor aktif/pasif hale gelir.
 */

let cursorActive = false;

function isBlockingUIOpen(): boolean {
  return mp.game.ui.isPauseMenuActive();
}

// ─── F4 (115): Cursor Toggle ──────────────────────────────────────────────────
mp.keys.bind(115, true, () => {
  if (isBlockingUIOpen()) return;
  cursorActive = !cursorActive;
  mp.gui.cursor.show(cursorActive, cursorActive);
});

export function initScrollMenu(): void {
  console.log('[CLIENT] F4 cursor toggle başlatıldı.');
}
