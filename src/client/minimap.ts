export function getMinimapAnchor(): { bottom: number, left: number, width: number } {
    let resolution = mp.game.graphics.getScreenActiveResolution(0, 0);
    const screenX = resolution.x;
    const screenY = resolution.y;

    let aspectRatio = mp.game.graphics.getScreenAspectRatio(false);
    if (aspectRatio > 2 || aspectRatio < 1.5) {
        aspectRatio = screenX / screenY;
    }

    const safezone = mp.game.graphics.getSafeZoneSize();
    const safezoneX = Math.round(screenX * (1.0 - safezone) * 0.5);
    const safezoneY = Math.round(screenY * (1.0 - safezone) * 0.5);

    // RAGE matematiği
    const xUnit = 1.0 / screenX;
    const yUnit = 1.0 / screenY;

    // Harita genişliği
    const minimapWidthInPixels = Math.round(screenX * (xUnit * (screenX / (4 * aspectRatio))));
    
    // GTA V mapinin alt mesafesi (bottom padding)
    const minimapBottomPadding = Math.round(screenY * (yUnit * (screenY / 5.674)));
    
    // Minimapin sol üst (top-left) köşesinin hesabı yerine, sayfanın altından ne kadar yukarıda olduğu (bottom) 
    // ve soldan ne kadar içerde (left) olduğunu hesapla.
    // Minimap yüksekliği (Height) = screenY / 5.674 değeridir.
    const mapHeightPixels = Math.round(screenY / 5.674);
    
    // Sol: safezone (eğer varsa) + standard padding
    const left = safezoneX + Math.round(screenX * (1.0 / 20.0));
    
    // Bottom: Haritanın kendi alt boşluğu (yaklaşık 1/14 veya 1/16 ekran yüksekliği) + Harita yüksekliği
    // Böylece haritanın tam üst çizgisi hesaplanmış olur.
    // GTA genelde map'i bottom-aligned olarak çizer. Alt sınır = safezoneY + (screenY * 0.05) kadardır.
    // Gerçek matematiği: 
    const bottomPaddingPixels = safezoneY + Math.round(screenY * 0.045);
    const bottom = bottomPaddingPixels + mapHeightPixels;

    return { 
        bottom: bottom + 4, // Biraz mesafe payı
        left: left, 
        width: minimapWidthInPixels
    };
}
